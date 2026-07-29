# TASK-005: Execute Integration Smoke and UX State Validation

## Parent Story
- Story ID: US-005
- Story File: .propel/context/tasks/EP-001/us_005/us_005.md

## Technology Layer
- QA and Verification

## Objective
Validate end-to-end behavior of profile selection, summary panel states, chat gating, and retry flow.

## Scope
- Run smoke checks for all target UI states: loading, loaded, load failure.
- Verify active profile indicator visibility during conversation.
- Confirm acceptance criteria pass evidence for the story.
- Document validation checklist for handoff.

## Out of Scope
- Full automated regression suite.
- Performance profiling.

## Acceptance Criteria
1. Selector-to-summary flow works for multiple profiles.
2. Active profile indicator remains visible after chat starts.
3. Chat gating behaves correctly across loading/failure/success paths.
4. Retry flow resolves failure and restores expected state.
5. Validation checklist captures pass/fail evidence for all US-005 criteria.

## Traceability
- US-005 AC-001
- US-005 AC-002
- US-005 AC-003
- US-005 AC-004
- US-005 AC-005

## Effort
- Estimate: 3 hours
- Story Points Contribution: 0.25

## Dependencies
- TASK-001
- TASK-002
- TASK-003
- TASK-004

## Definition of Done
- Smoke validation notes committed.
- Story marked ready for implementation review.
