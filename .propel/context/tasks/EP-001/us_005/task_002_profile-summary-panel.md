# TASK-002: Implement Profile Summary Panel

## Parent Story
- Story ID: US-005
- Story File: .propel/context/tasks/EP-001/us_005/us_005.md

## Technology Layer
- Frontend UI and Data Presentation

## Objective
Render selected patient profile details in a left-side summary panel adjacent to chat.

## Scope
- Build summary panel layout for conditions, medications, care tasks, and upcoming visits.
- Bind panel to selected patient payload.
- Add loading skeleton and empty-state behavior.
- Keep panel visible during conversation session.

## Out of Scope
- Clinical data transformation.
- Chat message rendering logic.

## Acceptance Criteria
1. Selected profile summary shows required data fields.
2. Left-side panel remains visible while chat is active.
3. Loading state is shown before summary data is ready.
4. Empty or missing sections show graceful placeholders.
5. Panel updates correctly when profile selection changes.

## Traceability
- US-005 AC-002
- US-005 AC-004
- FR-002
- UXR-001

## Effort
- Estimate: 6 hours
- Story Points Contribution: 1

## Dependencies
- TASK-001

## Definition of Done
- Summary panel component committed.
- UI state transitions verified: loading, loaded.
