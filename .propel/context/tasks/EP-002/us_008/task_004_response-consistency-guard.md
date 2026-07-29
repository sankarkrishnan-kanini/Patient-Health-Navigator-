# TASK-004: Add In-Session Response Consistency Guard

## Parent Story
- Story ID: US-008
- Story File: .propel/context/tasks/EP-002/us_008/us_008.md

## Technology Layer
- Conversation Quality Controls

## Objective
Prevent contradictory answers within the same conversation session.

## Scope
- Add consistency-check step comparing new draft response with recent answer history.
- Flag potential contradictions and trigger rewrite pass.
- Log consistency check outcomes for QA analysis.
- Provide safe fallback when consistency cannot be guaranteed.

## Out of Scope
- Full truth-maintenance knowledge graph.
- Cross-session consistency guarantees.

## Acceptance Criteria
1. Contradictory answers within session are detected.
2. Rewrite or fallback path resolves detected contradictions.
3. Consistency checks operate on recent turn window.
4. Consistency events are logged for review.
5. Regression prompts show reduced contradiction frequency.

## Traceability
- US-008 AC-004
- FR-008
- NFR-006

## Effort
- Estimate: 6 hours
- Story Points Contribution: 0.75

## Dependencies
- TASK-003

## Definition of Done
- Consistency guard module committed.
- Contradiction test scenarios pass.
