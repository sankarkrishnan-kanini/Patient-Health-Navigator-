# TASK-003: Enforce Profile Completeness Gate

## Parent Story
- Story ID: US-004
- Story File: .propel/context/tasks/EP-DATA-001/us_004/us_004.md

## Technology Layer
- Data Validation

## Objective
Validate that each showcase profile contains all fields required for chat personalization and summary display.

## Scope
- Define required profile fields for personalization.
- Implement completeness validator and profile pass or fail status.
- Exclude incomplete profiles from final cohort.
- Output actionable missing-field diagnostics.

## Out of Scope
- Auto-filling missing fields.
- UI rendering logic.

## Acceptance Criteria
1. Required field checklist is codified and versioned.
2. Every selected profile passes completeness checks.
3. Incomplete profiles are rejected with detailed reasons.
4. Validation results are available as machine-readable artifact.
5. Completeness gate executes on every cohort refresh.

## Traceability
- US-004 AC-003
- DR-003
- FR-002

## Effort
- Estimate: 4 hours
- Story Points Contribution: 0.5

## Dependencies
- TASK-001

## Definition of Done
- Completeness validator committed.
- Validation report reviewed for all selected profiles.
