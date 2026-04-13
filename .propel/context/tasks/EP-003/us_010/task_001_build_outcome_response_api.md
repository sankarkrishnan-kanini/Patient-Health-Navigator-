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
| Library | ASP.NET Core + EF Core | .NET 9 / 9.x |
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
Provide an outcome retrieval API that returns confirmed sessions or ranked alternatives according to user preference flags.

## Dependent Tasks
- task_001_implement_grouping_and_allocation_worker.md

## Impacted Components
- Outcome API endpoint
- Alternative ranking service
- Decision query repository

## Implementation Plan
- Implement outcome retrieval endpoint by request ID.
- Include partner and court details for confirmed outcomes.
- Generate and deduplicate ranked alternatives when enabled.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/src/API/Controllers/OutcomeController.cs | Outcome retrieval endpoint |
| CREATE | Server/src/Application/Outcomes/OutcomeQueryService.cs | Build confirmed/fallback response payload |
| CREATE | Server/src/Application/Outcomes/AlternativeRankingService.cs | Recommendation ranking and deduplication |

## External References
- https://learn.microsoft.com/aspnet/core/web-api/action-return-types
- https://learn.microsoft.com/ef/core/querying/related-data/

## Build Commands
- dotnet build Server/Badminton.sln
- dotnet test

## Implementation Validation Strategy
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)

## Implementation Checklist
- [ ] Create GET outcome endpoint with request tracking identifier input
- [ ] Return confirmed payload with court, time, and partner details when available
- [ ] Generate ranked alternatives honoring open-to-alternatives preference flag
- [ ] Deduplicate alternative options and include explicit unavailable status path
- [ ] Guard against stale decision reads with timestamp/version checks
