"""
Zero-dependency multi-IDE context-usage tracker.

This variant mirrors `context_tracker_tiktoken/core.py` but intentionally does
not import tiktoken. Token counts are always produced via a simple
`len(text) // 4` character-based estimate (~70–85% accuracy, drifts on code
and non-English text). Use this variant on machines where installing tiktoken
is not possible or desired; the trace-file shape is identical.

Per-session trace files are written to
  .propel/telemetry/ctx-tracing-<session-id>.json
and are aligned with the OpenTelemetry GenAI semantic conventions
(https://opentelemetry.io/docs/specs/semconv/gen-ai/). Each user turn is a
single entry in `turns[]`, opened at PRE and closed at POST.
"""
from __future__ import annotations

import getpass
import json
import os
import platform
import re
import socket
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

CONTEXT_LIMIT = int(os.environ.get("CONTEXT_TRACKER_LIMIT", "128000"))
MAX_MESSAGE_CHARS = int(os.environ.get("CTX_TRACKER_MAX_MESSAGE_CHARS", "8000"))
REDACT_ENABLED = os.environ.get("CTX_TRACKER_REDACT") == "1"

_PROPEL_DIR = Path(__file__).resolve().parents[2]
_REPO_ROOT = _PROPEL_DIR.parent
TELEMETRY_DIR = Path(os.environ.get("CONTEXT_TRACKER_LOG_DIR", _PROPEL_DIR / "telemetry"))
OTEL_SCHEMA_URL = "https://opentelemetry.io/schemas/1.36.0"

PHASE_PRE = "pre"
PHASE_POST = "post"

# Always-on PII patterns. Emails are stripped unconditionally per user request.
_ALWAYS_REDACT_PATTERNS = [
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "<email>"),
]
# Opt-in patterns enabled via CTX_TRACKER_REDACT=1.
_OPTIONAL_REDACT_PATTERNS = [
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "<aws-access-key>"),
    (re.compile(r"\b(?:Bearer|token)[= ]+[A-Za-z0-9._\-]{16,}\b", re.IGNORECASE), "<token>"),
    (re.compile(r"\bsk-[A-Za-z0-9]{20,}\b"), "<api-key>"),
    (re.compile(r"\bghp_[A-Za-z0-9]{30,}\b"), "<github-token>"),
]


@dataclass
class HookEvent:
    ide: str
    phase: str
    session_id: str
    transcript_path: Optional[str] = None
    inline_text: Optional[str] = None
    prompt: Optional[str] = None
    model: Optional[str] = None
    extras: dict = field(default_factory=dict)


def count_tokens(text: str) -> int:
    """Character-based estimate. ~4 chars per token for English prose."""
    if not text:
        return 0
    return len(text) // 4


def _truncate(text: str) -> str:
    """Truncate text to MAX_MESSAGE_CHARS. If truncated, last 3 chars are '...'."""
    if not text or len(text) <= MAX_MESSAGE_CHARS:
        return text or ""
    keep = max(MAX_MESSAGE_CHARS - 3, 0)
    return text[:keep] + "..."


def _redact(text: str) -> str:
    if not text:
        return ""
    for pattern, replacement in _ALWAYS_REDACT_PATTERNS:
        text = pattern.sub(replacement, text)
    if REDACT_ENABLED:
        for pattern, replacement in _OPTIONAL_REDACT_PATTERNS:
            text = pattern.sub(replacement, text)
    return text


def _sanitize(text: Optional[str]) -> str:
    return _truncate(_redact(text or ""))


def _build_part(content: str) -> dict:
    return {"type": "text", "content": _sanitize(content)}


def _message(role: str, content: str, finish_reason: Optional[str] = None) -> dict:
    msg: dict = {"role": role, "parts": [_build_part(content)]}
    if finish_reason:
        msg["finish_reason"] = finish_reason
    return msg


def _trace_path(session_id: str) -> Path:
    safe = "".join(c if c.isalnum() or c in "-_" else "_" for c in session_id) or "unknown"
    return TELEMETRY_DIR / f"ctx-tracing-{safe}.json"


def _load_trace(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _save_trace(path: Path, data: dict) -> None:
    try:
        TELEMETRY_DIR.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
    except OSError as exc:
        print(f"[ctx-tracker] trace write failed: {exc}", file=sys.stderr)


def _git_config(key: str) -> Optional[str]:
    try:
        out = subprocess.run(
            ["git", "config", "--get", key],
            cwd=_REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=2,
        )
        value = out.stdout.strip()
        return value or None
    except (OSError, subprocess.SubprocessError):
        return None


def _collect_user_info() -> dict:
    """Collect OTel-style identity/host attributes. Email is intentionally omitted."""
    info: dict = {}
    try:
        info["user.name"] = os.environ.get("USERNAME") or getpass.getuser()
    except Exception:
        pass
    git_name = _git_config("user.name")
    if git_name:
        info["user.full_name"] = git_name
    if info.get("user.name"):
        info["user.id"] = info["user.name"]
    try:
        info["host.name"] = socket.gethostname()
    except OSError:
        pass
    info["os.type"] = platform.system().lower()
    info["os.version"] = platform.release()
    return info


def _load_system_instructions() -> list[dict]:
    """Snapshot repo-local system prompt sources (CLAUDE.md, .windsurfrules)."""
    sources = [_REPO_ROOT / "CLAUDE.md", _REPO_ROOT / ".windsurfrules"]
    out: list[dict] = []
    for src in sources:
        if src.exists():
            try:
                out.append(_build_part(src.read_text(encoding="utf-8", errors="replace")))
            except OSError:
                continue
    return out


def _parse_transcript(path: str) -> tuple[str, Optional[str], Optional[dict], Optional[str]]:
    """
    Walk a JSONL transcript.

    Returns: (full_text, latest_model, latest_assistant_message, latest_response_id)
    """
    if not path or not os.path.exists(path):
        return "", None, None, None
    parts: list[str] = []
    latest_model: Optional[str] = None
    latest_assistant: Optional[dict] = None
    latest_response_id: Optional[str] = None

    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            try:
                entry = json.loads(line.strip())
            except json.JSONDecodeError:
                continue
            msg = entry.get("message", entry) if isinstance(entry, dict) else None
            if not isinstance(msg, dict):
                continue
            if msg.get("model"):
                latest_model = msg["model"]
            if msg.get("id"):
                latest_response_id = msg["id"]

            role = msg.get("role")
            content = msg.get("content")
            text_chunks: list[str] = []
            if isinstance(content, str):
                text_chunks.append(content)
            elif isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        text_chunks.append(block.get("text", ""))
            joined = "\n".join(text_chunks)
            if joined:
                parts.append(joined)
            if role == "assistant" and joined:
                latest_assistant = _message(
                    "assistant", joined, msg.get("stop_reason") or msg.get("finish_reason")
                )
    return "\n".join(parts), latest_model, latest_assistant, latest_response_id


def _provider_name(ide: str) -> str:
    override = os.environ.get("GEN_AI_PROVIDER_NAME")
    if override:
        return override
    return {"claude-code": "anthropic", "copilot": "openai", "windsurf": "unknown"}.get(
        ide, "unknown"
    )


def _new_trace(event: HookEvent, model: Optional[str]) -> dict:
    return {
        "schema_url": OTEL_SCHEMA_URL,
        "resource": {
            "service.name": "propeliq.ctx-tracker",
            "gen_ai.framework": event.ide,
            **_collect_user_info(),
        },
        "gen_ai.conversation.id": event.session_id,
        "gen_ai.provider.name": _provider_name(event.ide),
        "gen_ai.operation.name": "chat",
        "gen_ai.request.model": model,
        "gen_ai.system_instructions": _load_system_instructions(),
        "context_window": {
            "limit_tokens": CONTEXT_LIMIT,
            "counting_method": "estimated",
        },
        "created_at": datetime.now().isoformat(timespec="seconds"),
        "updated_at": datetime.now().isoformat(timespec="seconds"),
        "_cumulative_input_tokens": 0,
        "turns": [],
    }


def _open_turn_index(trace: dict) -> Optional[int]:
    for i in range(len(trace.get("turns", [])) - 1, -1, -1):
        if "end_time" not in trace["turns"][i]:
            return i
    return None


def dispatch(event: HookEvent) -> None:
    """Handle a normalised hook event. Updates the per-session trace file."""
    now = datetime.now().isoformat(timespec="seconds")
    path = _trace_path(event.session_id)
    trace = _load_trace(path)

    full_text, scanned_model, latest_assistant, response_id = _parse_transcript(
        event.transcript_path or ""
    )
    model = event.model or scanned_model or trace.get("gen_ai.request.model")

    if not trace:
        trace = _new_trace(event, model)
    if model and not trace.get("gen_ai.request.model"):
        trace["gen_ai.request.model"] = model
    trace["updated_at"] = now

    if event.phase == PHASE_PRE:
        # Input tokens for this turn. Claude/Windsurf transcripts at PRE time
        # hold everything up to and including the new user message; Copilot
        # has no transcript so we count the prompt text and accumulate.
        if event.ide == "copilot":
            prompt_tokens = count_tokens(event.prompt or event.inline_text or "")
            input_tokens = trace.get("_cumulative_input_tokens", 0) + prompt_tokens
        else:
            input_tokens = count_tokens(full_text) if full_text else count_tokens(event.prompt or "")
        trace["_cumulative_input_tokens"] = input_tokens

        turn: dict = {
            "turn_id": len(trace["turns"]) + 1,
            "event.name": "gen_ai.client.inference.operation.details",
            "start_time": now,
            "gen_ai.operation.name": "chat",
            "gen_ai.input.messages": [_message("user", event.prompt or event.inline_text or "")],
            "gen_ai.usage.input_tokens": input_tokens,
        }
        if model:
            turn["gen_ai.request.model"] = model
        trace["turns"].append(turn)
        _save_trace(path, trace)
        return

    # POST phase: close the latest open turn.
    idx = _open_turn_index(trace)
    if idx is None:
        trace["turns"].append({
            "turn_id": len(trace["turns"]) + 1,
            "event.name": "gen_ai.client.inference.operation.details",
            "start_time": now,
            "gen_ai.operation.name": "chat",
            "gen_ai.input.messages": [],
            "gen_ai.usage.input_tokens": trace.get("_cumulative_input_tokens", 0),
        })
        idx = len(trace["turns"]) - 1
    turn = trace["turns"][idx]

    pre_total = trace.get("_cumulative_input_tokens", 0)
    if full_text:
        post_total = count_tokens(full_text)
    elif event.inline_text:
        post_total = pre_total + count_tokens(event.inline_text)
    else:
        post_total = pre_total
    output_tokens = max(post_total - pre_total, 0)

    if latest_assistant is None and event.inline_text:
        latest_assistant = _message("assistant", event.inline_text)

    turn["end_time"] = now
    try:
        start = datetime.fromisoformat(turn["start_time"])
        elapsed = (datetime.fromisoformat(now) - start).total_seconds()
        turn["duration_seconds"] = round(elapsed, 3)
        turn["gen_ai.server.time_to_complete"] = round(elapsed, 3)
    except ValueError:
        pass
    if model:
        turn["gen_ai.response.model"] = model
    if response_id:
        turn["gen_ai.response.id"] = response_id
    turn["gen_ai.output.messages"] = [latest_assistant] if latest_assistant else []
    turn["gen_ai.usage.output_tokens"] = output_tokens
    turn["context_window.percentage_used"] = (
        round(post_total / CONTEXT_LIMIT * 100, 2) if CONTEXT_LIMIT else 0.0
    )
    turn["context_window.remaining_tokens"] = max(CONTEXT_LIMIT - post_total, 0)

    # Roll cumulative forward so the next turn's input tokens start from here.
    trace["_cumulative_input_tokens"] = post_total
    _save_trace(path, trace)

    print(
        f"[{event.ide}] turn={turn['turn_id']} session={event.session_id} "
        f"in={pre_total:,} out={output_tokens:,} total={post_total:,} "
        f"({turn['context_window.percentage_used']}% used)",
        file=sys.stderr,
    )


def read_stdin_json() -> dict:
    try:
        return json.load(sys.stdin)
    except json.JSONDecodeError:
        return {}
