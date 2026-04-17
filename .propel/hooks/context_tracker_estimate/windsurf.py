#!/usr/bin/env python3
"""
Windsurf Cascade adapter.

Wire pre_user_prompt and post_cascade_response_with_transcript to this
script (pass the event name as argv[1] from the hook command).
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from core import HookEvent, PHASE_POST, PHASE_PRE, dispatch, read_stdin_json  # noqa: E402


def main() -> None:
    data = read_stdin_json()
    event_name = sys.argv[1] if len(sys.argv) > 1 else ""
    tool_info = data.get("tool_info", {}) or {}
    session_id = data.get("trajectory_id") or data.get("execution_id") or "unknown"
    model = data.get("model_name") or data.get("model")
    prompt = tool_info.get("prompt", "") or ""

    if event_name == "pre_user_prompt":
        dispatch(
            HookEvent(
                ide="windsurf",
                phase=PHASE_PRE,
                session_id=session_id,
                inline_text=prompt,
                prompt=prompt,
                model=model,
            )
        )
    elif event_name in ("post_cascade_response_with_transcript", "post_cascade_response"):
        dispatch(
            HookEvent(
                ide="windsurf",
                phase=PHASE_POST,
                session_id=session_id,
                transcript_path=tool_info.get("transcript_path"),
                inline_text=tool_info.get("response", ""),
                model=model,
            )
        )
    sys.exit(0)


if __name__ == "__main__":
    main()
