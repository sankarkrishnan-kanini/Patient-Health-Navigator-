# TASK-001: Implement Care Plan and Appointment Grounding

## Parent Story
- Story ID: US-008
- Story File: .propel/context/tasks/EP-002/us_008/us_008.md

## Technology Layer
- Conversation Backend and Context Retrieval

## Objective
Answer care-plan and appointment questions using active profile schedule and care task context.

## Scope
- Detect appointment and care-plan intents.
- Resolve active schedule and task records from bound patient context.
- Generate grounded responses with date/time and task relevance.
- Add fallback behavior for missing schedule/task data.

## Out of Scope
- Appointment booking integration.
- Live calendar synchronization.

## Acceptance Criteria
1. Appointment questions use active profile schedule data.
2. Care plan questions use active profile task data.
3. Missing schedule/task data returns clear fallback guidance.
4. Response content references context source fields where applicable.
5. Regression prompts confirm deterministic grounded outputs.

## Traceability
- US-008 AC-001
- FR-006

## Effort
- Estimate: 8 hours
- Story Points Contribution: 1

## Dependencies
- US-006
- US-007

## Definition of Done
- Care-plan and appointment grounding logic committed.
- Sample scenarios validated with profile data.
