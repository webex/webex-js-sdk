---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-support.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T12:27:40Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/internal-plugin-support**, a package inside the `webex-js-sdk` Yarn workspace.
Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=18`. The workspace root `package.json` `engines.node` reads `18.x`, which conflicts with the other pins; the build, unit tests, and lint pass on 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building, unit tests, and linting |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

On a fresh checkout, prebuild the workspace before the first package build. `yarn` does not build
`@webex/legacy-tools`, whose `webex-legacy-tools` binary runs this package's build and tests, or the
sibling packages' `dist/`:

```bash
yarn prebuild:modules
```

It runs `yarn`, then builds the tools, the legacy tools, `@webex/webex-core`, and every package, in
that order (root `package.json`; see the workspace `CONTRIBUTING.md` "Prebuilding").

## Build

```bash
yarn workspace @webex/internal-plugin-support build:src
```

`build:src` writes JavaScript and source maps for the three source files to `dist/` through
`webex-legacy-tools`. `dist/` is ignored by Git. The `build` script runs `yarn build:src`; the package
emits no type declarations.

```bash
yarn workspace @webex/internal-plugin-support build
```

## Run

N/A — this is a library with no start script. Importing `@webex/internal-plugin-support` registers
`webex.internal.support`; `submitLogs` reads `webex.logger`, which the host must provide.

## Tests

```bash
yarn workspace @webex/internal-plugin-support test:unit
```

```bash
yarn workspace @webex/internal-plugin-support test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-support test:unit` | `test/unit/spec` | jest through `webex-legacy-tools` and `@webex/jest-config-legacy` | None; `@webex/test-helper-mock-webex` and sinon stubs |

Run `build:src` before `test:unit`. The unit spec imports `@webex/internal-plugin-support` by name, which
resolves to `dist/index.js`, so a stale build tests old code.

`test:style` lints `src/` with eslint through `@webex/eslint-config-legacy`.

- Coverage or quality gate: none; the package defines no coverage script, and the legacy Jest
  configuration it re-exports sets no threshold
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests and lint

`test:browser` runs `webex-legacy-tools test --integration --runner karma` over
`test/integration/spec/support.js`, which needs a live test user and the client logs service. On
2026-11-12 under Node 22.14 the karma bundle failed to parse `isbot` (an ES module in the workspace
`node_modules`), so the run reported "0 tests completed" and still exited zero. It is not listed in the
table above because it verifies nothing today.

`yarn workspace @webex/internal-plugin-support test` chains style, unit, integration, and browser runs,
and stops at `test:integration`, which is not defined in this package's `package.json`; the mocha
script for the integration spec is named `test:integratio:broken`.

## Configuration and secrets

- Required configuration: none. Defaults live under `webex.config.support` (`appType`, `appVersion`,
  `languageCode`, `incrementalLogs`); a host that wants a failed incremental upload resent sets
  `config.support.retryFailedLogUploadsAtNextInterval`, which has no default (`src/config.js`)
- Environment overrides: `ATLAS_SERVICE_URL` and `CLIENT_LOGS_SERVICE_URL` are read at import into
  `config.device.preDiscoveryServices`; no workspace code reads those entries
- Secret source: N/A; the package holds no secret and takes tokens from `webex.credentials`
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core` and `@webex/internal-plugin-device` resolve
  through the workspace; the host must also provide `webex.logger` (`@webex/plugin-logger`)
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-support build:src` and check that it reports
   `Built internal-plugin-support: 3 files`.
2. Run `yarn workspace @webex/internal-plugin-support test:unit`.
3. Run `yarn workspace @webex/internal-plugin-support test:style`.

Expected result: all three commands exit zero. The unit run reports 43 passing tests. `test:style`
prints warnings but no errors: two `require-jsdoc` warnings in `src/support.js` and "File ignored" for
`src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
