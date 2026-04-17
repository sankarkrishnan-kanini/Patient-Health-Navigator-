"""
Static lint for PropelIQ prompt/skill contracts.

Fails if forbidden strings (legacy in-memory / draft-approval / batched-question
patterns) appear in .propel/prompts/*.md or .propel/skills/probe-user/SKILL.md.

Run from repo root:  python .propel/scripts/lint_streaming_contract.py
Exit 0 = clean. Exit 1 = violations found (prints table and bails).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROMPTS = ROOT / ".propel" / "prompts"
PROBE_SKILL = ROOT / ".propel" / "skills" / "probe-user" / "SKILL.md"

PROMPT_FORBIDDEN = [
    ("Hold all generated content in memory only",
     "Canonical Block A (legacy). Replace with sectional streaming write."),
    ("Do not write any file output during this step",
     "Legacy Step 5 instruction. Step 5 now streams sections to disk."),
    ("complete in-memory draft",
     "Draft-approval anti-pattern. Stream sections to disk instead."),
    ("STOP HERE until",
     "Mid-workflow approval gate. Removed by Canonical Block F."),
    ("Write in sequential chunks if needed",
     "Legacy Canonical Block D hedge. Replace with 'Emit one template section per write'."),
]

PROMPT_PROBE_REINFORCEMENT_REQUIRED = {
    "brainstorm-idea.md":     "one question at a time",
    "create-spec.md":         "one gap at a time",
    "create-epics.md":        "one gap at a time",
    "create-figma-spec.md":   "one gap at a time",
    "create-project-plan.md": "one gap at a time",
    "create-sprint-plan.md":  "one gap at a time",
    "create-test-plan.md":    "one gap at a time",
    "design-architecture.md": "one gap at a time",
}

SKILL_REQUIRED = [
    "Exactly 3 concrete options + 1 Custom = 4 total",
    "AskUserQuestion",
    "Anti-patterns",
]

SKILL_FORBIDDEN_RX = [
    (re.compile(r"2\s*[-–]\s*4 options"), "Old 2-4 options range. Contract is exactly 3+Custom = 4 total."),
]


def check_prompts() -> list[tuple[str, str, str]]:
    violations: list[tuple[str, str, str]] = []
    for md in sorted(PROMPTS.glob("*.md")):
        text = md.read_text(encoding="utf-8")
        for needle, reason in PROMPT_FORBIDDEN:
            if needle in text:
                violations.append((md.name, f"forbidden: '{needle}'", reason))
        required = PROMPT_PROBE_REINFORCEMENT_REQUIRED.get(md.name)
        if required:
            if "AskUserQuestion" not in text or required not in text:
                violations.append((md.name,
                                   "missing probe-user reinforcement block",
                                   f"Prepend the canonical block; must contain 'AskUserQuestion' and '{required}'."))
    return violations


def check_skill() -> list[tuple[str, str, str]]:
    violations: list[tuple[str, str, str]] = []
    if not PROBE_SKILL.exists():
        return [(PROBE_SKILL.name, "missing file", "probe-user SKILL.md not found")]
    text = PROBE_SKILL.read_text(encoding="utf-8")
    for needed in SKILL_REQUIRED:
        if needed not in text:
            violations.append((PROBE_SKILL.name,
                               f"missing required phrase: '{needed}'",
                               "SKILL.md must specify the 3+1 contract and anti-patterns."))
    for rx, reason in SKILL_FORBIDDEN_RX:
        if rx.search(text):
            violations.append((PROBE_SKILL.name, f"forbidden pattern: {rx.pattern}", reason))
    return violations


def main() -> int:
    violations = check_prompts() + check_skill()
    if not violations:
        print("OK: streaming-write + probe-user contracts clean across prompts and SKILL.md.")
        return 0

    print("STREAMING-WRITE / PROBE-USER CONTRACT VIOLATIONS:\n")
    print(f"{'file':40s}  {'issue':55s}  reason")
    print(f"{'-'*40}  {'-'*55}  {'-'*40}")
    for f, issue, reason in violations:
        print(f"{f:40s}  {issue:55s}  {reason}")
    print(f"\n{len(violations)} violation(s).")
    return 1


if __name__ == "__main__":
    sys.exit(main())
