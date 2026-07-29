# TASK-003: Add Plain-Language Response Controls

## Parent Story
- Story ID: US-007
- Story File: .propel/context/tasks/EP-002/us_007/us_007.md

## Technology Layer
- Prompting and Output Quality Controls

## Objective
Ensure default responses avoid unnecessary jargon and maintain target readability expectations.

## Scope
- Add plain-language style constraints to response generation layer.
- Create terminology simplification map for common medical phrases.
- Add output post-check for excessive jargon density.
- Capture readability proxy metrics in evaluation logs.

## Out of Scope
- Full linguistic readability engine.
- Multilingual adaptation.

## Acceptance Criteria
1. Response defaults avoid unnecessary medical jargon.
2. Common technical terms are explained or simplified.
3. Post-check flags responses that exceed jargon threshold.
4. Quality logs capture readability review metadata.
5. Regression prompts show improvement against baseline jargon-heavy responses.

## Traceability
- US-007 AC-003
- NFR-005
- UXR-002

## Effort
- Estimate: 6 hours
- Story Points Contribution: 1

## Dependencies
- TASK-001
- TASK-002

## Definition of Done
- Plain-language controls committed.
- Readability checks validated on sample conversations.
