# Task - [TASK_XXX]

## Requirement Reference
- User Story: us_012 (extracted from input)
- Story Location: .propel/context/tasks/EP-004/us_012/us_012.md
- Acceptance Criteria:
  - Given repeated identical submission requests, when idempotency keys are supplied, then only one effective operation is committed.
  - Given allocation decisions, when processing completes, then audit records include policy version, inputs, and decision timestamp.
- Edge Case:
  - What happens when idempotency keys collide across unrelated clients?
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
| Library | ASP.NET Middleware + EF Core | .NET 9 / 9.x |
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
Implement idempotency key enforcement for submission and allocation endpoints to avoid duplicate side effects under retries.

## Dependent Tasks
- task_001_enforce_authz_and_transport_security.md

## Impacted Components
- Idempotency middleware
- Request processing and storage policy

## Implementation Plan
- Parse and validate idempotency key headers.
- Persist key fingerprint and operation outcome.
- Return previously committed result on safe retries.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/src/API/Middleware/IdempotencyMiddleware.cs | Idempotency key handling for mutating requests |
| CREATE | Server/src/Infrastructure/Persistence/Entities/IdempotencyRecordEntity.cs | Persistence model for idempotent outcomes |
| MODIFY | Server/src/API/Program.cs | Register middleware and ordering |

## External References
- https://datatracker.ietf.org/doc/html/rfc7231
- https://learn.microsoft.com/aspnet/core/fundamentals/middleware/

## Build Commands
- dotnet build Server/Badminton.sln
- dotnet test

## Implementation Validation Strategy
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)

## Implementation Checklist
- [ ] Require idempotency key on target write endpoints
- [ ] Store normalized key fingerprint and response snapshot atomically
- [ ] Return previous response for duplicate key replay within validity window
- [ ] Prevent cross-tenant key collisions via namespace scoping
- [ ] Validate behavior when same key carries mismatched payload hashes
