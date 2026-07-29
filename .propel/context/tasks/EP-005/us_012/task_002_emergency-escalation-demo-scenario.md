# TASK-002: Add Emergency Escalation Demo Scenario

## Parent Story
- Story ID: US-012
- Story File: .propel/context/tasks/EP-005/us_012/us_012.md

## Technology Layer
- Safety Demo Validation

## Objective
Integrate a deterministic emergency escalation scenario into the demo with clear pass/fail checkpoints.

## Scope
- Define emergency prompt input (for example chest pain plus breathing difficulty).
- Define expected escalation output and bypass behavior evidence.
- Add log verification step for guardrail trigger metadata.
- Include operator notes for presenting safety rationale.

## Out of Scope
- Broader emergency trigger coverage matrix.
- Non-demo safety test automation.

## Acceptance Criteria
1. Demo includes one emergency escalation scenario.
2. Scenario verifies immediate escalation language.
3. Scenario verifies normal generation is bypassed.
4. Guardrail trigger evidence is captured.
5. Demo notes include safety explanation for judges.

## Traceability
- US-012 AC-002
- SM-001
- QG-001

## Effort
- Estimate: 3 hours
- Story Points Contribution: 0.5

## Dependencies
- US-009

## Definition of Done
- Emergency demo scenario documented.
- Scenario dry run passes with expected output.
