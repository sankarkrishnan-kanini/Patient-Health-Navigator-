# TASK-002: Configure E2E Smoke Test Framework

## Parent Story
- Story ID: US-002
- Story File: .propel/context/tasks/EP-TECH-001/us_002/us_002.md

## Technology Layer
- End-to-End Test Automation

## Objective
Set up an E2E framework and implement one smoke flow that validates app startup and basic route availability.

## Scope
- Configure E2E tooling with project defaults.
- Add a smoke test for base page load and health-check response path.
- Add scripts for headed/headless local execution.
- Add baseline report output settings.

## Out of Scope
- Full user journey regression pack.
- Cross-browser matrix optimization.

## Acceptance Criteria
1. E2E framework runs in local environment.
2. Smoke scenario validates app shell load.
3. Smoke scenario validates service health endpoint behavior.
4. Test output artifacts are generated for failure triage.
5. E2E run steps are documented for developers.

## Traceability
- US-002 AC-002
- NFR-009

## Effort
- Estimate: 5 hours
- Story Points Contribution: 1

## Dependencies
- TASK-001

## Definition of Done
- E2E config and smoke test committed.
- Successful local smoke run demonstrated.
