# TASK-003: Add Chat Gating Until Profile Load Completes

## Parent Story
- Story ID: US-005
- Story File: .propel/context/tasks/EP-001/us_005/us_005.md

## Technology Layer
- Frontend State Management

## Objective
Prevent chat interaction until selected profile data is fully loaded and valid.

## Scope
- Disable chat input and send action prior to successful profile load.
- Re-enable chat only after profile load success.
- Show inline guidance explaining why chat is disabled.
- Guard chat state on profile switch and reload.

## Out of Scope
- Backend guardrail logic.
- Conversation API implementation beyond gating signals.

## Acceptance Criteria
1. Chat remains disabled until profile loading completes.
2. Disabled state includes user-visible explanation.
3. Chat is re-disabled when user changes selected profile until reload finishes.
4. Chat input cannot be submitted via keyboard while disabled.
5. State transitions are deterministic across refresh and profile switch.

## Traceability
- US-005 AC-003
- FR-001
- FR-002

## Effort
- Estimate: 4 hours
- Story Points Contribution: 0.5

## Dependencies
- TASK-001
- TASK-002

## Definition of Done
- Gating logic committed.
- Manual negative tests confirm no early chat submission.
