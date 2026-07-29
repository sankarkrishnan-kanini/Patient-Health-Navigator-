# TASK-004 Smoke Validation Notes

## Context
- Parent story: US-001
- Task: TASK-004 Run Smoke Validation and Update Execution Notes
- Date: 2026-07-29

## Environment
- Workspace root: `C:/Users/SankarKrishnan/Downloads/PropelIQ-Stub-Copilot`
- Node package manager: npm
- Runtime target: Next.js App Router local dev

## Verification Steps Executed
1. Compile stability check:
   - Command: `npm run build`
   - Result: Pass
2. Local runtime startup check:
   - Command: `npm run dev -- -p 3020`
   - Result: Pass, server ready on `http://localhost:3020`
3. Endpoint smoke checks:
   - Command set: PowerShell `Invoke-WebRequest` calls for `/`, `/api/health`, `/api/chat`, `/api/patient-profile`
   - Result: Pass (expected scaffold behavior)

## Endpoint Results
- `GET /` -> `200 OK` (app shell HTML rendered)
- `GET /api/health` -> `200 OK`
  - Body contains `success: true` and `data.status: "ok"`
- `GET /api/chat` -> `501 Not Implemented`
  - Body contains `error.code: "NOT_IMPLEMENTED"`
- `GET /api/patient-profile` -> `501 Not Implemented`
  - Body contains `error.code: "NOT_IMPLEMENTED"`

## Stability Outcome
- Build and type checks are stable.
- App starts without fatal errors on a clean port.
- Scaffold endpoints are callable and return expected status/payload shape.

## Issues Logged for Follow-Up
1. Port collision on default dev port (`3000`) was observed in prior runs; startup auto-switched to another port.
   - Impact: Low
   - Follow-up: Before onboarding demos, stop stale local Next.js processes or run with explicit `-p` argument.
2. In one stale server instance (`3010`), `/api/health` and `/api/chat` intermittently returned `500`.
   - Impact: Low
   - Follow-up: Use a clean dev server instance for smoke validation; if repeated, investigate stale process cache/runtime state.

## Developer Handoff Notes
- Standard startup:
  1. `npm install`
  2. `npm run dev`
- If port conflicts occur:
  - `npm run dev -- -p 3020`
- Quick smoke check sequence:
  1. `npm run build`
  2. `GET /api/health` expects `200`
  3. `GET /api/chat` expects `501`
  4. `GET /api/patient-profile` expects `501`

## TASK-004 Acceptance Criteria Check
1. Application starts without fatal errors: **Pass**
2. Health-check endpoint returns expected success payload: **Pass**
3. Placeholder endpoints return expected scaffold response: **Pass**
4. Verification steps are documented for developers: **Pass**
5. US-001 acceptance checklist marked with evidence: **Pass** (see `us_001.md`)