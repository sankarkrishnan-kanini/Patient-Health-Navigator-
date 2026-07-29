# TASK-003: Enforce Session and Context Propagation on Chat Requests

## Parent Story
- Story ID: US-006
- Story File: .propel/context/tasks/EP-001/us_006/us_006.md

## Technology Layer
- API Middleware and Request Orchestration

## Objective
Guarantee that every chat request carries valid conversation ID and bound patient context before response generation.

## Scope
- Add middleware to validate conversation ID on each chat request.
- Resolve bound patient and snapshot reference for each request.
- Inject session and patient context into downstream request pipeline.
- Return safe errors when binding is missing or stale.

## Out of Scope
- Prompt engineering and model behavior changes.
- UI rendering logic.

## Acceptance Criteria
1. Every chat request validates conversation ID presence.
2. Bound patient context is attached to request processing.
3. Missing or invalid binding blocks chat processing.
4. Context injection is consistent across multi-turn exchanges.
5. Request logs include conversation ID and patient binding reference.

## Traceability
- US-006 AC-003
- FR-003
- FR-008
- NFR-006

## Effort
- Estimate: 6 hours
- Story Points Contribution: 0.75

## Dependencies
- TASK-002

## Definition of Done
- Middleware and injection logic committed.
- Multi-request flow validated with trace logs.
