# Task - [TASK_XXX]

## Requirement Reference
- User Story: us_009 (extracted from input)
- Story Location: .propel/context/tasks/EP-002/us_009/us_009.md
- Acceptance Criteria:
  - Given partner-required requests, when matching executes, then users are paired using date/time/location compatibility.
  - Given optional skill matching criteria, when configured, then pair scoring respects compatibility thresholds.
  - Given assigned partners, when conflict checks run, then duplicate or overlapping assignments are prevented.
- Edge Case:
  - What happens when two groups attempt to assign the same player simultaneously?
  - How does system handle cases where no compatible partner exists before slot lock time?

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
Implement partner matching logic with compatibility scoring and collision-safe assignment controls.

## Dependent Tasks
- task_001_implement_grouping_and_allocation_worker.md

## Impacted Components
- Partner matching service
- Assignment repository and conflict checks

## Implementation Plan
- Build partner candidate selection by date/time/location.
- Add optional skill compatibility scoring.
- Enforce overlap and duplicate assignment prevention.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/src/Application/Matching/PartnerMatchingService.cs | Matching and scoring logic |
| CREATE | Server/src/Infrastructure/Persistence/Repositories/PartnerAssignmentRepository.cs | Assignment persistence and conflict queries |
| MODIFY | Server/src/Application/Matching/MatchOrchestrationWorker.cs | Invoke partner matching in allocation pipeline |

## External References
- https://learn.microsoft.com/ef/core/querying/
- https://learn.microsoft.com/dotnet/standard/threading/

## Build Commands
- dotnet build Server/Badminton.sln
- dotnet test

## Implementation Validation Strategy
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)

## Implementation Checklist
- [ ] Implement partner candidate filtering by date, slot, and location proximity
- [ ] Add optional skill-level compatibility scoring and thresholding
- [ ] Prevent overlapping assignments using transactional conflict checks
- [ ] Return explicit no-match reason when no partner is available
- [ ] Validate race-condition handling for concurrent group assignment attempts
