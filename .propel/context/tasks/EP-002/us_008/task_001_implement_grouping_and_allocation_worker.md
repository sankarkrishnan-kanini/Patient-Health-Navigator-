# Task - [TASK_XXX]

## Requirement Reference
- User Story: us_008 (extracted from input)
- Story Location: .propel/context/tasks/EP-002/us_008/us_008.md
- Acceptance Criteria:
  - Given queued requests, when batch processing runs, then requests are grouped by date, time, and location.
  - Given grouped requests and slot inventory, when allocation executes, then availability checks and minimum player rules determine confirmation.
  - Given successful allocation, when decision is persisted, then players receive a confirmed result status within target latency.
- Edge Case:
  - What happens when court provider responses time out during allocation checks?
  - How does system handle groups that become invalid because a player cancels mid-processing?

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
| Library | BackgroundService + Redis queue | latest stable |
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
Implement background worker orchestration for grouping candidate requests and producing allocation decisions within latency targets.

## Dependent Tasks
- task_001_create_core_domain_schema.md
- task_001_implement_observability_and_alerts.md

## Impacted Components
- Match orchestration worker
- Allocation service and persistence components

## Implementation Plan
- Pull queued submissions and group by date/time/location.
- Apply minimum player and allocation logic.
- Persist decisions and emit outcome events.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/src/Application/Matching/MatchOrchestrationWorker.cs | Background match processing worker |
| CREATE | Server/src/Application/Matching/AllocationService.cs | Allocation rule application service |
| MODIFY | Server/src/Infrastructure/Persistence/Repositories/AvailabilityRepository.cs | Add grouped request query support |

## External References
- https://learn.microsoft.com/dotnet/core/extensions/workers
- https://learn.microsoft.com/aspnet/core/fundamentals/host/hosted-services

## Build Commands
- dotnet build Server/Badminton.sln
- dotnet test

## Implementation Validation Strategy
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)

## Implementation Checklist
- [ ] Implement worker loop to consume queued candidate submissions
- [ ] Group submissions by date, time slot, and location bucket
- [ ] Apply minimum-player and slot-allocation rules
- [ ] Persist allocation decisions and result status records
- [ ] Verify latency objective under representative concurrent load
