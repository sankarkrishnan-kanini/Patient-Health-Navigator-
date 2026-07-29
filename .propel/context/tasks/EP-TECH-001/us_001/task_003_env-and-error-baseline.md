# TASK-003: Configure Environment Profiles and Error Baseline

## Parent Story
- Story ID: US-001
- Story File: .propel/context/tasks/EP-TECH-001/us_001/us_001.md

## Technology Layer
- Configuration and Reliability

## Objective
Set up local and production-oriented environment profile templates and baseline API error handling.

## Scope
- Define `.env.example` with required non-secret keys.
- Add runtime config loader with safe defaults.
- Implement reusable API error handler for route exceptions.
- Ensure startup validation for required environment variables.

## Out of Scope
- Secret manager integration.
- Advanced observability platform configuration.

## Acceptance Criteria
1. `.env.example` contains documented variables required for startup.
2. Missing required variables produce clear startup or request-time error messages.
3. Shared error helper maps exceptions to consistent JSON error shape.
4. Local and production profile guidance is documented.
5. API route errors no longer return raw stack traces by default.

## Traceability
- US-001 AC-003
- US-001 AC-005
- NFR-010

## Effort
- Estimate: 4 hours
- Story Points Contribution: 1

## Dependencies
- TASK-002

## Definition of Done
- Environment template committed.
- Error handling utility used by scaffolded routes.
- Manual negative test for missing env variable completed.
