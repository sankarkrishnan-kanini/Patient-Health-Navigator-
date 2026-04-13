# Task - [TASK_XXX]

## Requirement Reference
- User Story: us_008 (extracted from input)
- Story Location: .propel/context/tasks/EP-002/us_008/us_008.md
- Acceptance Criteria:
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
| Library | HttpClient + Polly | latest stable |
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
Create resilient integration with court inventory provider for slot checks including timeout, retry, and fallback handling.

## Dependent Tasks
- task_001_implement_grouping_and_allocation_worker.md

## Impacted Components
- Court availability API adapter
- Resilience policy configuration

## Implementation Plan
- Build court availability adapter and DTO mapping.
- Add timeout/retry/circuit-breaker policies.
- Emit degraded-mode result when provider unavailable.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/src/Infrastructure/Integrations/CourtAvailabilityClient.cs | External court availability adapter |
| CREATE | Server/src/Infrastructure/Integrations/CourtAvailabilityPolicies.cs | Retry and circuit-breaker definitions |
| MODIFY | Server/src/Application/Matching/AllocationService.cs | Use adapter with failure-aware flow |

## External References
- https://learn.microsoft.com/dotnet/fundamentals/networking/http/httpclient-guidelines
- https://www.pollydocs.org/

## Build Commands
- dotnet build Server/Badminton.sln
- dotnet test

## Implementation Validation Strategy
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)

## Implementation Checklist
- [ ] Implement outbound court availability client and request/response mapping
- [ ] Configure timeout, retry, and circuit-breaker policy chain
- [ ] Handle timeout and unavailable responses with explicit pending outcome states
- [ ] Add telemetry dimensions for provider latency and error classes
- [ ] Validate behavior when group composition changes during provider latency
