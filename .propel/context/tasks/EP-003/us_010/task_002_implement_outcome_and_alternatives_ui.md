# Task - [TASK_XXX]

## Requirement Reference
- User Story: us_010 (extracted from input)
- Story Location: .propel/context/tasks/EP-003/us_010/us_010.md
- Acceptance Criteria:
  - Given a confirmed allocation, when I request outcome, then the response includes date, time, court, and partner details when applicable.
  - Given an unavailable primary slot and alternatives enabled, when response is generated, then nearby courts and closest time options are returned in ranked order.
  - Given alternatives disabled, when no primary slot exists, then response returns unavailable status without fallback options.
- Edge Case:
  - What happens when recommendation ranking returns duplicate alternatives?
  - How does system handle stale decisions when the outcome is requested after slot state changes?

## Design References (Frontend Tasks Only)
| Reference Type | Value |
|----------------|-------|
| UI Impact | Yes |
| Figma URL | N/A |
| Wireframe Status | PENDING |
| Wireframe Type | N/A |
| Wireframe Path/URL | Provide wireframe: upload to .propel/context/wireframes/Hi-Fi/wireframe-SCR-XXX-{name}.[html|png|jpg] or add external URL |
| Screen Spec | N/A |
| UXR Requirements | N/A |
| Design Tokens | N/A |

## Applicable Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Angular | 19.x |
| Backend | ASP.NET Core Web API | .NET 9 LTS track |
| Database | PostgreSQL | 16+ |
| Library | Angular Router | 19.x |
| AI/ML | N/A | N/A |
| Vector Store | N/A | N/A |
| AI Gateway | N/A | N/A |
| Mobile | N/A | N/A |

## AI References (AI Tasks Only)
| Reference Type | Value |
|----------------|-------|
| AI Impact | No |
| AIR Requirements | N/A |
| AI Pattern | N/A |
| Prompt Template Path | N/A |
| Guardrails Config | N/A |
| Model Provider | N/A |

## Mobile References (Mobile Tasks Only)
| Reference Type | Value |
|----------------|-------|
| Mobile Impact | No |
| Platform Target | N/A |
| Min OS Version | N/A |
| Mobile Framework | N/A |

## Task Overview
Implement player-facing outcome screens to display confirmed sessions and ranked alternatives with clear unavailable states.

## Dependent Tasks
- task_001_build_outcome_response_api.md

## Impacted Components
- Outcome details UI component
- Alternative options list component
- Outcome state service

## Implementation Plan
- Build confirmed and unavailable outcome views.
- Render ranked alternatives with deduplicated entries.
- Handle stale/expired outcomes and refresh prompts.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | app/src/features/outcome/outcome-page.component.ts | Outcome state handling and data binding |
| CREATE | app/src/features/outcome/outcome-page.component.html | Confirmed/unavailable/alternatives UI states |
| CREATE | app/src/features/outcome/outcome.service.ts | API integration for outcome retrieval |

## External References
- https://angular.dev/guide/router
- https://angular.dev/guide/http

## Build Commands
- npm run build
- npm run test

## Implementation Validation Strategy
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)
- [ ] [UI Tasks] Visual comparison against wireframe completed at 375px, 768px, 1440px
- [ ] [UI Tasks] Run /analyze-ux to validate wireframe alignment

## Implementation Checklist
- [ ] Implement confirmed session view with date/time/court/partner details
- [ ] Implement unavailable view that respects alternatives preference state
- [ ] Render ranked alternatives list with clear selection affordances
- [ ] Handle stale outcomes with refresh and updated-state messaging
- [ ] Verify responsive layout for mobile and desktop breakpoints
