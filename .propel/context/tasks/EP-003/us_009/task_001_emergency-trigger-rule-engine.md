# TASK-001: Implement Deterministic Emergency Trigger Detection

## Parent Story
- Story ID: US-009
- Story File: .propel/context/tasks/EP-003/us_009/us_009.md

## Technology Layer
- Safety Rule Engine

## Objective
Build deterministic trigger matching for emergency symptom patterns such as chest pain and breathing difficulty.

## Scope
- Define emergency trigger dictionary and phrase patterns.
- Implement normalized text preprocessing for robust pattern matching.
- Add rule versioning support for trigger set evolution.
- Return structured match result with rule ID and trigger phrase.

## Out of Scope
- ML classifier for emergency prediction.
- Non-emergency symptom triage.

## Acceptance Criteria
1. Emergency patterns are matched deterministically.
2. Trigger engine handles case and punctuation variations.
3. Matched output includes rule ID and matched expression.
4. False-negative regression prompts are included in tests.
5. Rule set is externally configurable for updates.

## Traceability
- US-009 AC-001
- FR-009
- TR-004

## Effort
- Estimate: 6 hours
- Story Points Contribution: 0.75

## Dependencies
- US-006 completion

## Definition of Done
- Rule engine committed.
- Trigger test matrix passes.
