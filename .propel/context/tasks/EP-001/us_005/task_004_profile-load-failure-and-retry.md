# TASK-004: Implement Profile Load Failure and Retry UX

## Parent Story
- Story ID: US-005
- Story File: .propel/context/tasks/EP-001/us_005/us_005.md

## Technology Layer
- Frontend Resilience and API Integration

## Objective
Handle profile-load errors with clear retry guidance while maintaining safe chat-disabled behavior.

## Scope
- Catch and classify profile fetch failures.
- Display explicit failure message with retry action.
- Keep chat disabled during failure state.
- Retry request with updated loading state and error reset.

## Out of Scope
- Centralized incident tracking integrations.
- Offline-first caching behavior.

## Acceptance Criteria
1. Profile load failure state is visibly distinct from loading and loaded states.
2. Failure message includes retry guidance.
3. Retry action attempts profile fetch again.
4. Chat remains disabled while failure is unresolved.
5. Successful retry restores summary panel and chat gating flow.

## Traceability
- US-005 AC-005
- FR-002
- UXR-001

## Effort
- Estimate: 4 hours
- Story Points Contribution: 0.5

## Dependencies
- TASK-002
- TASK-003

## Definition of Done
- Error and retry state handling committed.
- Failure and recovery flow validated manually.
