# TASK-005: Add Required-Field Validation Gate Before Audit Persistence

## Parent Story
- Story ID: US-011
- Story File: .propel/context/tasks/EP-004/us_011/us_011.md

## Technology Layer
- Data Quality and Reliability

## Objective
Enforce required-field validation so incomplete audit records fail before persistence.

## Scope
- Define mandatory audit fields for turn and guardrail records.
- Implement validation middleware or repository guard.
- Return structured validation errors with missing field details.
- Add tests for valid and invalid audit writes.

## Out of Scope
- Automatic data repair.
- Historical backfill remediation.

## Acceptance Criteria
1. Missing required fields cause write rejection.
2. Validation errors identify missing or invalid fields.
3. Valid records persist successfully with no false rejects.
4. Validation applies to both turn and guardrail record types.
5. Test suite covers pass/fail validation scenarios.

## Traceability
- US-011 AC-005
- NFR-004
- NFR-009

## Effort
- Estimate: 4 hours
- Story Points Contribution: 0.25

## Dependencies
- TASK-001
- TASK-002

## Definition of Done
- Validation gate committed.
- Test evidence attached for story sign-off.
