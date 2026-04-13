# Task - [TASK_XXX]

## Requirement Reference
- User Story: us_004 (extracted from input)
- Story Location: .propel/context/tasks/EP-DATA/us_004/us_004.md
- Acceptance Criteria:
  - Given domain entity definitions, when migrations run, then tables for player, availability request, court, slot, and allocation are created.
  - Given relationship rules, when invalid foreign key data is inserted, then database constraints reject invalid writes.
  - Given unique slot rules, when duplicate court-date-time rows are attempted, then uniqueness checks prevent conflicts.
- Edge Case:
  - What happens when existing seed data violates newly added referential constraints?
  - How does system handle schema changes requiring column backfills for large datasets?

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
Define and migrate the core relational schema for player availability and allocation workflows with strict integrity constraints.

## Dependent Tasks
- task_001_establish_modular_solution_structure.md

## Impacted Components
- Database migration project
- Core entity models and relational mappings

## Implementation Plan
- Implement entity models aligned to ERD.
- Create migrations for core tables and constraints.
- Add unique indexes and foreign keys for conflict prevention.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/src/Infrastructure/Persistence/Entities/PlayerEntity.cs | Player persistence model |
| CREATE | Server/src/Infrastructure/Persistence/Entities/AvailabilityRequestEntity.cs | Availability request model |
| CREATE | Server/src/Infrastructure/Persistence/Entities/CourtSlotEntity.cs | Slot model with unique key |
| CREATE | Server/src/Infrastructure/Persistence/Migrations/20260413_InitialCoreSchema.cs | Initial schema migration |

## External References
- https://www.postgresql.org/docs/current/ddl-constraints.html
- https://learn.microsoft.com/ef/core/modeling/

## Build Commands
- dotnet ef migrations add InitialCoreSchema
- dotnet ef database update

## Implementation Validation Strategy
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)

## Implementation Checklist
- [ ] Implement core entity models for player, request, court, slot, and allocation
- [ ] Add foreign key and unique constraints matching ERD relationships
- [ ] Generate and apply initial migration against local PostgreSQL
- [ ] Validate conflict and integrity behavior with representative inserts
- [ ] Document schema assumptions and migration rollback notes
