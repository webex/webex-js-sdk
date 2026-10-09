---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-locus.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-09T06:22:13Z
validation_status: pending
-->

# Getting started

Onboarding for **@webex/internal-plugin-locus**. Commands run from the webex-js-sdk workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js | `>=18`, declared in `package.json` `engines` |
| Yarn | Workspaces are used, so install from the workspace root rather than this directory |
| Browser for `test:browser` | A local browser for the karma runner that `test:browser` starts through `@webex/legacy-tools` |

## Install

The repository is already cloned when you are reading this file. Dependencies are resolved for the
whole workspace:

```bash
yarn install
```

## Build

```bash
yarn workspace @webex/internal-plugin-locus build
```

`scripts.build` runs `build:src`, which uses the `@webex/legacy-tools` builder to compile `.js` and
`.ts` files from `src/` into the build output directory with source maps. The manifest records
`build:src` as the compile role and `build` as the package role.

## Run

N/A — library package with no start script. Import the package from a consumer so that
`webex.internal.locus` exists.

## Tests

```bash
yarn workspace @webex/internal-plugin-locus test:unit
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-locus test:unit` | `test/unit/spec`, fixtures in `test/unit/lib` | Jest, chai, `@webex/test-helper-mock-webex` | Built workspace packages that the spec imports |
| Browser | `yarn workspace @webex/internal-plugin-locus test:browser` | Integration specs; none exist in this package | karma | A browser |
| Lint | `yarn workspace @webex/internal-plugin-locus test:style` | `src/` | eslint | None |

- The browser run is manifest `commands.browser-test` with role `other`, because the SDD manifest
  `tests` schema allows only `unit`, `integration`, `e2e`, and `qa`.
- No integration tier exists: `package.json` does not define `test:integration`, and the package
  has no `test/integration` directory, so the browser run has nothing to execute here.
- Do not use the `package.json` script `test` as a verification command; it chains the undefined
  `test:integration`.
- Coverage or quality gate: N/A — no coverage threshold.
- Enforcement source: none. `jest.config.js` re-exports `@webex/jest-config-legacy`, which sets
  `collectCoverage: false` and no threshold.
- Test environment or QA dependencies: none beyond the workspace. The unit spec imports
  `@webex/test-helper-chai`, `@webex/test-helper-mock-webex`, and this package by name, and those
  names resolve to each package's build output, so build the workspace packages first in a fresh
  clone.

## Configuration and secrets

- Required configuration: none. `registerInternalPlugin` receives no config, and `src/` reads no
  environment variable or feature toggle.
- Secret source: none in this package. The access token is attached by the webex-core request
  pipeline at runtime.
- Package or artifact access: N/A — workspace dependencies only.
- Required neighboring repositories or workspace layout: the webex-js-sdk workspace, because sibling
  packages such as webex-core and internal-plugin-mercury are `workspace:*` dependencies.
- Platform, simulator, device, or SDK setup: N/A.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn install` from the workspace root.
2. Run `yarn workspace @webex/internal-plugin-locus build` and check that the build output contains
   `index.js`.
3. Run `yarn workspace @webex/internal-plugin-locus test:unit`.

Expected result: Jest reports the `plugin-locus` suite passing, 134 tests across the basic, sequence,
and delta sequence comparison groups.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- [Locus plugin specification](../src/docs/README.md)
