# TASK-005 Lineage Metadata Run Notes

## Context
- Parent story: US-003
- Task: TASK-005 Capture Source-to-Schema Lineage Metadata
- Date: 2026-07-29

## Implementation Artifacts
- Lineage capture and quality checks: `lib/data-ingestion/fhir-normalization.ts`
- Query interfaces:
  - `queryNormalizationLineage`
  - `validateLineageCoverageForRun`
- Automated validation tests: `tests/lib/fhir-normalization.test.ts`

## Validation Commands Executed
1. `npm run test`
2. `npm run ingest:fhir -- --input tests/fixtures/fhir-batch/bundle-normalization.json --run-id run_local_lineage_sample`
3. `npm run normalize:fhir -- --run-id run_local_lineage_sample --profile-version v-lineage`
4. `npm run build`

## Lineage Output Evidence
- Lineage file:
  - `.propel/context/data/normalized/patient-context/run_local_lineage_sample/lineage-metadata.ndjson`
- Lineage entry count: 7
- Example lineage fields confirmed in output:
  - `sourceResourceId`
  - `ingestionRunId`
  - `transformationRuleVersion`
  - `targetEntityType`
  - `targetEntityId`

## Query and Debuggability Evidence
- Query by run and patient is supported via `queryNormalizationLineage`.
- Query by target entity type and target entity ID is supported via filter options.
- Reproducibility field (`transformationRuleVersion`) matches profile version used in run (`v-lineage`).

## Lineage Quality Check Evidence
- Quality report file:
  - `.propel/context/data/normalized/patient-context/run_local_lineage_sample/lineage-quality-report.json`
- Report metrics:
  - totalExpected: 7
  - totalRecorded: 7
  - totalMissing: 0
- Synthetic missing-lineage test coverage added in `tests/lib/fhir-normalization.test.ts`.

## Acceptance Criteria Trace
1. Each normalized record has corresponding lineage metadata: **Pass**
2. Lineage includes source identifier and run identifier: **Pass**
3. Transformation rule version is recorded for reproducibility: **Pass**
4. Lineage lookup is possible for audit and debugging: **Pass**
5. Missing lineage records are detected in quality checks: **Pass**

## Output Paths Verified
- `.propel/context/data/staging/raw-fhir/run_local_lineage_sample/`
- `.propel/context/data/normalized/patient-context/run_local_lineage_sample/`