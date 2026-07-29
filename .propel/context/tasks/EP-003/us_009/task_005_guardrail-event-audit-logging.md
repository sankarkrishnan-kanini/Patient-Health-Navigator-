# TASK-005: Persist Guardrail Activation Audit Events

## Parent Story
- Story ID: US-009
- Story File: .propel/context/tasks/EP-003/us_009/us_009.md

## Technology Layer
- Observability and Audit Logging

## Objective
Capture emergency guardrail activation events with rule ID and reason for governance and review.

## Scope
- Emit guardrail event payload on emergency trigger.
- Persist rule ID, trigger reason, conversation ID, and timestamp.
- Link event to user turn and assistant response IDs where available.
- Add query path for reviewing emergency activations.

## Out of Scope
- External SIEM forwarding.
- Long-term analytics aggregation.

## Acceptance Criteria
1. Every emergency trigger writes a guardrail activation event.
2. Event includes rule ID and trigger reason.
3. Event links to conversation context identifiers.
4. Missing audit fields fail persistence validation.
5. Test run confirms events are queryable for review.

## Traceability
- US-009 AC-005
- FR-016
- TR-001
- NFR-001

## Effort
- Estimate: 5 hours
- Story Points Contribution: 0.5

## Dependencies
- TASK-001
- TASK-002
- TASK-003

## Definition of Done
- Audit event logging committed.
- Emergency event query validated with sample run.
