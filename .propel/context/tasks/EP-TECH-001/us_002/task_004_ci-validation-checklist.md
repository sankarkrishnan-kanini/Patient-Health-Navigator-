# TASK-004 CI Validation Checklist

## Context
- Parent story: US-002
- Task: TASK-004 Add CI-Ready Scripts and Validation Checklist
- Date: 2026-07-29

## Script Catalog (CI Baseline)
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run build`

## Validation Results
1. `npm run lint` -> **Pass**
   - Outcome: No ESLint warnings or errors.
2. `npm run test` -> **Pass**
   - Outcome: 2 files passed, 7 tests passed.
3. `npm run test:e2e` -> **Pass**
   - Outcome: 2 Playwright smoke tests passed in headless mode.
4. `npm run build` -> **Pass**
   - Outcome: Production build completed successfully.

## Expected Outcomes for CI
- Lint returns exit code 0.
- Unit tests return exit code 0 and deterministic pass/fail report.
- E2E smoke returns exit code 0 and emits artifacts to `playwright-report/` and `test-results/`.
- Build returns exit code 0 and completes static/dynamic route compilation.

## Failure Handling and Rerun Commands
- Re-run all quality gates sequentially:
  1. `npm run lint`
  2. `npm run test`
  3. `npm run test:e2e`
  4. `npm run build`
- Debug E2E interactively:
  - `npm run test:e2e:headed`
  - `npx playwright show-report`

## Notes for Follow-Up
- `next lint` reports deprecation guidance for Next.js 16 migration to ESLint CLI.
- Vitest reports a non-blocking Vite CJS API deprecation warning.