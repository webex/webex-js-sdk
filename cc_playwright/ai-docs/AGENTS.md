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
# Run all Contact Center E2E tests
yarn workspace @webex/contact-center run test:e2e

# List projects/tests
yarn workspace @webex/contact-center run test:e2e --list

# Run a suite
yarn workspace @webex/contact-center run test:e2e cc_playwright/suites/<suite-file>.spec.ts

# Run a set/project
yarn workspace @webex/contact-center run test:e2e --project=SET_1
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

- Multiparty conference scenarios live in one file, `tests/multiparty-conference-test.spec.ts`, as four sections
  (`lifecycle`, `switch`, `transferAgent`, `transferQueue`) and use `createConferenceHelpers` from
  `Utils/conferenceUtils.ts`. Each set uses 4 agents plus a caller. The suite wrappers choose the sections per set
  (SET_7 = lifecycle + switch, SET_8 = transferAgent, SET_9 = transferQueue); to rebalance runtime, move a section
  between wrappers rather than splitting the file.
- Scenario IDs use prefixes: `CTS-MPC-*` (multi-party conference), `CTS-TC-*` (transfer), `CTS-SW-*` (switch).
- Selectors target the sample app, not the widgets: `#merge-conference` (labelled "Conference" on the main leg and
  "Merge" on the consult leg), `#exit-conference`, `#transfer-conference`, `#switch-to-main` / `#switch-to-consult`
  (both bound to one SDK control, both call `task.switchCall()`), `#end-consult`, `#transfer`.
- Conference membership is asserted from SDK-driven controls (`#exit-conference` visible), not the agent `Engaged`
  state, because Desktop-mode agents are not reliably moved to `Engaged` by the sample app.
- `consultTransfer` is always hidden by the SDK; transfer from a consult lobby goes through `#transfer-conference`
  (conference) or the consult-transfer workaround in `Utils/consultTransferWorkaround.ts`.
- Consolidated tests keep the merged IDs in their titles (for example `CTS-TC-09 and CTS-TC-10 ...`).
- Not implemented (no test exists): `CTS-MPC-08`, `CTS-TC-17`, `CTS-SW-08` (need more than 4 agents), `CTS-TC-18`,
  `CTS-SW-01` (EP-DN), `CTS-TC-12` (needs the `isEndConsultEnabled` flag).
- CTS-TC-06 and CTS-TC-07 stay separate tests: queue routing will not reliably re-route to an agent that RONA'd in the
  same session (TC-07 consults agent 3 for that reason).

---

_Last Updated: 2026-03-09_
