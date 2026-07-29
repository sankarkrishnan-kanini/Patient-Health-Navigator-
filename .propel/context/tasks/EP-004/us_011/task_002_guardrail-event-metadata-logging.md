# TASK-002: Implement Guardrail Event Metadata Logging

## Parent Story
- Story ID: US-011
- Story File: .propel/context/tasks/EP-004/us_011/us_011.md

## Technology Layer
- Safety Telemetry and Audit Events

## Objective
Capture guardrail metadata for each relevant interaction event with rule ID, triggered status, and reason.

## Scope
- Define guardrail event schema and relation to turn records.
- Persist rule ID, triggered flag, and reason text.
- Link guardrail events to conversation and turn references.
- Ensure event write path executes on all guardrail checks.

## Out of Scope
- Advanced event analytics dashboards.
- External SIEM forwarding.

## Acceptance Criteria
1. Guardrail events are persisted for each guardrail evaluation.
2. Event includes rule ID, triggered status, and reason.
3. Event record links to associated conversation or turn.
4. Non-triggered checks can be optionally recorded per policy.
5. Event schema supports future extension without breaking queries.

## Traceability
- US-011 AC-002
- FR-016
- NFR-004

## Effort
- Estimate: 5 hours
- Story Points Contribution: 0.75

## Dependencies
- TASK-001
- US-009
- US-010

## Definition of Done
- Guardrail event persistence committed.
- Metadata correctness validated with sample triggers.
