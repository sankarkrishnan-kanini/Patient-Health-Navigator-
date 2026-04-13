# Task - [TASK_XXX]

## Requirement Reference
- User Story: us_007 (extracted from input)
- Story Location: .propel/context/tasks/EP-001/us_007/us_007.md
- Acceptance Criteria:
  - Given a submission missing date, when I submit, then the system rejects the request and returns a date-specific validation error.
  - Given malformed field values, when validation runs, then each invalid field returns actionable error messages.
  - Given a corrected request, when I resubmit, then the system accepts and stores the request successfully.
- Edge Case:
  - What happens when client and server validations disagree for optional fields?
  - How does system handle duplicate rapid submissions caused by repeated button taps?

## Design References (Frontend Tasks Only)
| Reference Type | Value |
|----------------|-------|
| UI Impact | No |
| Figma URL | N/A |
| Wireframe Status | N/A |
| Wireframe Type | N/A |
| Wireframe Path/URL | N/A |
| Screen Spec | N/A |
| UXR Requirements | N/A |
| Design Tokens | N/A |

## Applicable Technology Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | Angular | 19.x |
| Backend | ASP.NET Core Web API | .NET 9 LTS track |
| Database | PostgreSQL | 16+ |
| Library | FluentValidation | latest stable |
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
Implement authoritative server-side validation for availability submissions, including consistent error payloads and replay-safe behavior.

## Dependent Tasks
- task_002_implement_submission_api_and_persistence.md

## Impacted Components
- Request validator classes
- API validation pipeline behavior
- Error response contract

## Implementation Plan
- Define backend validator rules for all submission fields.
- Enforce request rejection on invalid payloads with precise field messages.
- Ensure idempotent behavior for repeated submission attempts.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/src/Application/Availability/CreateAvailabilityCommandValidator.cs | Server-side validation rules |
| MODIFY | Server/src/API/Controllers/AvailabilityController.cs | Apply validation pipeline and structured errors |
| CREATE | Server/src/API/Contracts/ValidationErrorResponse.cs | Standardized error response payload |

## External References
- https://docs.fluentvalidation.net/
- https://learn.microsoft.com/aspnet/core/web-api/handle-errors

## Build Commands
- dotnet test
- dotnet build Server/Badminton.sln

## Implementation Validation Strategy
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)

## Implementation Checklist
- [ ] Define required/optional server validation rules for request model
- [ ] Return field-specific and actionable errors for invalid input
- [ ] Ensure server rules remain source of truth when client rules diverge
- [ ] Add request replay protection for rapid duplicate submissions
- [ ] Verify corrected resubmission path returns accepted response
