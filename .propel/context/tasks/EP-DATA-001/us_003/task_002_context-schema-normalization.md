# TASK-002: Normalize Resources into Patient Context Schema

## Parent Story
- Story ID: US-003
- Story File: .propel/context/tasks/EP-DATA-001/us_003/us_003.md

## Technology Layer
- Data Modeling and Transformation

## Objective
Transform staged FHIR resources into normalized patient context entities used by the navigator.

## Scope
- Define normalized entities for active conditions, medications, care tasks, appointments, observations, and SDOH flags.
- Implement transformation rules from source resources to normalized records.
- Handle active-status filtering and date-effective selection logic.
- Persist normalized context per patient with version stamp.

## Out of Scope
- Guardrail-specific business logic.
- Analytics de-identification exports.

## Acceptance Criteria
1. Normalized schema includes all required patient context domains.
2. Transformation outputs are grouped by patient identifier.
3. Active conditions and active medications are computed correctly.
4. Upcoming appointments and relevant observations are populated.
5. SDOH flags are captured when available in source data.

## Traceability
- US-003 AC-002
- DR-003
- TR-005

## Effort
- Estimate: 10 hours
- Story Points Contribution: 1.5

## Dependencies
- TASK-001

## Definition of Done
- Normalization jobs committed.
- Output schema reviewed against story acceptance criteria.
