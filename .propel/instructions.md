# PropelIQ — Agent Instructions

This project uses Decision Loop Engineering. Read and follow this file before starting any work.

## Rules

Rules in `.propel/rules/` are standards. During a workflow, the prompt's Guardrails section declares which rules apply. For ad-hoc work, `.propel/rules/decision-loop-principles.md` applies universally — all other rules apply when their domain or file type is touched.

## Workflows

Structured workflows live in `.propel/prompts/`. They are execution specifications — follow their steps exactly. Do not skip steps, reorder them, or add steps not defined in the workflow.

## Templates

Templates live in `.propel/templates/`. Templates are the sole authority on output structure. Do not add, reorder, or omit sections.

## Artifact Resolution

`.propel/project-config.json` is the artifact registry. It maps logical artifact names to file paths, templates, and inter-artifact dependencies. Use the artifact-resolver skill to resolve paths. Do not hardcode paths.

## Context Loading

Only load documents that the current task explicitly references. Lazy load — do not preload all available context. When a reference document cannot be found, log and continue. Do not stop the workflow unless the missing document is critical.

## Quality Gates

Every workflow has a quality gate. Gates are blocking — if a check fails, the workflow stops. Every gate produces auditable output to console. A workflow is incomplete until its evaluation output is printed.
