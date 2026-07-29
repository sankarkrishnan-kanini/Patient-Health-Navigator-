# TASK-004: Implement Session Reset and Memory Clear Lifecycle

## Parent Story
- Story ID: US-006
- Story File: .propel/context/tasks/EP-001/us_006/us_006.md

## Technology Layer
- Session Lifecycle Management

## Objective
Provide a deterministic session reset operation that clears prior patient binding and turn memory.

## Scope
- Implement reset endpoint or action handler.
- Clear conversation turn memory store for target session.
- Remove patient binding and context snapshot reference on reset.
- Return reset confirmation with new-ready session state.

## Out of Scope
- Historical audit deletion.
- Full account-level data wipe.

## Acceptance Criteria
1. Session reset clears patient context binding.
2. Session reset clears previous turn memory.
3. Subsequent chat requests require re-selection or rebind.
4. Reset response confirms cleared state.
5. Reset action is idempotent for repeated calls.

## Traceability
- US-006 AC-004
- FR-008
- NFR-006

## Effort
- Estimate: 4 hours
- Story Points Contribution: 0.5

## Dependencies
- TASK-002
- TASK-003

## Definition of Done
- Reset flow committed.
- Post-reset behavior verified with manual checks.
