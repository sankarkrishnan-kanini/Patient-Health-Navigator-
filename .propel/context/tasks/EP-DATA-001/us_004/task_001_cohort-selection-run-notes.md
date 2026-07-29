# TASK-001 Cohort Selection Run Notes

## Context
- Parent story: US-004
- Task: TASK-001 Build Showcase Cohort Selection Pipeline
- Date: 2026-07-29

## Implementation Artifacts
- Cohort selection module: `lib/data-ingestion/showcase-cohort-selection.ts`
- CLI runner: `scripts/showcase-cohort-selection.ts`
- NPM script: `cohort:select`
- Cohort fixture seed: `tests/fixtures/showcase-cohort/run_showcase_seed/patients/`
- Automated validation: `tests/lib/showcase-cohort-selection.test.ts`

## Validation Commands Executed
1. `npm run test`
2. `npm run cohort:select -- --source-run-id run_showcase_seed --run-id run_local_showcase_sample --normalized-root tests/fixtures/showcase-cohort --min-profiles 5 --max-profiles 10`
3. `npm run cohort:select -- --source-run-id run_showcase_seed --run-id run_local_showcase_sample --normalized-root tests/fixtures/showcase-cohort --min-profiles 5 --max-profiles 10`
4. `npm run build`

## Sample Run Output Summary
- Source files scanned: 7
- Selected patient count: 6
- Failed records excluded: 1
- Failure reason captured: invalid JSON content

## Stable Artifact Evidence
- Cohort profile list:
  - `.propel/context/data/curated/showcase-cohort/run_local_showcase_sample/cohort-profiles.json`
- Stable profile ID list:
  - `.propel/context/data/curated/showcase-cohort/run_local_showcase_sample/cohort-profile-ids.txt`
- Failure log:
  - `.propel/context/data/curated/showcase-cohort/run_local_showcase_sample/cohort-failures.ndjson`
- Summary:
  - `.propel/context/data/curated/showcase-cohort/run_local_showcase_sample/cohort-summary.json`

## Rerun Evidence
- Repeated run with identical parameters produced:
  - selected patient count unchanged at 6
  - stable ordered profile IDs (`patient-100` through `patient-105`)
  - deterministic output artifact paths

## Acceptance Criteria Trace
1. Cohort output contains at least 5 and no more than 10 profiles: **Pass**
2. Selection run produces stable artifact list for downstream steps: **Pass**
3. Cohort generation logs include selected patient count: **Pass**
4. Cohort generation can be rerun in local environment: **Pass**
5. Failed records are excluded with reason logging: **Pass**

## Output Paths Verified
- `.propel/context/data/curated/showcase-cohort/run_local_showcase_sample/`