---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/calling.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-17T03:23:21Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/calling**, the TypeScript SDK package for Webex Calling clients. The package
lives at `packages/calling` in the webex-js-sdk workspace. Package commands below run from that
directory; `yarn workspace @webex/calling` followed by the script name, from the workspace root, is
equivalent.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js | 22.14, required for working in this repository by the workspace root `AGENTS.md`; the root `.nvmrc` selects `lts/jod`. This package's `package.json` declares `engines.node` `>=18`. |
| Yarn | `yarn@3.4.1`, pinned by the workspace root `packageManager` field |

- Node.js 22.14 for this repository and Yarn workspace tooling.
- Access required by the parent `webex-js-sdk` repository for workspace dependencies and integration/E2E credentials; never commit credentials.

## Install

Clone `https://github.com/webex/webex-js-sdk.git`, `cd webex-js-sdk`, select Node.js with
`nvm install 22.14` and `nvm use 22.14`, then install the workspace (yarn install) from the root:

```bash
yarn
```

The workspace build tools and shared packages must be built before package scripts run; follow the
workspace build step in the root `CONTRIBUTING.md`. That step is a workspace-root command, so this
package's manifest does not record it.

## Build

```bash
yarn workspace @webex/calling build:src
```

`build:src` runs `tsc`, which compiles `src/**/*.ts` into `dist/module` and writes declarations to
`dist/types` (`tsconfig.json`, `package.json` `main` and `types`). `yarn workspace @webex/calling compile` builds this package
and every workspace package it depends on, in topological order. Yarn 3 does not run the `prebuild`
script automatically; run `yarn workspace @webex/calling prebuild` first when you need a clean `dist/`.

| Task | Command |
|---|---|
| Build | `yarn workspace @webex/calling build:src` |
| Unit test | `yarn workspace @webex/calling test:unit` |
| Lint | `yarn workspace @webex/calling test:style` |
| E2E | `yarn workspace @webex/calling test:e2e` |
| TypeDoc | `yarn workspace @webex/calling build:docs` |

`yarn workspace @webex/calling build:docs` writes TypeDoc HTML to the workspace `docs/calling` tree; `yarn workspace @webex/calling docs` runs the same
TypeDoc entry (`src/api.ts`) without emitting output, as a documentation check.

## Run

N/A — library package with no start script. Browser journeys run through Playwright against a sample
page served at `PW_BASE_URL` (default `https://localhost:8000`, `playwright.config.ts`).

## Tests

```bash
yarn workspace @webex/calling test:unit
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/calling test:unit` | `src` (co-located `*.test.ts`, `jest.config.js` testMatch) | Jest 29 with ts-jest, jsdom environment, `--runInBand` | None; Webex SDK objects and media are mocked |
| System / E2E | `yarn workspace @webex/calling test:e2e` | `playwright/suites` | Playwright (workspace root binary through `yarn run -T`) | Browser, a served sample app, and approved test accounts |

- Coverage gate: `jest.config.js` collects coverage on every `test:unit` run and fails it below the
  global thresholds of 85% lines, functions, and statements and 80% branches, with lower per-folder
  thresholds for `src/Events/impl`, `src/Logger`, `src/Voicemail`, `src/SDKConnector`, and
  `src/CallHistory`.
- Enforcement source: `jest.config.js`.
- Verified on 2026-11-17 with Node.js 22.14: `yarn workspace @webex/calling test:unit` passes 32 suites and 908 tests and
  meets the thresholds; `yarn workspace @webex/calling test:style` reports 0 errors and 111 warnings. `yarn workspace @webex/calling test:e2e` was not
  run because it needs browsers and test accounts.

## Configuration and secrets

- Unit tests use mocks/fixtures. Jest resolves `@webex/internal-plugin-metrics` to the local stub
  `test/mocks/internal-plugin-metrics-stub.js` and maps `@webex/media-helpers`, `@webex/common`,
  `@webex/common-timers`, and `@webex/test-helper-*` to their workspace source, so specs run without
  the real plugins. `jest-preload.js` silences console output and provides `Worker` and
  `URL.createObjectURL` stand-ins.
- Playwright journeys require approved runtime accounts/tokens and environment configuration; obtain
  them through the team mechanism and never store them in source or logs. `PW_BASE_URL` and
  `PW_BROWSER` select the sample page and browser.
- Package or artifact access: `yarn` needs access to the registry configured for the workspace.
- Required neighboring repositories or workspace layout: the package runs inside the parent Yarn
  workspace; use package commands from `packages/calling`, or `yarn workspace @webex/calling`
  plus the script name from the repository root. Browser journeys use `playwright.config.ts`.
- Platform, simulator, device, or SDK setup: N/A for unit tests.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Precondition: Node.js 22.14, `yarn`, and the root `CONTRIBUTING.md` workspace build completed at the workspace root.
2. From the workspace root, run the build, one targeted unit test, and lint.
3. Run `yarn workspace @webex/calling test:unit` for the full unit suite.

Expected result: a successful `dist/` build plus green Jest/ESLint output verifies the package loop
(`dist/module/index.js` and `dist/types/index.d.ts` exist; Jest reports 32 suites passing).

## Next steps

- [Package agent instructions](../AGENTS.md)
- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
