# TASK-005: Implement Stable ID Refresh Process

## Parent Story
- Story ID: US-004
- Story File: .propel/context/tasks/EP-DATA-001/us_004/us_004.md

## Technology Layer
- Data Lifecycle and Governance

## Objective
Ensure cohort refreshes preserve stable profile identifiers so demo scripts and references remain valid over time.

## Scope
- Define stable ID strategy for showcase profiles.
- Implement refresh logic that preserves IDs across reruns when source identity is unchanged.
- Add change-detection report for added, removed, and updated profiles.
- Document operator runbook for safe refresh execution.

## Out of Scope
- Cross-environment identity federation.
- User-facing migration workflows.

## Acceptance Criteria
1. Refresh reruns preserve IDs for unchanged profiles.
2. Refresh output includes deterministic mapping report.
3. Added or removed profiles are clearly reported.
4. Demo scripts can resolve profiles by stable ID after refresh.
5. Refresh process includes rollback guidance for invalid cohort updates.

## Implementation Evidence Checklist (2026-07-29)
1. AC-001: **Pass**
	- Evidence: Stable ID registry preserves identifiers on repeated refresh runs when patient identity key remains unchanged.
2. AC-002: **Pass**
	- Evidence: Refresh writes deterministic mapping report with run metadata and categorized mapping output.
3. AC-003: **Pass**
	- Evidence: Mapping report explicitly surfaces `added`, `removed`, `updated`, and `unchanged` profile groups.
4. AC-004: **Pass**
	- Evidence: Stable ID lookup index and resolver support profile resolution by stable ID for downstream demo script usage.
5. AC-005: **Pass**
	- Evidence: Runbook artifact includes rollback instructions and backup-restore command guidance.

Supporting notes: `task_005_stable-id-refresh-run-notes.md`

## Traceability
- US-004 AC-005
- DR-002
- DR-003

## Effort
- Estimate: 4 hours
- Story Points Contribution: 0.5

## Dependencies
- TASK-001
- TASK-003

## Definition of Done
- Stable-ID refresh logic committed.
- At least one repeated refresh run confirms ID stability.
