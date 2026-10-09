---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-task.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-09T14:40:25Z
validation_status: pending
-->

# Getting started

Onboarding for **@webex/internal-plugin-task**. Commands run from the webex-js-sdk workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js | 22.14, required for working in this repository by the workspace root `AGENTS.md`; the root `.nvmrc` selects the Node 22 LTS line |
| Yarn | The version pinned by the workspace root `packageManager` field, provided through Corepack: enable Corepack for the selected Node.js version, as the workspace root `CONTRIBUTING.md` setup steps require. Workspaces are used, so install from the workspace root rather than this directory |
| Browser for `test:browser` | A local browser for the karma runner that `test:browser` starts through `@webex/legacy-tools` |

The `package.json` `engines` value `>=18` is the floor for applications that install the package,
not the development runtime.

## Install

The repository is already cloned when you are reading this file. Dependencies are resolved for the
whole workspace:

```bash
yarn install
```

## Build

```bash
yarn workspace @webex/internal-plugin-task build
```

`scripts.build` runs `build:src`, which uses the `@webex/legacy-tools` builder to compile `.js` and
`.ts` files from `src/` into the build output directory with source maps. The manifest records
`build:src` as the compile role and `build` as the package role.

## Run

N/A — library package with no start script. Import the package from a consumer so that
`webex.internal.task` exists.

## Tests

```bash
yarn workspace @webex/internal-plugin-task test:unit
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-task test:unit` | `test/unit/spec` | Jest | This package's build output and the built workspace packages it imports |
| Integration | `yarn workspace @webex/internal-plugin-task test:integration` | `test/integration/spec` | mocha (assertions via `@webex/test-helper-chai`) | The workspace test helper server that the runner starts; no Webex service, because the spec uses an in-file mock |
| Browser | `yarn workspace @webex/internal-plugin-task test:browser` | `test/unit/spec` and `test/integration/spec` | karma | A browser |
| Lint | `yarn workspace @webex/internal-plugin-task test:style` | `src/` | eslint | None |

- The browser run is manifest `commands.browser-test` with role `other`, because the SDD manifest
  `tests` schema allows only `unit`, `integration`, `e2e`, and `qa`.
- The browser run collects the unit specs too, and karma is configured with the browserify, mocha,
  and chai frameworks (sibling package legacy-tools, file src/utils/karma/karma.constants.ts). The
  unit specs call Jest globals such as `jest.fn`, so expect those specs to fail there; a passing
  browser run has not been verified.
- The integration spec defines its own `MockTask` and never imports this package, so a passing
  integration run says nothing about the plugin.
- Do not use the `package.json` script `test` as a verification command; it chains every tier,
  including the browser run.
- Coverage or quality gate: N/A — no coverage threshold.
- Enforcement source: none. `jest.config.js` re-exports `@webex/jest-config-legacy`, which sets
  `collectCoverage: false` and no threshold.
- Test environment or QA dependencies: none beyond the workspace; `test/unit/spec/task.js` imports
  this package by name, so see First-run verification for the build it needs.

## Configuration and secrets

- Required configuration: none. The plugin config is `{task: {}}` and `src/` reads no key from it,
  no environment variable, and no feature toggle.
- Secret source: none in this package. The access token is attached by the webex-core request
  pipeline at runtime, and encryption keys come from the encryption plugin.
- Package or artifact access: N/A — workspace dependencies only.
- Required neighboring repositories or workspace layout: the webex-js-sdk workspace, because sibling
  packages such as webex-core and internal-plugin-encryption are `workspace:*` dependencies.
- Platform, simulator, device, or SDK setup: N/A.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Select Node.js 22.14, enable Corepack (see Prerequisites), and run `yarn install` from the
   workspace root.
2. Run the workspace root `prebuild:modules` script. `yarn install` does not build the
   `webex-legacy-tools` CLI that this package's scripts call, because its binary lives in the
   untracked build output of the workspace legacy tools package. That root script installs again,
   then builds the workspace tools, the legacy tools, webex-core, and the `build:src` output of every
   workspace package that defines that script, including this package and the sibling plugins that
   its unit spec loads.
3. Run `yarn workspace @webex/internal-plugin-task build` and check that the build output contains
   `index.js`.
4. Run `yarn workspace @webex/internal-plugin-task test:unit`.

Expected result: Jest reports 3 suites and 17 tests passing — 9 in `test/unit/spec/task.js`, 7 in the
decrypt helper spec, and 1 in the encrypt helper spec. If `task.js` fails with
`Cannot find module '@webex/internal-plugin-task'` or a sibling plugin name, step 2 or 3 was skipped.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- [Task plugin specification](../src/docs/README.md)
