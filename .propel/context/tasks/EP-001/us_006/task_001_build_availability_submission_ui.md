# Task - [TASK_XXX]

## Requirement Reference
- User Story: us_006 (extracted from input)
- Story Location: .propel/context/tasks/EP-001/us_006/us_006.md
- Acceptance Criteria:
  - Given I open the availability form, when I submit a valid date and optional fields, then my request is accepted and tracked.
  - Given I provide partner and alternative preferences, when the request is stored, then preferences are saved with the submission.
  - Given I provide a preferred location, when submission completes, then location data is available for filtering and grouping.
- Edge Case:
  - What happens when optional fields are omitted and only date is provided?
  - How does system handle a location input that does not map to known facilities?

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
| Library | Angular Reactive Forms | 19.x |
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
Implement the player-facing availability submission form with required and optional fields, preference controls, and clear submission feedback.

## Dependent Tasks
- task_001_establish_modular_solution_structure.md

## Impacted Components
- Availability form component
- Frontend request DTO and submission service

## Implementation Plan
- Build form with mandatory date and optional fields.
- Add preference controls for partner and alternatives.
- Integrate form submission and response feedback states.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | app/src/features/availability/availability-form.component.ts | Availability form UI logic |
| CREATE | app/src/features/availability/availability-form.component.html | Form markup and validation states |
| CREATE | app/src/features/availability/availability.service.ts | API submission service |

## External References
- https://angular.dev/guide/forms/reactive-forms
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
- [ ] Create reactive form with required date and optional preference fields
- [ ] Add controls for need-partner and open-to-alternatives flags
- [ ] Implement inline validation messages and submission disable state
- [ ] Submit payload to backend service and handle accepted/error responses
- [ ] Verify responsive behavior for mobile-first layout expectations
