# Architecture Design

## Project Overview
A mobile-first badminton coordination platform that captures player availability,
allocates courts, matches partners, and proposes alternatives when primary
choices are unavailable.

## Architecture Goals
- Goal 1: Deliver near real-time matching and allocation responses under normal
  operating load.
- Goal 2: Preserve deterministic and auditable allocation behavior for fairness
  and dispute handling.
- Goal 3: Support horizontal growth across multiple cities, courts, and peak
  booking windows.
- Goal 4: Protect personal data, session integrity, and access boundaries by
  default.
- Goal 5: Keep architecture implementation-friendly for a small-to-medium team.

## Non-Functional Requirements
- NFR-001: System MUST return submission validation responses within 500 ms p95
  and matching outcomes within 3 seconds p95 under nominal load.
- NFR-002: System MUST support at least 10,000 monthly active users, 1,000 daily
  active users, and 150 concurrent matching requests without service degradation.
- NFR-003: System MUST achieve 99.9% monthly availability for player-facing APIs
  and matching operations.
- NFR-004: System MUST enforce authenticated access for all non-public endpoints
  and role-based authorization for operational functions.
- NFR-005: System MUST encrypt data in transit with TLS 1.2+ and encrypt
  sensitive data at rest using managed key services.
- NFR-006: System MUST provide structured logs, traces, and metrics with alerting
  on error rate, latency, and dependency health.
- NFR-007: System MUST ensure idempotent request handling for submission and
  allocation operations to prevent duplicate bookings.
- NFR-008: System MUST support graceful degradation where partner matching or
  recommendation components fail without fully blocking submission workflows.
- NFR-009: System MUST preserve auditability of allocation decisions, including
  rule version, input snapshot, and decision timestamp.
- NFR-010: [UNCLEAR] System MUST satisfy regional data residency constraints,
  pending legal and market launch confirmation.

## Data Requirements
- DR-001: System MUST store player profile data with unique player identifier and
  normalized preference fields.
- DR-002: System MUST model court, location, and slot inventory as first-class
  entities with unique constraints on court plus date plus time.
- DR-003: System MUST persist availability submissions with immutable submitted-at
  timestamps and source metadata for traceability.
- DR-004: System MUST maintain referential integrity between submission,
  allocation, partner match, and recommendation records.
- DR-005: System MUST retain allocation and decision-audit records for a minimum
  of 12 months to support dispute review and analytics.
- DR-006: System MUST execute automated backups at least daily with point-in-time
  recovery for the primary transactional store.
- DR-007: System MUST support additive, backward-compatible schema migrations with
  zero-downtime rollout for player-facing services.
- DR-008: System MUST define PII retention and purge windows as configurable
  policies with environment-level overrides and documented defaults.

### Domain Entities
- Player: Registered or guest user identity, profile, and matching preferences;
  owns availability submissions.
- AvailabilityRequest: Player intent payload for date, optional time/location,
  skill, and preference flags; input to matching pipeline.
- Court: Facility unit with location, operating hours, and playable configuration.
- CourtSlot: Time-bounded inventory object derived from court schedule and booking
  status.
- MatchGroup: Temporary grouping of compatible requests by date/time/location for
  allocation decisions.
- PartnerAssignment: Deterministic link between players matched for the same
  session.
- AllocationDecision: Canonical record of confirm or reject result, applied
  policy, and rationale.
- AlternativeRecommendation: Ranked fallback options for nearby courts, closest
  times, or partial matches.

## AI Consideration

**Status:** Not applicable

**Rationale:** No `[AI-CANDIDATE]` or `[HYBRID]` tags present in spec.md. Project
follows deterministic architecture.

## Architecture and Design Decisions
- Decision 1: Use a modular monolith with clear service boundaries (Submission,
  Allocation, Matching, Recommendation) to minimize operational complexity while
  preserving future extraction options.
- Decision 2: Use asynchronous job processing for matching and recommendation to
  satisfy near real-time targets while isolating expensive operations.
- Decision 3: Use PostgreSQL as the transactional source of truth and Redis for
  short-lived caches and queue-backed coordination.
- Decision 4: Use policy-versioned allocation rules to guarantee deterministic and
  replayable decisions.
- Decision 5: Use OpenTelemetry-based observability and centralized dashboards for
  latency and correctness monitoring.
- Decision 6: Adopt OWASP-aligned API controls: strict input validation,
  authorization checks, rate limiting, and secure headers.
- Decision 7: Track stack decisions against official docs:
  https://learn.microsoft.com/aspnet/core,
  https://www.postgresql.org/docs/, https://redis.io/docs/,
  https://opentelemetry.io/docs/.

## Technology Stack
| Layer | Technology | Version | Justification (NFR/DR/AIR) |
|-------|------------|---------|----------------------------|
| Frontend | Angular | 19.x | NFR-001, NFR-002, NFR-006 |
| Mobile | N/A (responsive web first release) | N/A | NFR-001, NFR-002 |
| Backend | ASP.NET Core Web API | .NET 9 LTS track | NFR-001, NFR-003, NFR-007 |
| Database | PostgreSQL | 16+ | DR-002, DR-004, DR-007 |
| Testing | xUnit, Playwright | latest stable | NFR-007, NFR-008 |
| Infrastructure | Docker, Kubernetes | latest stable | NFR-002, NFR-003 |
| Security | OAuth 2.1/OIDC, ASP.NET Identity, Key Vault | latest stable | NFR-004, NFR-005 |
| Deployment | GitHub Actions + Helm | latest stable | NFR-003, NFR-006 |
| Monitoring | OpenTelemetry + Prometheus + Grafana | latest stable | NFR-006, NFR-009 |
| Documentation | OpenAPI + Architecture Decision Records | latest stable | NFR-009 |

### Alternative Technology Options
- Backend alternative: Node.js (NestJS) considered for faster JavaScript hiring
  path; not selected because strong deterministic policy and typed domain
  modeling benefits favored ASP.NET.
- Database alternative: MySQL considered for operational familiarity; not selected
  because PostgreSQL indexing, JSON support, and extension ecosystem were better
  aligned with query flexibility.
- Frontend alternative: React considered for ecosystem size; not selected due to
  preference for explicit framework conventions and built-in structure in Angular.

### Technology Decision
| Metric (from NFR/DR/AIR) | Candidate 1 | Candidate 2 | Rationale |
|--------------------------|-------------|-------------|-----------|
| API latency and throughput (NFR-001, NFR-002) | ASP.NET Core: 9/10 | Node/NestJS: 8/10 | ASP.NET provides predictable performance and mature profiling in this architecture shape. |
| Deterministic domain modeling (NFR-007, NFR-009) | ASP.NET Core: 9/10 | Node/NestJS: 7/10 | Strong typing and mature patterns reduce logic drift in allocation policies. |
| Data integrity and migration safety (DR-004, DR-007) | PostgreSQL: 9/10 | MySQL: 8/10 | PostgreSQL features and migration tooling support stricter integrity and evolution needs. |
| Team operability and observability (NFR-006, NFR-003) | ASP.NET + OTel: 9/10 | Node + OTel: 8/10 | Both are viable; .NET platform integration and diagnostics provided a stronger operational fit. |

## Technical Requirements
- TR-001: System MUST implement a modular monolith architecture with isolated
  domain modules and internal service contracts, justified by NFR-003 and NFR-008.
- TR-002: System MUST expose RESTful APIs for submission, match status, and
  recommendation retrieval with versioned endpoints, justified by NFR-001 and
  NFR-009.
- TR-003: System MUST implement asynchronous processing using queue-backed
  workers for matching and alternatives generation, justified by NFR-002,
  NFR-008, and DR-003.
- TR-004: System MUST use PostgreSQL as the primary transactional datastore and
  Redis as cache plus ephemeral coordination store, justified by DR-002, DR-004,
  and NFR-001.
- TR-005: System MUST enforce centralized authN/authZ via OAuth 2.1 or OIDC and
  role-based policies for operational routes, justified by NFR-004 and NFR-005.
- TR-006: System MUST implement policy-engine abstraction for allocation rules to
  support FCFS and priority strategy switching without core service rewrites,
  justified by NFR-009 and FR-006.
- TR-007: System MUST emit OpenTelemetry traces, metrics, and logs for all
  critical request paths and queue workers, justified by NFR-006.
- TR-008: System MUST support multi-region deployment readiness through
  stateless services, externalized state, and failover runbooks.

## Technical Constraints & Assumptions
- Initial release assumes one primary cloud region with managed database and
  managed cache services.
- External court availability integration is assumed to be API-based and
  accessible with stable SLAs.
- Team can support Kubernetes operations or use a managed Kubernetes platform.
- Mobile apps are out of scope for release 1; responsive web is mandatory.
- Allocation policy conflict (FR-006) remains open and requires product decision
  before production rule lock.

## Development Workflow

1. Finalize unclear requirement decisions (FR-006, NFR-010) and
   baseline acceptance thresholds.
2. Create module contracts and API schemas, then implement submission and
   allocation core paths first.
3. Implement queue workers for partner matching and alternative recommendation,
   including idempotency and retry controls.
4. Add observability, security hardening, and load tests to validate NFR
   compliance before release candidate.
5. Run staged deployment with canary rollout, monitor SLOs, and execute
   post-release architecture review.
