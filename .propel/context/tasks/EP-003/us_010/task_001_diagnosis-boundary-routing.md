# TASK-001: Implement Diagnosis Boundary Routing and Handoff

## Parent Story
- Story ID: US-010
- Story File: .propel/context/tasks/EP-003/us_010/us_010.md

## Technology Layer
- Safety Rule Engine and Response Routing

## Objective
Detect diagnosis-intent requests and route them to deterministic boundary responses with care-team handoff guidance.

## Scope
- Add diagnosis-intent patterns and classifier rules.
- Route matched requests to boundary response templates.
- Include care-team contact and escalation guidance hooks.
- Ensure deterministic behavior independent of LLM output.

## Out of Scope
- Emergency symptom escalation handling (covered by US-009).
- New diagnosis inference capabilities.

## Acceptance Criteria
1. Diagnosis-intent requests are detected reliably.
2. Requests return boundary response with care-team handoff.
3. No diagnostic conclusion is returned for blocked requests.
4. Boundary routing decision is logged with rule metadata.
5. Regression prompts validate consistent boundary behavior.

## Traceability
- US-010 AC-001
- FR-011
- FR-014
- AIR-001
- AIR-005

## Effort
- Estimate: 6 hours
- Story Points Contribution: 1

## Dependencies
- US-009 completion

## Definition of Done
- Diagnosis boundary routing committed.
- Rule and response tests pass.
