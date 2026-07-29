# TASK-005: Enforce Diagnosis Boundary and Validation Tests

## Parent Story
- Story ID: US-007
- Story File: .propel/context/tasks/EP-002/us_007/us_007.md

## Technology Layer
- Safety Controls and QA

## Objective
Ensure unsupported diagnosis requests are not answered as factual diagnoses and validate behavior through targeted tests.

## Scope
- Add detection for diagnosis-intent requests in this guidance flow.
- Route diagnosis-intent to safe boundary response template.
- Add test scenarios for medication, condition, and diagnosis edge prompts.
- Verify no direct diagnosis statements are emitted in blocked scenarios.

## Out of Scope
- Emergency escalation rules beyond this story scope.
- Full guardrail framework implementation.

## Acceptance Criteria
1. Unsupported diagnosis requests do not return factual diagnosis answers.
2. Boundary response is clear and consistent.
3. Test suite includes positive and negative diagnosis-intent cases.
4. Medication and condition guidance remains unaffected by boundary logic.
5. Validation report confirms pass for all US-007 criteria.

## Traceability
- US-007 AC-005
- FR-004
- FR-005
- NFR-005

## Effort
- Estimate: 6 hours
- Story Points Contribution: 1.25

## Dependencies
- TASK-001
- TASK-002
- TASK-003
- TASK-004

## Definition of Done
- Boundary handling and tests committed.
- Test evidence attached for story sign-off.
