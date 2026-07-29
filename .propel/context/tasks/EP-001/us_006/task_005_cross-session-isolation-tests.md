# TASK-005: Validate Cross-Session Isolation

## Parent Story
- Story ID: US-006
- Story File: .propel/context/tasks/EP-001/us_006/us_006.md

## Technology Layer
- QA and Reliability Testing

## Objective
Create verification scenarios that prove no patient context or turn memory leaks across concurrent sessions.

## Scope
- Add integration tests for two or more concurrent sessions.
- Validate unique conversation IDs per session.
- Validate context separation for same-user and multi-user scenarios.
- Validate reset behavior does not affect unrelated sessions.

## Out of Scope
- Full load testing under production traffic.
- Browser-level end-to-end UX tests.

## Acceptance Criteria
1. Isolation tests verify no cross-session context leakage.
2. Concurrent sessions maintain independent patient bindings.
3. Turn memory remains session-scoped across requests.
4. Session reset affects only target session.
5. Test results are documented for story sign-off.

## Traceability
- US-006 AC-005
- FR-003
- FR-008
- NFR-006

## Effort
- Estimate: 5 hours
- Story Points Contribution: 0.5

## Dependencies
- TASK-001
- TASK-002
- TASK-003
- TASK-004

## Definition of Done
- Isolation test suite committed.
- Test evidence attached for implementation review.
