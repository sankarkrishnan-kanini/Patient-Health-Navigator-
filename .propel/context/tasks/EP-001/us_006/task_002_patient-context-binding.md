# TASK-002: Persist Patient Binding and Context Snapshot Reference

## Parent Story
- Story ID: US-006
- Story File: .propel/context/tasks/EP-001/us_006/us_006.md

## Technology Layer
- Session State and Data Binding

## Objective
Bind each conversation session to one selected patient and store a context snapshot reference for consistent response grounding.

## Scope
- Extend session model with patient ID and context snapshot reference.
- Validate that selected patient exists in showcase dataset.
- Persist binding at session start and on profile change events.
- Expose read API for current session binding.

## Out of Scope
- LLM invocation logic.
- Guardrail processing.

## Acceptance Criteria
1. Session record stores selected patient ID.
2. Session record stores context snapshot reference/version.
3. Binding cannot be empty for active chat sessions.
4. Invalid patient IDs are rejected with clear error.
5. Binding data is queryable by conversation ID.

## Traceability
- US-006 AC-002
- FR-003
- NFR-006

## Effort
- Estimate: 5 hours
- Story Points Contribution: 0.75

## Dependencies
- TASK-001

## Definition of Done
- Session binding model and persistence committed.
- Session-to-patient lookup validated manually.
