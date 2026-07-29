# TASK-004: Implement Personalization Accuracy Verification Checks

## Parent Story
- Story ID: US-012
- Story File: .propel/context/tasks/EP-005/us_012/us_012.md

## Technology Layer
- Data Validation and QA

## Objective
Verify that referenced patient facts in demo conversations match the selected profile data.

## Scope
- Define fact-check checklist for medications, conditions, tasks, and appointments.
- Compare response claims against profile source-of-truth fields.
- Record mismatches with severity and scenario context.
- Produce pass/fail summary per scripted turn.

## Out of Scope
- Automated semantic truth scoring beyond required fact checks.
- Broad dataset audit outside demo scenarios.

## Acceptance Criteria
1. Personalization checks validate referenced patient facts.
2. Verification spans all scripted demo turns.
3. Mismatch findings are logged with evidence.
4. Turn-level pass/fail status is documented.
5. Verification artifacts are available for judge Q&A.

## Traceability
- US-012 AC-004
- SM-002
- QG-002

## Effort
- Estimate: 4 hours
- Story Points Contribution: 0.25

## Dependencies
- US-011

## Definition of Done
- Personalization verification checklist committed.
- Demo run includes completed fact-check evidence.
