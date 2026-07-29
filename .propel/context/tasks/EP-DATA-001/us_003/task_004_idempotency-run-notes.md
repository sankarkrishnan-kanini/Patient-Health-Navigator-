# TASK-004 Idempotency and Dedup Run Notes

## Context
- Parent story: US-003
- Task: TASK-004 Implement Idempotent Reprocessing and Deduplication
- Date: 2026-07-29

## Implementation Artifacts
- Ingestion dedup boundary: `lib/data-ingestion/fhir-ingestion.ts`
- Normalization idempotent upsert and history: `lib/data-ingestion/fhir-normalization.ts`
- Duplicate fixture: `tests/fixtures/fhir-batch/bundle-duplicates.json`
- Automated validation tests:
  - `tests/lib/fhir-ingestion.test.ts`
  - `tests/lib/fhir-normalization.test.ts`

## Validation Commands Executed
1. `npm run test`
2. `npm run ingest:fhir -- --input tests/fixtures/fhir-batch/bundle-duplicates.json --run-id run_local_dedup_sample`
3. `npm run normalize:fhir -- --run-id run_local_dedup_sample --profile-version v-dedup`
4. `npm run normalize:fhir -- --run-id run_local_dedup_sample --profile-version v-dedup`

## Ingestion Boundary Dedup Evidence
- Duplicate events detected: 2
- Duplicate entities:
  - Condition `condition-dup-001`
  - MedicationRequest `med-dup-001`
- Staged resource counts after suppression:
  - Patient: 1
  - Condition: 1
  - MedicationRequest: 1

## Normalization Idempotent Reprocessing Evidence
- First normalization run:
  - patientCount: 1
  - duplicateEventCount: 0
- Second normalization run with same run ID:
  - patientCount: 1
  - duplicateEventCount: 0
- Deterministic output path remained stable:
  - `.propel/context/data/normalized/patient-context/run_local_dedup_sample/patients/patient-dup-001.json`

## Reprocessing History Query Evidence
- History file:
  - `.propel/context/data/normalized/patient-context/reprocessing-history.ndjson`
- Two entries recorded for `run_local_dedup_sample`, demonstrating queryable rerun history.

## Acceptance Criteria Trace
1. Reprocessing same input batch does not create duplicate records: **Pass**
2. Upsert behavior updates existing records deterministically: **Pass**
3. Duplicate detection events logged with entity identifiers: **Pass**
4. Reprocessing history can be queried by run ID: **Pass**
5. Idempotency behavior verified with repeated test runs: **Pass**

## Output Paths Verified
- `.propel/context/data/staging/raw-fhir/run_local_dedup_sample/`
- `.propel/context/data/normalized/patient-context/run_local_dedup_sample/`
- `.propel/context/data/normalized/patient-context/reprocessing-history.ndjson`