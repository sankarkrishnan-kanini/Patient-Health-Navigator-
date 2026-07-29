# TASK-002: Enforce Medication Dosage and Stop/Change Boundaries

## Parent Story
- Story ID: US-010
- Story File: .propel/context/tasks/EP-003/us_010/us_010.md

## Technology Layer
- Safety Rule Engine and Messaging

## Objective
Block requests that ask for medication dose changes, stopping medication, or similar prohibited medication directives.

## Scope
- Detect dosage adjustment and medication stop intents.
- Return refusal template with escalation guidance.
- Preserve safe educational context without treatment directive output.
- Add explicit rule IDs for medication boundary categories.

## Out of Scope
- Drug interaction computation.
- Personalized dosage recommendation.

## Acceptance Criteria
1. Dosage-change requests return refusal response.
2. Medication-stop requests return refusal response.
3. Responses include guidance to contact care team.
4. Medication boundary events are logged with reason.
5. Safety tests cover diverse phrasing variants.

## Traceability
- US-010 AC-002
- FR-012
- AIR-002
- AIR-005

## Effort
- Estimate: 6 hours
- Story Points Contribution: 1

## Dependencies
- TASK-001

## Definition of Done
- Medication boundary enforcement committed.
- Negative test matrix passes for dosage/stop intents.
