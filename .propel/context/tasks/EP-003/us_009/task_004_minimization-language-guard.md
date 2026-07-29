# TASK-004: Add Minimization Language Safety Guard

## Parent Story
- Story ID: US-009
- Story File: .propel/context/tasks/EP-003/us_009/us_009.md

## Technology Layer
- Response Safety Validation

## Objective
Prevent emergency responses from containing minimization language that could downplay risk.

## Scope
- Define blocked minimization phrase list.
- Validate escalation templates and responses against blocked list.
- Add fail-safe rewrite or hard-block when minimization is detected.
- Log validation outcomes for QA auditing.

## Out of Scope
- General sentiment analysis.
- Non-emergency tone optimization.

## Acceptance Criteria
1. Emergency responses contain no minimization phrases.
2. Validation runs on every emergency response path.
3. Detected violations trigger deterministic correction path.
4. Validation results are logged with rule references.
5. Negative tests prove blocked phrases are filtered.

## Traceability
- US-009 AC-004
- AIR-004
- NFR-001

## Effort
- Estimate: 4 hours
- Story Points Contribution: 0.5

## Dependencies
- TASK-003

## Definition of Done
- Minimization guard committed.
- Safety validation tests pass.
