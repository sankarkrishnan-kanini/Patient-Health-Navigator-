# TASK-002: Create API Route Scaffolding and Health Check

## Parent Story
- Story ID: US-001
- Story File: .propel/context/tasks/EP-TECH-001/us_001/us_001.md

## Technology Layer
- Backend API (Next.js Route Handlers)

## Objective
Add API route scaffolding for future chat and patient profile endpoints and implement a health-check endpoint.

## Scope
- Create `/api/health` endpoint returning service status.
- Create placeholder routes for `/api/chat` and `/api/patient-profile`.
- Add standard JSON response utility for success and error outputs.

## Out of Scope
- Real patient data fetching.
- LLM invocation and guardrail rules.

## Acceptance Criteria
1. `/api/health` returns HTTP 200 with JSON status payload.
2. `/api/chat` and `/api/patient-profile` placeholders compile and return `501 Not Implemented` or equivalent.
3. Response format is consistent across created routes.
4. Route files align with App Router API conventions.
5. No runtime errors when invoking endpoints locally.

## Traceability
- US-001 AC-002
- US-001 AC-004
- TR-002

## Effort
- Estimate: 5 hours
- Story Points Contribution: 1

## Dependencies
- TASK-001

## Definition of Done
- Endpoints callable in local environment.
- Health-check response verified manually.
- Placeholder API contracts documented in comments.
