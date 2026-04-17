"""
One-shot migration: rewrite legacy in-memory patterns to streaming-write + just-in-time-reads
per the updated propeliq-workflow-design-philosophy.md.

Run from repo root:  python .propel/scripts/migrate_streaming_write.py

Mechanical replacements only. Prompts that need bespoke Step 5/6/7 renumbering
(create-spec.md, build-prototype.md, create-user-stories.md, plan-development-task.md,
implement-tasks.md) are already migrated by hand and are skipped here.
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROMPTS_DIR = ROOT / ".propel" / "prompts"

# Only files with bespoke Step 5/6/7 renumbering are skipped — others are idempotent mechanical edits.
ALREADY_MIGRATED = {
    "create-spec.md",
    "implement-tasks.md",
}

CANONICAL_A_NEW = (
    "Generate the output in template section order. After each H2 section is produced, "
    "write it to `$OUTPUT_PATH` (first H2 = CREATE, subsequent H2s = APPEND). "
    "Discard the section from memory before starting the next. Never hold more than one section in memory. "
    "The file on disk is the source of truth."
)

CANONICAL_A_OLD_VARIANTS = [
    "Do not write any file output during this step. Hold all generated content in memory only.",
    "> **Do not write any file output during this step. Hold all generated content in memory only. The document is written in Step 7.**",
    "Do not write any file output during this step. Hold all generated content in memory only. The document is written in Step 7.",
    "**Do not write any file output during this step. Hold all generated content in memory only. The document is written in Step 7.**",
]
CANONICAL_A_BLOCKQUOTE_NEW = f"> **{CANONICAL_A_NEW}**"

CANONICAL_D_OLD = (
    "Every item from the planning inventory must be fully specified with all template-defined sub-sections populated. "
    "Do not silently degrade quality by summarising later items when approaching output limits. "
    "Write in sequential chunks if needed — never omit detail."
)
CANONICAL_D_NEW = (
    "Every item from the planning inventory must be fully specified with all template-defined sub-sections populated. "
    "Do not silently degrade quality by summarising later items when approaching output limits. "
    "Emit one template section per write. Never buffer more than one section in memory."
)

CORPUS_SUBORDINATION_OLD = (
    "`$CONTEXT_CORPUS` is subordinate to the task file — ambient background knowledge only. "
    "Do not surface corpus content as new requirements; "
    "use it to validate assumptions, resolve ambiguity, and establish existing context."
)
CORPUS_SUBORDINATION_FALLBACK = "`$CONTEXT_CORPUS` is subordinate to"

NO_FILE_OUTPUT_CHECKLIST_OLD = "- [ ] No file output has been written"
NO_FILE_OUTPUT_CHECKLIST_NEW = "- [ ] No in-memory buffer of the full document exists — only one section was held in memory at a time"

CORPUS_VAR_TABLE_PATTERNS = [
    ("| `$CONTEXT_CORPUS` | Populated in Step 2.1 | Accumulated ambient knowledge from required documents |",
     "| `$REFERENCE_DOCS` | Populated in Step 0 | Map of `{ artifact_key → propelFilePath }`. Paths only. Used by Step 2.1 section access guidance for just-in-time slice reads. |"),
    ("| `$CONTEXT_CORPUS` | Populated in Step 2.1 | Selective context from reference documents |",
     "| `$REFERENCE_DOCS` | Populated in Step 0 | Map of `{ artifact_key → propelFilePath }`. Paths only. Used by Step 2.1 section access guidance for just-in-time slice reads. |"),
    ("| `$CONTEXT_CORPUS` | Populated in Step 1.1 | Selective context from reference documents |",
     "| `$REFERENCE_DOCS` | Populated in Step 0 | Map of `{ artifact_key → propelFilePath }`. Paths only. Used by Step 1.1 section access guidance for just-in-time slice reads. |"),
]

APPEND_CORPUS_OLD_LIST = [
    "4. Append to `$CONTEXT_CORPUS` in declared order.",
    "4. Append to `$CONTEXT_CORPUS` in discovery order.",
]
APPEND_CORPUS_NEW = "4. Consume any needed slice inline via targeted `Grep` / bounded `Read`; do NOT retain content in a long-lived variable. Section access guidance below governs how slices are fetched at the moment of need."

ONDEMAND_CORPUS_OLD_LIST = [
    "During Steps 3–5, if analysis or generation references a concept, ID, or section that may exist in an unloaded reference document → load it on demand and append to `$CONTEXT_CORPUS`.",
    "During Steps 3.2–5, if analysis or generation references a concept, ID, or section that may exist in an unloaded reference document → load it on demand and append to `$CONTEXT_CORPUS`.",
    "During Steps 2–4, if implementation references a concept, ID, or section that may exist in an unloaded reference document → load it on demand from `$REFERENCE_DOCS` and append to `$CONTEXT_CORPUS`.",
    "During Steps 3–N, if analysis or generation references a concept, ID, or section that may exist in an unloaded reference document → load it on demand and append to `$CONTEXT_CORPUS`.",
]
ONDEMAND_CORPUS_NEW = "During later analysis/generation steps, fetch only the specific slice needed via targeted `Grep` or bounded `Read` against `$REFERENCE_DOCS[key]`. Consume the slice inline; do NOT retain across steps."

SUBORDINATION_OLD_LIST = [
    "`$CONTEXT_CORPUS` is subordinate to `$ARGUMENTS` — ambient background knowledge only. Do not surface corpus content as new requirements; use it to validate assumptions, resolve ambiguity, and establish existing context.",
    "`$CONTEXT_CORPUS` is subordinate to the task file — ambient background knowledge only. Do not surface corpus content as new requirements; use it to validate assumptions, resolve ambiguity, and establish existing context.",
    "`$CONTEXT_CORPUS` is subordinate to `$ARGUMENTS` — ambient background knowledge only. Do not surface corpus content as new requirements; use it to validate assumptions, resolve ambiguity, and establish existing context. Draw on it in later steps when explicit evidence from `$ARGUMENTS` is insufficient.",
]
SUBORDINATION_NEW = "**Forbidden**: accumulating reference content into any long-lived variable (e.g. the deprecated `$CONTEXT_CORPUS`). Slices fetched during one sub-step are NOT carried forward. If a later sub-step needs the same slice, it re-queries."


def migrate_file(path: Path) -> tuple[int, list[str]]:
    text = path.read_text(encoding="utf-8")
    original = text
    notes: list[str] = []

    for old in CANONICAL_A_OLD_VARIANTS:
        if old in text:
            replacement = CANONICAL_A_BLOCKQUOTE_NEW if old.startswith(">") or old.startswith("**") else CANONICAL_A_NEW
            text = text.replace(old, replacement)
            notes.append("Canonical Block A rewritten")
            break

    if CANONICAL_D_OLD in text:
        text = text.replace(CANONICAL_D_OLD, CANONICAL_D_NEW)
        notes.append("Canonical Block D rewritten")

    if NO_FILE_OUTPUT_CHECKLIST_OLD in text:
        text = text.replace(NO_FILE_OUTPUT_CHECKLIST_OLD, NO_FILE_OUTPUT_CHECKLIST_NEW)
        notes.append("Step 5 pre-advancement checkbox flipped")

    for old, new in CORPUS_VAR_TABLE_PATTERNS:
        if old in text:
            text = text.replace(old, new)
            notes.append("Variable table: CONTEXT_CORPUS → REFERENCE_DOCS")

    for old in APPEND_CORPUS_OLD_LIST:
        if old in text:
            text = text.replace(old, APPEND_CORPUS_NEW)
            notes.append("Append-to-corpus replaced with inline consumption")

    for old in ONDEMAND_CORPUS_OLD_LIST:
        if old in text:
            text = text.replace(old, ONDEMAND_CORPUS_NEW)
            notes.append("On-demand append replaced with just-in-time slice reads")

    for old in SUBORDINATION_OLD_LIST:
        if old in text:
            text = text.replace(old, SUBORDINATION_NEW)
            notes.append("Subordination clause replaced with forbidden-accumulation note")

    if "$CONTEXT_CORPUS" in text:
        remaining = text.count("$CONTEXT_CORPUS")
        notes.append(f"REVIEW: {remaining} $CONTEXT_CORPUS references remain (contextual usage; Step 2.1 section-access table required)")

    if text != original:
        path.write_text(text, encoding="utf-8")
        return 1, notes
    return 0, notes


def main() -> int:
    if not PROMPTS_DIR.exists():
        print(f"Prompts dir not found: {PROMPTS_DIR}", file=sys.stderr)
        return 1

    total = 0
    for md in sorted(PROMPTS_DIR.glob("*.md")):
        if md.name in ALREADY_MIGRATED:
            print(f"skip  {md.name:40s} (already migrated by hand)")
            continue
        changed, notes = migrate_file(md)
        total += changed
        marker = "EDIT" if changed else "--  "
        print(f"{marker}  {md.name:40s} {'; '.join(notes) if notes else ''}")

    print(f"\n{total} file(s) modified.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
