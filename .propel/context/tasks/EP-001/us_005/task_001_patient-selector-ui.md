# TASK-001: Build Patient Selector UI Component

## Parent Story
- Story ID: US-005
- Story File: .propel/context/tasks/EP-001/us_005/us_005.md

## Technology Layer
- Frontend UI

## Objective
Implement a patient selection control that presents the showcase cohort and allows selection before chat begins.

## Scope
- Create selector component for 5 to 10 profile options.
- Display patient label and concise context summary in selector options.
- Support explicit selection confirmation behavior.
- Expose selected patient state to parent chat shell.

## Out of Scope
- Profile details panel rendering.
- Chat API submission logic.

## Acceptance Criteria
1. User can choose a profile from the showcase list before chat starts.
2. Selector renders all available showcase profiles.
3. Selection state persists in the page session.
4. Selector interaction is keyboard accessible.
5. No chat submission is triggered by profile selection itself.

## Traceability
- US-005 AC-001
- FR-001
- UXR-001

## Effort
- Estimate: 5 hours
- Story Points Contribution: 0.75

## Dependencies
- US-004 completion

## Definition of Done
- Selector component committed.
- Manual selection flow verified in local UI.
