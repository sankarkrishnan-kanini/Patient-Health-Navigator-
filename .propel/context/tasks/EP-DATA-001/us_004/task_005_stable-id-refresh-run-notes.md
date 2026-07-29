# TASK-005 Stable ID Refresh Run Notes

## Context
- Parent story: US-004
- Task: TASK-005 Implement Stable ID Refresh Process
- Date: 2026-07-29

## Implementation Artifacts
- Stable ID refresh module: `lib/data-ingestion/showcase-stable-id-refresh.ts`
- CLI runner: `scripts/showcase-stable-id-refresh.ts`
- NPM script: `cohort:refresh-ids`
- Unit tests: `tests/lib/showcase-stable-id-refresh.test.ts`

## Validation Commands Executed
1. `npm run test`
2. `npm run cohort:refresh-ids -- --completeness-run-id run_local_completeness_sample --run-id run_refresh_ids_sample_1`
3. `npm run cohort:refresh-ids -- --completeness-run-id run_local_completeness_sample --run-id run_refresh_ids_sample_2`
4. `npm run build`

## Refresh Evidence
- Run `run_refresh_ids_sample_1` summary:
  - totalProfiles: 6
  - addedCount: 6
  - removedCount: 0
  - updatedCount: 0
  - unchangedCount: 0
- Run `run_refresh_ids_sample_2` summary:
  - totalProfiles: 6
  - addedCount: 0
  - removedCount: 0
  - updatedCount: 0
  - unchangedCount: 6

## Deterministic Mapping and Change Detection Evidence
- Deterministic strategy key: `patientId`.
- Mapping report artifact includes:
  - `added`
  - `removed`
  - `updated`
  - `unchanged`
- Artifacts:
  - `.propel/context/data/curated/showcase-stable-ids/run_refresh_ids_sample_1/stable-id-mapping-report.json`
  - `.propel/context/data/curated/showcase-stable-ids/run_refresh_ids_sample_2/stable-id-mapping-report.json`

## Stable ID Resolution Evidence
- Stable ID lookup index exported for downstream script resolution.
- Resolver helper available:
  - `resolveProfileByStableId(stableId, outputRootPath?)`
- Lookup artifact:
  - `.propel/context/data/curated/showcase-stable-ids/run_refresh_ids_sample_2/stable-id-lookup.json`

## Rollback and Safety Guidance Evidence
- Runbook generated per refresh run with rollback instructions and backup restore command:
  - `.propel/context/data/curated/showcase-stable-ids/run_refresh_ids_sample_2/stable-id-refresh-runbook.md`
- Registry backup captured on reruns before registry mutation:
  - `.propel/context/data/curated/showcase-stable-ids/run_refresh_ids_sample_2/stable-id-registry.backup.1785322379706.json`

## Acceptance Criteria Trace
1. Refresh reruns preserve IDs for unchanged profiles: **Pass**
2. Refresh output includes deterministic mapping report: **Pass**
3. Added or removed profiles are clearly reported: **Pass**
4. Demo scripts can resolve profiles by stable ID after refresh: **Pass**
5. Refresh process includes rollback guidance for invalid cohort updates: **Pass**

## Output Paths Verified
- `.propel/context/data/curated/showcase-stable-ids/run_refresh_ids_sample_1/`
- `.propel/context/data/curated/showcase-stable-ids/run_refresh_ids_sample_2/`
