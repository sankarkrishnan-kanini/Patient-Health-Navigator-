# Task - [TASK_XXX]

## Requirement Reference
- User Story: us_005 (extracted from input)
- Story Location: .propel/context/tasks/EP-DATA/us_005/us_005.md
- Acceptance Criteria:
  - Given backup policies, when daily backup windows execute, then recoverable snapshots are produced and verified.
  - Given migration workflows, when schema updates are deployed, then additive migrations complete without player-facing downtime.
  - Given retention policies, when records exceed policy thresholds, then purge and archival actions run as configured.
- Edge Case:
  - What happens when backup execution succeeds but verification restore fails?
  - How does system handle rollback if a migration introduces incompatible index changes?

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
| Library | pg_dump / pg_restore | PostgreSQL tools |
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
Set up operational controls for backup verification, additive migrations, and policy-driven data retention.

## Dependent Tasks
- task_001_create_core_domain_schema.md

## Impacted Components
- Backup automation scripts
- Migration pipeline scripts
- Retention/purge scheduling scripts

## Implementation Plan
- Implement backup and restore verification jobs.
- Add pre-deployment migration validation checks.
- Implement retention and purge automation with policy configuration.

## Current Project State
- README.md
- .propel/context/docs/
- .propel/context/tasks/

## Expected Changes
| Action | File Path | Description |
|--------|-----------|-------------|
| CREATE | scripts/db/backup_daily.ps1 | Automated backup workflow |
| CREATE | scripts/db/verify_restore.ps1 | Backup restore validation job |
| CREATE | scripts/db/run_migration_safe.ps1 | Additive migration execution wrapper |
| CREATE | scripts/db/purge_retention.ps1 | Data retention and purge task |

## External References
- https://www.postgresql.org/docs/current/app-pgdump.html
- https://www.postgresql.org/docs/current/app-pgrestore.html

## Build Commands
- powershell -File scripts/db/backup_daily.ps1
- powershell -File scripts/db/verify_restore.ps1

## Implementation Validation Strategy
- [ ] Unit tests pass
- [ ] Integration tests pass (if applicable)

## Implementation Checklist
- [ ] Create scheduled backup script with environment-specific retention windows
- [ ] Implement backup restore verification and alerting on restore failure
- [ ] Add migration safety wrapper with pre-check and rollback pathway
- [ ] Implement retention purge task honoring configured policy thresholds
- [ ] Validate scripts in staging with dry-run and failure-path scenarios
