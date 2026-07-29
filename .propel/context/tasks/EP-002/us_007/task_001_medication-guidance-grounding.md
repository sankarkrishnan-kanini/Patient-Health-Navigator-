# TASK-001: Implement Profile-Grounded Medication Guidance

## Parent Story
- Story ID: US-007
- Story File: .propel/context/tasks/EP-002/us_007/us_007.md

## Technology Layer
- Conversation Backend and Context Retrieval

## Objective
Enable medication Q&A responses grounded in the active patient profile with relevant medication details.

## Scope
- Detect medication-intent queries.
- Retrieve active medication list for bound patient session.
- Build response context with medication name, schedule, and purpose fields.
- Add fallback messaging when profile has missing medication details.

## Out of Scope
- Medication dose-change recommendations.
- Drug-drug interaction engine.

## Acceptance Criteria
1. Medication questions return responses grounded in active profile data.
2. Response includes relevant medication details from patient context.
3. Missing medication context triggers safe, explanatory fallback.
4. No response includes hallucinated medication entities.
5. Trace logs include context source references for QA review.

## Traceability
- US-007 AC-001
- FR-004

## Effort
- Estimate: 8 hours
- Story Points Contribution: 1

## Dependencies
- US-006 completion

## Definition of Done
- Medication guidance logic committed.
- Sample medication Q&A scenarios validated.
