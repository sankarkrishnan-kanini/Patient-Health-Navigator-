# TASK-005: Capture Source-to-Schema Lineage Metadata

## Parent Story
- Story ID: US-003
- Story File: .propel/context/tasks/EP-DATA-001/us_003/us_003.md

## Technology Layer
- Metadata and Governance

## Objective
Capture and persist lineage metadata linking source resources to normalized patient context records.

## Scope
- Define lineage metadata model with source resource ID, ingestion run ID, transformation rule version, and target entity ID.
- Persist lineage records alongside normalized outputs.
- Expose query path for lineage lookup by patient and target entity.
- Add validation to ensure lineage entries exist for transformed records.

## Out of Scope
- Enterprise lineage platform integration.
- Cross-project metadata federation.

## Acceptance Criteria
1. Each normalized record has corresponding lineage metadata.
2. Lineage includes source identifier and run identifier.
3. Transformation rule version is recorded for reproducibility.
4. Lineage lookup is possible for audit and debugging.
5. Missing lineage records are detected in quality checks.

## Implementation Evidence Checklist (2026-07-29)
1. AC-001: **Pass**
	- Evidence: Lineage entries persisted for normalized entities in machine-readable output.
2. AC-002: **Pass**
	- Evidence: Lineage includes source resource identifiers and ingestion run identifier.
3. AC-003: **Pass**
	- Evidence: Transformation rule version captured and validated in lineage artifacts.
4. AC-004: **Pass**
	- Evidence: Lineage lookup query path implemented for audit/debug filtering.
5. AC-005: **Pass**
	- Evidence: Lineage coverage quality checks detect missing entries and report diagnostics.

Supporting notes: `task_005_lineage-run-notes.md`

## Traceability
- US-003 AC-005
- DR-005
- TR-003

## Effort
- Estimate: 5 hours
- Story Points Contribution: 0.75

## Dependencies
- TASK-002
- TASK-004

## Definition of Done
- Lineage schema and write path committed.
- Query and validation checks demonstrated with sample data.
