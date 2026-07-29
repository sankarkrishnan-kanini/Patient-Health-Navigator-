# TASK-001: Implement Conversation Session ID Generation

## Parent Story
- Story ID: US-006
- Story File: .propel/context/tasks/EP-001/us_006/us_006.md

## Technology Layer
- Backend API and Session Initialization

## Objective
Create deterministic session-start logic that issues a unique conversation ID for each new chat session.

## Scope
- Add session-start endpoint or initialization path.
- Generate unique conversation IDs using collision-safe strategy.
- Return ID to client and persist minimal session metadata.
- Add validation for malformed or reused client-provided IDs.

## Out of Scope
- Patient context binding details.
- Turn memory storage model.

## Acceptance Criteria
1. New session start returns a unique conversation ID.
2. Generated IDs are traceable in logs.
3. Session ID generation handles concurrent starts safely.
4. Invalid initialization payloads return structured errors.
5. ID format is documented for downstream consumers.

## Traceability
- US-006 AC-001
- FR-008

## Effort
- Estimate: 4 hours
- Story Points Contribution: 0.5

## Dependencies
- US-005 completion

## Definition of Done
- Session init path committed.
- Uniqueness verified with repeated local starts.
