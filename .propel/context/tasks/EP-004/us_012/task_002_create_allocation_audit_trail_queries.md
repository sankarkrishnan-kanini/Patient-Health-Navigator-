# Task - [TASK_XXX]

## Requirement Reference
- User Story: us_012 (extracted from input)
- Story Location: .propel/context/tasks/EP-004/us_012/us_012.md
- Acceptance Criteria:
  - Given allocation decisions, when processing completes, then audit records include policy version, inputs, and decision timestamp.
  - Given audit queries, when operational review runs, then decision histories can be retrieved without data loss.
- Edge Case:
  - How does system handle audit-log write failure while core transaction succeeds?

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
Implement durable audit logging and queryable history for allocation decisions with resilient write behavior.

## Dependent Tasks
- task_001_implement_idempotency_guards.md

## Impacted Components
- Audit entity and repository
- Decision history query handlers

## Implementation Plan
- Persist policy version, input snapshot, and decision timestamp.
- Add query API for filtered decision history retrieval.
- Add fallback handling when audit persistence fails.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/src/Infrastructure/Persistence/Entities/AllocationAuditEntity.cs | Audit persistence model |
| CREATE | Server/src/Infrastructure/Persistence/Repositories/AllocationAuditRepository.cs | Audit write and query operations |
| CREATE | Server/src/Application/Outcomes/GetAllocationAuditHistoryQuery.cs | Query contract for audit retrieval |

## External References
- https://www.postgresql.org/docs/current/functions-json.html
- https://learn.microsoft.com/ef/core/querying/

## Build Commands
- dotnet build Server/Badminton.sln
- dotnet test

## Implementation Validation Strategy
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)

## Implementation Checklist
- [ ] Persist immutable audit record on each allocation decision commit
- [ ] Include policy version, normalized input snapshot, and decision timestamp
- [ ] Add retrieval query by player, date range, and decision status filters
- [ ] Ensure audit write failures are surfaced and retried without data loss
- [ ] Validate long-range query performance with indexed audit dimensions
