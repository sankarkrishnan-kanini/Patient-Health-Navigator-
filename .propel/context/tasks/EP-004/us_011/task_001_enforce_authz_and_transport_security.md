# Task - [TASK_XXX]

## Requirement Reference
- User Story: us_011 (extracted from input)
- Story Location: .propel/context/tasks/EP-004/us_011/us_011.md
- Acceptance Criteria:
  - Given protected endpoints, when requests arrive without valid tokens, then access is denied with appropriate response codes.
  - Given authenticated requests, when role checks execute, then only permitted operations are allowed.
  - Given all data transit and storage paths, when security checks run, then TLS and at-rest encryption policies are enforced.
- Edge Case:
  - What happens when token issuer keys rotate while active sessions are in progress?
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
| Library | OAuth 2.1 / OIDC middleware | latest stable |
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
Apply endpoint authentication and authorization enforcement with secure transport and operational policy controls.

## Dependent Tasks
- task_001_establish_modular_solution_structure.md

## Impacted Components
- API authentication middleware
- Authorization policy configuration
- Service security headers configuration

## Implementation Plan
- Integrate token validation and role policy checks.
- Enforce HTTPS-only endpoint behavior and security headers.
- Validate key-rotation and invalid-token handling.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | Server/src/API/Security/AuthConfiguration.cs | AuthN/AuthZ policy setup |
| MODIFY | Server/src/API/Program.cs | Register auth middleware and HTTPS enforcement |
| CREATE | Server/src/API/Security/SecurityHeadersMiddleware.cs | Security headers hardening |

## External References
- https://learn.microsoft.com/aspnet/core/security/authentication
- https://learn.microsoft.com/aspnet/core/security/authorization

## Build Commands
- dotnet build Server/Badminton.sln
- dotnet test

## Implementation Validation Strategy
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)

## Implementation Checklist
- [ ] Configure JWT/OIDC token validation for protected API routes
- [ ] Implement role-based policy checks for sensitive operations
- [ ] Enforce HTTPS and strict security headers on all API responses
- [ ] Validate behavior during identity provider key rotation events
- [ ] Verify consistent denial responses for unauthorized requests
