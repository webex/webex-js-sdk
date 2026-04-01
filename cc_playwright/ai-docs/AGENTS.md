# Playwright E2E Testing Framework

## Overview

The `playwright/` directory contains the end-to-end testing framework for Contact Center widgets.

This guide is for implementation workflow and usage. For technical internals, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Scope

Use this guide when the request involves:

- adding or updating Playwright scenarios
- fixing flaky E2E tests
- creating or updating suite wiring
- adding a new test set in `playwright/test-data.ts`
- updating shared framework behavior (`test-manager`, `Utils`, `global.setup`, `constants`)
- updating Playwright documentation

---

## Current Baseline (Aligns to `next`)

Current test sets and suites come from `playwright/test-data.ts`.

At the time of this doc update, the baseline suites are:

- `digital-incoming-task-tests.spec.ts`
- `task-list-multi-session-tests.spec.ts`
- `station-login-user-state-tests.spec.ts`
- `basic-advanced-task-controls-tests.spec.ts`
- `advanced-task-controls-tests.spec.ts`
- `dial-number-tests.spec.ts`
- `multiparty-conference-set-7-tests.spec.ts`
- `multiparty-conference-set-8-tests.spec.ts`
- `multiparty-conference-set-9-tests.spec.ts`

Do not assume additional sets/suites exist unless they are present in code.

---

## Required Workflow

1. Start with root orchestrator: `AGENTS.md`
2. For Playwright tasks, run template flow from:
   - `ai-docs/templates/playwright/00-master.md`
3. Complete pre-questions first:
   - `ai-docs/templates/playwright/01-pre-questions.md`
4. Implement via:
   - `ai-docs/templates/playwright/02-test-implementation.md`
5. If framework/docs must change, use:
   - `ai-docs/templates/playwright/03-framework-and-doc-updates.md`
6. Validate with:
   - `ai-docs/templates/playwright/04-validation.md`

Do not start coding before pre-questions are answered or assumptions are explicitly documented.

---

## New Scenario Requests

New E2E scenario generation is supported through requirements intake plus framework updates.

When asked to generate new Playwright scenarios:

1. Collect full requirements via the Playwright questionnaire
2. Decide whether existing sets/framework are sufficient
3. If not sufficient, include required framework changes in the same task:
   - `playwright/test-data.ts` (set mapping)
   - `playwright/test-manager.ts` (setup/cleanup capability)
   - `playwright/global.setup.ts` (env/token flow)
   - `playwright/constants.ts` and `playwright/Utils/*` as needed
4. Add suite/test files and wire them through `TEST_SUITE`
5. Update this doc and `ARCHITECTURE.md`

This keeps docs generic while still enabling scenario generation from questionnaire answers.

---

## Common Commands

```bash
# Run all E2E tests
yarn test:e2e

# List projects/tests
yarn playwright test --config=playwright.config.ts --list

# Run a suite
yarn test:e2e playwright/suites/<suite-file>.spec.ts

# Run a set/project
yarn test:e2e --project=SET_1
```

---

## OAuth Setup Model

- `playwright/global.setup.ts` runs one `OAuth` setup test.
- Inside that test, token collection groups are generated dynamically from `USER_SETS` using chunk size `2`.
- One parallel OAuth worker runs per generated group.
- With current `SET_1..SET_9`, this resolves to 5 groups:
  - `[SET_1, SET_2]`
  - `[SET_3, SET_4]`
  - `[SET_5, SET_6]`
  - `[SET_7, SET_8]`
  - `[SET_9]`
- Each group uses batch size 4 internally (`OAUTH_BATCH_SIZE=4`).
- Dial-number token is collected when configured.
- All env/token updates are written once via single `.env` upsert.

---

## Documentation Rules

When Playwright behavior changes:

- Update this file for runbook and workflow expectations
- Update `playwright/ai-docs/ARCHITECTURE.md` for technical architecture changes
- Keep docs aligned with actual files in `playwright/`
- Avoid hardcoding future/nonexistent sets or suite names

---

## Flakiness Guardrails

- `pageSetup` has a single bounded station logout/re-login recovery if `state-select` does not appear after telephony login.
- Multi-incoming digital scenarios should create/accept chat/email sequentially to reduce avoidable RONA races.
- `afterAll` cleanup in chained-call suites should guard state reads when setup never reached user-state visibility.
- Conference suites should run conference-state cleanup sequentially across shared-call agents (not in parallel) to avoid leg ownership races.

---

## Conference Coverage (SET_7, SET_8, SET_9)

- Multiparty conference scenarios are split across:
  - `playwright/tests/multiparty-conference-set-7-test.spec.ts`
  - `playwright/tests/multiparty-conference-set-8-test.spec.ts`
  - `playwright/tests/multiparty-conference-set-9-test.spec.ts`
- Scenario IDs use prefixes:
  - `CTS-MPC-*` (Multi-Party Conference matrix)
  - `CTS-TC-*` (Transfer Conference scenarios)
  - `CTS-SW-*` (Switch Conference scenarios)
- Skip policy used in implementation:
  - `EP_DN`/`EPDN` scenarios are retained as `test.skip(...)`
  - scenarios requiring more than 4 agents are retained as `test.skip(...)`
- Consolidation policy used in implementation:
  - repeated call-init flows are merged into single tests when scenario steps are sequentially compatible
  - consolidated IDs remain explicit in test names for traceability (for example `CTS-TC-09 and CTS-TC-10 ...`)
  - current combined groups include:
    - `SET_7`: `CTS-MPC-01+02`, `CTS-MPC-03+04`, `CTS-MPC-07+09+10`, `CTS-SW-02+03`
    - `SET_8`: `CTS-TC-09+10`, `CTS-TC-11+13`, `CTS-TC-14+15`
    - `SET_9`: `CTS-TC-01+02+03`, `CTS-TC-04+05`, `CTS-SW-05+06`
  - standalone conference-only scenarios are intentionally distributed for runtime parity:
    - `SET_7`: `CTS-SW-04`
    - `SET_8`: `CTS-SW-07`
    - `SET_9`: `CTS-TC-06`, `CTS-TC-07`, `CTS-TC-08`
  - scenario split note:
    - `CTS-TC-06` and `CTS-TC-07` run as separate tests (queue routing will not reliably re-route to an agent that RONA'd in the same session)

---

_Last Updated: 2026-03-09_
