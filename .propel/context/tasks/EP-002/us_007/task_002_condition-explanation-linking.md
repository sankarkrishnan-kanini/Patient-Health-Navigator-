# TASK-002: Implement Profile-Linked Condition Explanations

## Parent Story
- Story ID: US-007
- Story File: .propel/context/tasks/EP-002/us_007/us_007.md

## Technology Layer
- Conversation Backend and Response Composition

## Objective
Return plain-language condition explanations linked to the active patient profile context.

## Scope
- Detect condition-explanation intents.
- Retrieve active conditions and related profile markers.
- Generate condition explanations in patient-friendly language.
- Include profile linkage cues in responses (for example, referencing known condition context).

## Out of Scope
- New diagnosis determination.
- Clinical risk scoring.

## Acceptance Criteria
1. Condition explanation responses link to active profile conditions.
2. Explanations are plain-language by default.
3. Condition responses avoid unsupported diagnostic assertions.
4. Unknown condition requests return clear, safe boundary messaging.
5. QA prompts confirm consistency across repeated questions.

## Traceability
- US-007 AC-002
- FR-005
- UXR-002

## Effort
- Estimate: 7 hours
- Story Points Contribution: 1

## Dependencies
- TASK-001

## Definition of Done
- Condition explanation flow committed.
- At least three profile-linked condition scenarios pass review.
