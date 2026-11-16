---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-presence.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T13:05:26Z
validation_status: blocked
-->

# Getting started

Onboarding for **@webex/internal-plugin-presence**, a package inside the `webex-js-sdk` Yarn
workspace. Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=16`. The workspace root `package.json` `engines.node` reads `18.x`, which conflicts with the other pins; the build, unit tests, and lint pass on 22.14 |
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
yarn workspace @webex/internal-plugin-presence build:src
```

`build:src` writes JavaScript and source maps for the six source files to `dist/` through
`webex-legacy-tools`. `dist/` is ignored by Git. The `build` script runs `yarn build:src`; the package
emits no type declarations.

```bash
yarn workspace @webex/internal-plugin-presence build
```

## Run

N/A — this is a library with no start script. Importing `@webex/internal-plugin-presence` registers
`webex.internal.presence`. `enable`, `disable`, and `isEnabled` need the host to register
`@webex/internal-plugin-feature`, and the worker needs `@webex/internal-plugin-mercury`.

## Tests

```bash
yarn workspace @webex/internal-plugin-presence test:unit
```

```bash
yarn workspace @webex/internal-plugin-presence test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-presence test:unit` | `test/unit/spec` | jest through `webex-legacy-tools` and `@webex/jest-config-legacy` | None; `@webex/test-helper-mock-webex` and sinon stubs |

Run `build:src` before `test:unit`. The unit specs import `@webex/internal-plugin-presence` by name,
which resolves to `dist/index.js`, so a stale build tests old code.

Both unit suites are `describe.skip`, so `test:unit` reports 2 skipped suites and 29 skipped cases and
exits zero without running anything. The reason is in the
[module specification](../src/docs/README.md#verification).

`test:style` lints `src/` with eslint through `@webex/eslint-config-legacy`.

- Coverage or quality gate: none; the package defines no coverage script, and the legacy Jest
  configuration it re-exports sets no threshold
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests and lint

`test:browser` runs `webex-legacy-tools test --integration --runner karma` over
`test/integration/spec/presence.js`, which needs live test users and the presence service and is
itself `describe.skip`. On 2026-11-12 under Node 22.14 the karma bundle failed to parse `isbot` (an ES
module in the workspace `node_modules`), so the run reported "0 tests completed" and still exited
zero. It is not listed in the table above because it verifies nothing today.

`yarn workspace @webex/internal-plugin-presence test` chains style, unit, integration, and browser
runs, and stops at `test:integration`, which is not defined in this package's `package.json`.

## Configuration and secrets

- Required configuration: none. Defaults live under `webex.config.presence` (`batcherWait`,
  `batcherMaxCalls`, `batcherMaxWait`); a host that wants the worker started at `ready` sets
  `config.presence.initializeWorker`, which has no default (`src/config.js`)
- Environment overrides: none read by this package
- Secret source: N/A; the package holds no secret and requests go through `webex.request`
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core` and `@webex/internal-plugin-device` resolve
  through the workspace; the host must also register `@webex/internal-plugin-feature` and
  `@webex/internal-plugin-mercury`
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-presence build:src` and check that it reports
   `Built internal-plugin-presence: 6 files`.
2. Run `yarn workspace @webex/internal-plugin-presence test:unit`.
3. Run `yarn workspace @webex/internal-plugin-presence test:style`.

Expected result: all three commands exit zero. The unit run reports 29 skipped tests and none run.
`test:style` prints warnings but no errors: four `require-jsdoc` warnings, three in `src/index.js` and
one in `src/presence.js`, and "File ignored" for `src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
