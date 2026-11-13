---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-dss.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T10:21:50Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/internal-plugin-dss**, a package inside the `webex-js-sdk` Yarn workspace.
Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=16`. The workspace root `package.json` `engines.node` reads `18.x`, which conflicts with the other two; the unit tests pass on 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building and unit tests |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

On a fresh checkout, prebuild the workspace before the first package build. `yarn` does not build
`@webex/legacy-tools`, whose `webex-legacy-tools` binary runs this package's build and tests, or the
sibling packages' `dist/`, which the unit specs load:

```bash
yarn prebuild:modules
```

It runs `yarn`, then builds the tools, the legacy tools, `@webex/webex-core`, and every package, in
that order (root `package.json`; see the workspace `CONTRIBUTING.md` "Prebuilding").

## Build

```bash
yarn workspace @webex/internal-plugin-dss build:src
```

`build:src` writes JavaScript and source maps for the seven source files to `dist/` through
`webex-legacy-tools`. `dist/` is ignored by Git. The `build` script runs `yarn build:src`; the
package has no `tsconfig.json` and emits no type declarations.

```bash
yarn workspace @webex/internal-plugin-dss build
```

## Run

N/A — this is a library with no start script. Importing `@webex/internal-plugin-dss` registers
`webex.internal.dss`; call `register()` before any lookup or search, because results arrive over
mercury.

## Tests

```bash
yarn workspace @webex/internal-plugin-dss build:src
yarn workspace @webex/internal-plugin-dss test:unit
yarn workspace @webex/internal-plugin-dss test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-dss test:unit` | `test/unit/spec` | jest runner through `webex-legacy-tools`, with chai, chai-as-promised, sinon, and `@webex/test-helper-mock-webex` | This package's built `dist/`, which `test/unit/spec/dss.ts` imports by package name, and the sibling packages' `dist/` |

- Coverage or quality gate: none; the legacy Jest configuration sets no threshold and the package
  defines no coverage script
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests

Run `build:src` before `test:unit`: `test/unit/spec/dss.ts` imports this package by name, which
resolves to `dist/index.js`, so a stale `dist/` tests old code. `test:unit` runs two suites with 61
cases, one of them skipped (`it.skip` in the `#_batchedLookup` block).

`test:browser` runs `webex-legacy-tools test --integration --runner karma` over
`test/integration/spec/dss.js`, a MockWebex spec with a stub mercury. On 2026-11-12 under Node 22.14
the karma bundle failed to parse `isbot` (an ES module in the workspace `node_modules`), so the run
reported "0 tests completed" and still exited zero. The spec also expects `unregister()` to call
`mercury.disconnect`, which `src/dss.ts` never does, so it would fail once it bundles. It is not
listed in the table above because it verifies nothing today.

`yarn workspace @webex/internal-plugin-dss test` chains style, unit, `test:integration`, and browser
runs, and stops at `test:integration`, which is not defined in this package's `package.json`.

## Configuration and secrets

- Required configuration: none; the defaults under `webex.config.dss` are `requestTimeout` 6000 ms,
  `batcherWait` 50 ms, `batcherMaxCalls` 50, and `batcherMaxWait` 150 ms (`src/config.ts`)
- Secret source: N/A; the package holds no secret
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core`, `@webex/internal-plugin-mercury`,
  `@webex/common`, and `@webex/common-timers` resolve through the workspace; the host must also
  provide `webex.internal.device` with an `orgId`, because every resource path embeds it
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-dss build:src`.
2. Run `yarn workspace @webex/internal-plugin-dss test:unit` and check that two suites pass with 60
   passed and 1 skipped of 61 cases.
3. Run `yarn workspace @webex/internal-plugin-dss test:style`.

Expected result: all three commands exit zero. `test:style` prints warnings but no errors: three in
`src/dss-errors.ts` (`import/prefer-default-export`, `require-jsdoc`, `class-methods-use-this`),
`no-restricted-exports` in `src/index.ts`, and "File ignored" for `src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
