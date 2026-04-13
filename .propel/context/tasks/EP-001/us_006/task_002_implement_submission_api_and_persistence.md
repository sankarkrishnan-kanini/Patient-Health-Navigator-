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
| Library | EF Core | 9.x |
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
Implement backend endpoint and persistence flow for availability submissions with preference and location capture.

## Dependent Tasks
- task_001_create_core_domain_schema.md

## Impacted Components
- Availability API controller
- Application command handler
- Persistence repository

## Implementation Plan
- Add POST endpoint for availability request creation.
- Persist required and optional fields in normalized schema.
- Return tracking reference and accepted status payload.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/src/API/Controllers/AvailabilityController.cs | Submission endpoint |
| CREATE | Server/src/Application/Availability/CreateAvailabilityCommand.cs | Command contract and handler |
| CREATE | Server/src/Infrastructure/Persistence/Repositories/AvailabilityRepository.cs | Persistence implementation |

## External References
- https://learn.microsoft.com/aspnet/core/web-api
- https://learn.microsoft.com/ef/core/saving/

## Build Commands
- dotnet build Server/Badminton.sln
- dotnet test

## Implementation Validation Strategy
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)

## Implementation Checklist
- [ ] Define API contract for required and optional submission fields
- [ ] Implement create command handler and persistence mapping
- [ ] Persist partner and alternative preferences with location metadata
- [ ] Return accepted response with request tracking identifier
- [ ] Validate behavior for minimal payload containing date only
