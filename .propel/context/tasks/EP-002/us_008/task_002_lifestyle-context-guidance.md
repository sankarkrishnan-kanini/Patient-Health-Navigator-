# TASK-002: Implement Lifestyle Guidance with Profile Context

## Parent Story
- Story ID: US-008
- Story File: .propel/context/tasks/EP-002/us_008/us_008.md

## Technology Layer
- Conversation Logic and Response Composition

## Objective
Provide lifestyle guidance that references patient profile context when relevant.

## Scope
- Detect lifestyle intents (diet, activity, habits within allowed scope).
- Retrieve relevant profile factors and care-plan context.
- Compose plain-language guidance tied to selected profile context.
- Add safe boundary messaging when lifestyle question exceeds scope.

## Out of Scope
- Personalized medical prescription.
- Nutrition plan optimization engine.

## Acceptance Criteria
1. Lifestyle responses reference profile context where relevant.
2. Responses remain non-diagnostic and plain-language.
3. Out-of-scope lifestyle requests return safe boundary response.
4. Responses avoid contradictions with known profile constraints.
5. QA prompts confirm grounded output consistency.

## Traceability
- US-008 AC-002
- FR-007
- NFR-006

## Effort
- Estimate: 7 hours
- Story Points Contribution: 1

## Dependencies
- TASK-001

## Definition of Done
- Lifestyle guidance flow committed.
- Context-linked examples pass review.
