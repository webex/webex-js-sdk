---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for webex-node.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-15T23:00:24Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **webex-node**. Commands run from the webex-js-sdk workspace root. The workspace name
is `webex-node`, without an `@webex/` scope, and the package lives at `packages/webex-node`.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js | 22.14, required for working in this repository by the workspace root `AGENTS.md`; the root `.nvmrc` selects the Node 22 LTS line (the root `package.json` `engines.node` still declares `18.x`; the root `AGENTS.md` and `.nvmrc` take precedence for development) |
| Yarn | The version pinned by the workspace root `packageManager` field, provided through Corepack, which must be enabled for the selected Node.js version, as the workspace root `CONTRIBUTING.md` setup requires. Workspaces are used, so install from the workspace root rather than this directory |
| Browser | Not needed: the package has no browser test script and is not meant for browsers |

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
yarn workspace webex-node build
```

`scripts.build` runs `build:src`, which uses the `@webex/legacy-tools` builder to compile `.js` and
`.ts` files from `src/` into the build output directory with source maps. The manifest records
`build:src` as the compile role and `build` as the package role.

## Run

N/A — library package with no start script. A Node.js application loads the package and calls
`WebexNode.init`. The sibling package test-webex-node is a manual smoke script that does this with a
placeholder token; it is not a verification command for this package.

## Tests

```bash
yarn workspace webex-node test:unit
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace webex-node test:unit` | `test/unit/spec` | Jest (Node test environment) | Built workspace packages that the spec loads; network access is attempted but not required (see below) |
| Lint | `yarn workspace webex-node test:style` | `src/` | eslint | None |

- No integration, browser, or end-to-end tier exists: `package.json` defines only `test:unit` and
  `test:style`, and the package has no `test/integration` directory. The SDD manifest `tests` schema
  allows only `unit`, `integration`, `e2e`, and `qa`; only `unit` is recorded.
- The `package.json` script `test` chains `test:style` and `test:unit`. Run the two manifest
  commands instead so each result is visible.
- The unit tests construct real instances. With webex-core's default services settings, once an
  instance emits `ready` and no cached catalog exists, webex-core services requests the service
  catalog. Without network access these requests fail, errors are logged, and the tests still pass.
- Coverage or quality gate: N/A — no coverage threshold.
- Enforcement source: none. `jest.config.js` re-exports `@webex/jest-config-legacy`, which sets
  `collectCoverage: false` and no threshold.
- Test environment or QA dependencies: none beyond the workspace. The spec imports
  `src/webex-node.js`, which loads `@webex/webex-core` and the plugin packages by name, and those
  names resolve to each package's build output, so a fresh clone needs the workspace build described
  in First-run verification.

## Configuration and secrets

- Required configuration: none to build or test. At runtime, `src/config.js` reads
  `HYDRA_SERVICE_URL`; the values it declares are not applied today (module spec `MOD-007`).
- Secret source: the application passes its access token or OAuth settings to `WebexNode.init`.
  The unit spec reads an optional `token` environment variable for one test, which passes without it.
- Package or artifact access: `yarn install` needs network access to the configured npm registry
  (or a proxy), because registry packages such as `lodash`, `@babel/polyfill`, and `eslint` are
  declared and no Yarn cache is committed.
- Required neighboring repositories or workspace layout: the webex-js-sdk workspace, because
  webex-core and the plugin packages are `workspace:*` dependencies.
- Platform, simulator, device, or SDK setup: N/A.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Precondition: a workspace that uses Node.js 22.14 (see Prerequisites) and has completed the
   Dependencies and Prebuilding setup in the root `CONTRIBUTING.md`. Installing alone is not
   enough: the `webex-legacy-tools` CLI that this package's scripts call is untracked build output
   of the workspace legacy tools package, and the unit spec loads the built output of webex-core
   and the plugin packages.
2. Run `yarn workspace webex-node build` and check that the build output contains `index.js`.
3. Run `yarn workspace webex-node test:unit`.

Expected result: Jest reports `test/unit/spec/webex-node.test.js` passing with 5 tests: three in
the `init()` group and two in the `fedramp` group. Logged catalog request errors are expected
without network access.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- [webex-node SDK entry specification](../src/docs/README.md)
