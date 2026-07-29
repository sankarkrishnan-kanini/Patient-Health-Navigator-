# TASK-003: Add Off-Scope or Medication-Boundary Demo Scenario

## Parent Story
- Story ID: US-012
- Story File: .propel/context/tasks/EP-005/us_012/us_012.md

## Technology Layer
- Safety Boundary Demonstration

## Objective
Include one deterministic off-scope or medication-boundary scenario in demo flow and verify refusal behavior.

## Scope
- Define one off-scope or dosage-change prompt.
- Define expected refusal/boundary response and handoff guidance.
- Capture post-generation guard result where applicable.
- Add presenter cues for explaining scope boundaries.

## Out of Scope
- Full adversarial boundary test matrix.
- Real-time policy editing.

## Acceptance Criteria
1. Demo includes one boundary scenario.
2. Scenario output demonstrates deterministic refusal behavior.
3. Response includes clear care-team handoff messaging.
4. Boundary event evidence is captured.
5. Presenter notes explain why boundary is safety critical.

## Traceability
- US-012 AC-003
- SM-001
- QG-001

## Effort
- Estimate: 3 hours
- Story Points Contribution: 0.5

## Dependencies
- US-010

## Definition of Done
- Boundary scenario integrated into demo script.
- Scenario replay verifies expected guardrail outcome.
