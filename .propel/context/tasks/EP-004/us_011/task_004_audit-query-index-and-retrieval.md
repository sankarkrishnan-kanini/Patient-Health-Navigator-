# TASK-004: Implement Query Paths by Conversation and Time Range

## Parent Story
- Story ID: US-011
- Story File: .propel/context/tasks/EP-004/us_011/us_011.md

## Technology Layer
- Data Access and Observability

## Objective
Provide efficient retrieval of audit records filtered by conversation ID and time window.

## Scope
- Add query interfaces for conversation-based and time-range filtering.
- Create storage indexes supporting retrieval patterns.
- Include pagination and ordering for review workflows.
- Return linked turn and guardrail records in query responses.

## Out of Scope
- Rich analytics visualizations.
- Cross-service federation queries.

## Acceptance Criteria
1. Logs are queryable by conversation ID.
2. Logs are queryable by configurable time range.
3. Query responses preserve chronological order.
4. Retrieval endpoints are documented for reviewers.
5. Query performance is acceptable for demo-scale datasets.

## Traceability
- US-011 AC-004
- NFR-009
- TR-006

## Effort
- Estimate: 4 hours
- Story Points Contribution: 0.5

## Dependencies
- TASK-001
- TASK-002
- TASK-003

## Definition of Done
- Query layer committed.
- Conversation and time-range retrieval validated.
