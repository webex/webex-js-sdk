---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/http-core.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-09-23T06:29:48Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/http-core**. This package is one workspace member of the `webex-js-sdk`
monorepo, so dependencies are installed once at the workspace root and every package command is
addressed through `yarn workspace`.

## Prerequisites

| Tool or access   | Version or requirement                                                    |
| ---------------- | ------------------------------------------------------------------------- |
| Node.js          | `>=18` (`package.json` engines)                                            |
| Yarn             | Yarn Berry workspaces; this package is resolved via `workspace:*` dependencies in `package.json` |
| Webex test users | Required for the integration tier only, via `@webex/test-helper-test-users` (`package.json`) |

## Install

```bash
yarn install
```

Run it from the workspace root, not from this package directory — the lockfile and the
`workspace:*` dependencies this package declares in `package.json` are resolved there.

## Build

```bash
yarn workspace @webex/http-core build:src
```

This transpiles `src/` into `dist/` with sourcemaps, via `webex-legacy-tools build` as declared in
`package.json`. The `build` script is an alias that simply calls `build:src`.

## Run

Not applicable. This package is a library consumed by other SDK packages; it has no runnable entry
point of its own. `package.json` points `main` at `dist/index.js` and `devMain` at `src/index.js`.

## Tests

```bash
yarn workspace @webex/http-core test:unit
```

| Tier              | Command                                              | Test location      | Framework | External dependencies                                             |
| ----------------- | ---------------------------------------------------- | ------------------ | --------- | ----------------------------------------------------------------- |
| Unit              | `yarn workspace @webex/http-core test:unit`          | `test/unit`        | Jest      | None                                                              |
| Integration       | `yarn workspace @webex/http-core test:integration`   | `test/integration` | Mocha     | Local fixture HTTP server (`@webex/test-helper-make-local-url`) and provisioned Webex test users (`@webex/test-helper-test-users`) |
| Browser           | `yarn workspace @webex/http-core test:browser`       | `test/integration` | Karma     | A browser launcher; runs the same integration specs against the browser transport |

`yarn workspace @webex/http-core test` chains style, unit, integration, and browser in that order.

To run a single unit spec, pass a path relative to `test/unit/spec/`:

```bash
yarn workspace @webex/http-core test:unit --targets request/utils.js
```

- Coverage or quality gate: N/A — this package enforces no coverage threshold. The shared Jest
  configuration it inherits sets `collectCoverage: false` and declares no `coverageThreshold`, and
  the repository owner confirmed no external gate applies to this package.
- Enforcement source: `jest.config.js` (re-exports the shared `@webex/jest-config-legacy` config)
- Test environment or QA dependencies: the integration and browser tiers need network access and
  provisioned test users; the unit tier is self-contained.

## Configuration and secrets

- Required configuration: none for the unit tier.
- Optional runtime flag: `ENABLE_VERBOSE_NETWORK_LOGGING` turns on per-interceptor request logging
  in `src/lib/interceptor.js`. Leave it unset unless you are debugging; it logs full request options.
- Secret source: integration test users are provisioned by `@webex/test-helper-test-users`; no
  credentials belong in this package.
- Package or artifact access: publishing uses `yarn workspace @webex/http-core deploy:npm`.
- Required neighboring repositories or workspace layout: this package must be built inside the
  `webex-js-sdk` workspace; it depends on `@webex/common` via `workspace:*` in `package.json`.
- Platform, simulator, device, or SDK setup: the browser tier requires a browser launcher for Karma.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/http-core build:src`.
2. Check that `dist/index.js` exists and that no transpile errors were reported.
3. Run `yarn workspace @webex/http-core test:unit`.

Expected result: the build writes `dist/`, and the unit suite passes across
`test/unit/spec/index.js`, `test/unit/spec/interceptors/http-status.js`,
`test/unit/spec/request/index.js`, `test/unit/spec/request/request.shim.js`, and
`test/unit/spec/request/utils.js`.

## Next steps

- [Repository architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
