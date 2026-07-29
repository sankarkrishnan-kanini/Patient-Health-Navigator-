# TASK-005: Build Deterministic Boundary Test Harness Scenarios

## Parent Story
- Story ID: US-010
- Story File: .propel/context/tasks/EP-003/us_010/us_010.md

## Technology Layer
- QA Automation and Safety Verification

## Objective
Add deterministic scenario tests that verify diagnosis, medication, and lab boundaries along pre-check and post-check paths.

## Scope
- Define scenario matrix for diagnosis, dose/stop, and lab interpretation requests.
- Add positive and adversarial prompt variants.
- Validate pre-generation boundary routing and post-generation override outcomes.
- Produce report summary for story sign-off.

## Out of Scope
- Full end-to-end demo scripting.
- Performance benchmarking.

## Acceptance Criteria
1. Boundary scenarios are codified in deterministic test harness.
2. Test cases include both direct and adversarial prompt phrasing.
3. Harness verifies expected boundary response per scenario.
4. Harness validates post-generation blocking behavior.
5. Test report is generated and attached for review.

## Traceability
- US-010 AC-005
- TR-007
- FR-011
- FR-012
- FR-013
- FR-014

## Effort
- Estimate: 6 hours
- Story Points Contribution: 0.75

## Dependencies
- TASK-001
- TASK-002
- TASK-003
- TASK-004

## Definition of Done
- Deterministic boundary harness committed.
- Scenario report confirms pass coverage.
