# Task - [TASK_XXX]

## Requirement Reference
- User Story: us_011 (extracted from input)
- Story Location: .propel/context/tasks/EP-004/us_011/us_011.md
- Acceptance Criteria:
  - Given all data transit and storage paths, when security checks run, then TLS and at-rest encryption policies are enforced.
- Edge Case:
  - How does system handle partial encryption configuration drift across environments?

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
| Library | Azure Key Vault or equivalent | latest stable |
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
Enforce encryption and centralized key management for all sensitive data paths with environment-consistent policy checks.

## Dependent Tasks
- task_001_enforce_authz_and_transport_security.md

## Impacted Components
- Secret and key management configuration
- Database encryption and connection settings

## Implementation Plan
- Externalize secrets to key management service.
- Enforce encrypted transport and secure DB settings.
- Add startup validation for missing/invalid key references.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/src/Infrastructure/Security/KeyManagementProvider.cs | Centralized key retrieval abstraction |
| MODIFY | Server/src/Infrastructure/Persistence/DbContextOptionsFactory.cs | Enforce encrypted DB connection settings |
| CREATE | infra/security/key-policy.md | Environment key policy and rotation baseline |

## External References
- https://learn.microsoft.com/azure/key-vault/general/basic-concepts
- https://www.postgresql.org/docs/current/ssl-tcp.html

## Build Commands
- dotnet build Server/Badminton.sln

## Implementation Validation Strategy
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)

## Implementation Checklist
- [ ] Configure key provider abstraction for secrets and encryption keys
- [ ] Enforce encrypted DB connection and certificate validation settings
- [ ] Add startup checks that fail fast on missing key material
- [ ] Define key rotation policy and validation process per environment
- [ ] Verify parity checks to detect encryption drift between environments
