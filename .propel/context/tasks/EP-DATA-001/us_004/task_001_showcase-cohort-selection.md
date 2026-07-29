# TASK-001: Build Showcase Cohort Selection Pipeline

## Parent Story
- Story ID: US-004
- Story File: .propel/context/tasks/EP-DATA-001/us_004/us_004.md

## Technology Layer
- Data Selection and Curation

## Objective
Select and materialize a showcase cohort containing 5 to 10 synthetic patients suitable for demo conversations.

## Scope
- Define selection query for eligible patient records.
- Enforce cohort size constraints between 5 and 10 patients.
- Persist curated cohort list for repeatable demo usage.
- Emit cohort generation summary metrics.

## Out of Scope
- Profile field completeness checks.
- UI payload shaping.

## Acceptance Criteria
1. Cohort output contains at least 5 and no more than 10 profiles.
2. Selection run produces stable artifact list for downstream steps.
3. Cohort generation logs include selected patient count.
4. Cohort generation can be rerun in local environment.
5. Failed records are excluded with reason logging.

## Traceability
- US-004 AC-001
- DR-002

## Effort
- Estimate: 4 hours
- Story Points Contribution: 0.5

## Dependencies
- US-003 completion

## Definition of Done
- Cohort selection script committed.
- Sample run output stored and reviewed.
