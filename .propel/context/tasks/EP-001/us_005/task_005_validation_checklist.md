# TASK-005 Validation Checklist: US-005 Smoke and UX States

## Validation Scope
- Story: US-005
- Task: TASK-005
- Date: 2026-07-30
- Validator: Copilot (GPT-5.3-Codex)

## Execution Summary
- Result: PASS
- Lint: PASS (`npm run lint`)
- Unit Tests: PASS (`npm run test`, 13 files, 34 tests)
- E2E Smoke: PASS (`npm run test:e2e`, 4 passed)

## Smoke Coverage Matrix
| Scenario | Expected | Result | Evidence |
| --- | --- | --- | --- |
| Selector to summary load (`Patient 400`) | Loading message then summary panel data appears | PASS | Playwright: `validates selector to summary flow and active profile visibility` |
| Switch profile (`Patient 400` -> `Patient 403`) | Re-load starts, chat re-gates, new summary renders | PASS | Playwright: `validates selector to summary flow and active profile visibility` |
| Failure state and retry (`Patient 401`, forced one-shot fail) | Distinct failure UI, retry guidance, chat remains disabled | PASS | Playwright: `validates load failure and retry recovery` |
| Retry recovery | Retry reloads summary and re-enables chat | PASS | Playwright: `validates load failure and retry recovery` |

## US-005 Acceptance Evidence
| Criteria | Status | Evidence |
| --- | --- | --- |
| AC-001: Selector before chat start | PASS | `/chat` smoke confirms selection + confirm flow before composing messages |
| AC-002: Summary panel with required fields | PASS | Panel sections render conditions, medications, care tasks, upcoming visits |
| AC-003: Chat gating on profile readiness | PASS | Chat disabled during loading/failure; enabled after successful load |
| AC-004: Active profile indicator remains visible | PASS | "Current profile: ..." remains visible after sending queued message |
| AC-005: Failure and retry UX | PASS | Distinct failure message, retry guidance, retry action restores normal flow |

## Manual UX Checks
- Profile summary remains visible alongside chat during interaction.
- Inline gate guidance text is present for all gating states.
- Message input and send action are disabled when chat is gated.
- Retry action transitions from failure -> loading -> ready states.

## Handoff Notes
- A non-production one-shot test hook (`window.__PHN_FAIL_PROFILE_LOAD_ONCE__`) is used only to deterministically validate failure-retry smoke behavior in E2E.
- Story is ready for implementation review.