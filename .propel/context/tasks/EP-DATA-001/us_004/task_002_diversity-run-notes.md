# TASK-002 Diversity Rules Run Notes

## Context
- Parent story: US-004
- Task: TASK-002 Apply Clinical Diversity Rules for Demo Cohort
- Date: 2026-07-29

## Implementation Artifacts
- Diversity rule module: `lib/data-ingestion/showcase-cohort-diversity.ts`
- CLI runner: `scripts/showcase-cohort-diversity.ts`
- NPM script: `cohort:diversity`
- Diversity unit tests: `tests/lib/showcase-cohort-diversity.test.ts`

## Validation Commands Executed
1. `npm run test`
2. `npm run cohort:select -- --source-run-id run_showcase_seed --run-id run_local_showcase_sample --normalized-root tests/fixtures/showcase-cohort --min-profiles 5 --max-profiles 10`
3. `npm run cohort:diversity -- --cohort-run-id run_local_showcase_sample --run-id run_local_diversity_sample`
4. `npm run cohort:select -- --source-run-id run_showcase_diverse --run-id run_local_showcase_diverse --normalized-root tests/fixtures/showcase-cohort --min-profiles 5 --max-profiles 10`
5. `npm run cohort:diversity -- --cohort-run-id run_local_showcase_diverse --run-id run_local_diversity_compliant`
6. `npm run build`

## Rule Violation Flagging Evidence
- Cohort run `run_local_showcase_sample` was flagged before finalization:
  - Missing required categories: `chronic-care`, `preventive-care`
  - Dominance violation: `general` at 100%
  - `isCompliant: false`, `finalized: false`

## Compliant Diversity Evidence
- Cohort run `run_local_showcase_diverse` produced compliant distribution:
  - totalProfiles: 6
  - categoryDistribution:
    - chronic-care: 2
    - preventive-care: 2
    - symptom-oriented: 1
    - general: 1
  - categoryShare max: 33.3% (below 60% threshold)
  - `violations: []`, `isCompliant: true`, `finalized: true`

## Repeatability Evidence
- Diversity checks are deterministic for a given cohort artifact set and threshold configuration.
- Unit tests verify both compliant and violating scenarios in repeatable local runs.

## Acceptance Criteria Trace
1. Cohort includes varied contexts such as chronic disease and preventive care: **Pass**
2. Coverage report lists category distribution across selected profiles: **Pass**
3. No single category dominates cohort unless explicitly configured: **Pass**
4. Rule violations are flagged before finalizing cohort: **Pass**
5. Diversity checks are repeatable for refresh runs: **Pass**

## Output Paths Verified
- `.propel/context/data/curated/showcase-cohort-diversity/run_local_diversity_sample/diversity-report.json`
- `.propel/context/data/curated/showcase-cohort-diversity/run_local_diversity_compliant/diversity-report.json`
- `.propel/context/data/curated/showcase-cohort-diversity/run_local_diversity_compliant/finalized-cohort-profiles.json`