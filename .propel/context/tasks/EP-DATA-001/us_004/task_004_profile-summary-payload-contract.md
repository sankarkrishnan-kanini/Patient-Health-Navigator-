# TASK-004: Generate Profile Summary Payload Contract

## Parent Story
- Story ID: US-004
- Story File: .propel/context/tasks/EP-DATA-001/us_004/us_004.md

## Technology Layer
- API Contract and Serialization

## Objective
Build a standardized payload for UI profile summary display used by patient selection and chat context preview.

## Scope
- Define summary payload schema for conditions, medications, care tasks, appointments, and key observations.
- Implement serializer from normalized context store.
- Add schema validation for payload response objects.
- Produce sample payload fixtures for frontend integration.

## Out of Scope
- Final UI component implementation.
- Localization of summary content.

## Acceptance Criteria
1. Summary payload schema is documented and versioned.
2. Payload includes fields required by chat personalization display.
3. Payload validation catches missing or malformed fields.
4. Sample fixtures are available for frontend integration.
5. Endpoint or export provides one summary object per selected profile.

## Implementation Evidence Checklist (2026-07-29)
1. AC-001: **Pass**
	- Evidence: Versioned summary schema documented and exported via `profile-summary-schema.json`.
2. AC-002: **Pass**
	- Evidence: Serializer includes personalization fields for conditions, medications, care tasks, appointments, observations, and SDOH flags.
3. AC-003: **Pass**
	- Evidence: Summary payload validation implemented with malformed-field diagnostics.
4. AC-004: **Pass**
	- Evidence: Frontend sample fixtures added for at least two profiles.
5. AC-005: **Pass**
	- Evidence: Summary export produces one payload object per selected profile.

Supporting notes: `task_004_summary-payload-run-notes.md`

## Traceability
- US-004 AC-004
- FR-002
- DR-003

## Effort
- Estimate: 5 hours
- Story Points Contribution: 0.5

## Dependencies
- TASK-003

## Definition of Done
- Serializer and schema artifacts committed.
- Payload samples verified with at least two profiles.
