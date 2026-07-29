# TASK-004: Add Post-Generation Guardrail Blocking and Override

## Parent Story
- Story ID: US-010
- Story File: .propel/context/tasks/EP-003/us_010/us_010.md

## Technology Layer
- Conversation Orchestration and Safety Validation

## Objective
Inspect draft model responses and block or replace content that violates diagnosis, medication, or lab boundaries.

## Scope
- Add post-generation validation step in response pipeline.
- Evaluate draft output against prohibited advice rules.
- Replace violating output with deterministic boundary template.
- Record override reason and original violation category in audit metadata.

## Out of Scope
- Semantic deep reasoning engine.
- Post-session human review tooling.

## Acceptance Criteria
1. Prohibited model output is detected post-generation.
2. Violating responses are blocked and replaced deterministically.
3. Non-violating responses continue without unnecessary override.
4. Override events include violation category metadata.
5. Integration tests confirm override behavior for all boundary classes.

## Traceability
- US-010 AC-004
- AIR-006
- FR-011
- FR-012
- FR-013

## Effort
- Estimate: 7 hours
- Story Points Contribution: 1.25

## Dependencies
- TASK-001
- TASK-002
- TASK-003

## Definition of Done
- Post-generation guard module committed.
- Override integration tests pass.
