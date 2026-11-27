---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/byods.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T13:41:05Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/byods**, the Bring Your Own Data Source (BYoDS) Node.js SDK. The package
lives at `packages/byods` in the webex-js-sdk workspace. Every command below runs from the workspace
root, as `yarn workspace @webex/byods <script>`.

## Prerequisites

| Tool or access | Version source or requirement |
| -------------- | ----------------------------- |
| Node.js | Development version: `.nvmrc` and the workspace root `AGENTS.md`; the workspace root `package.json` `engines.node` differs from it. This package declares no `engines` field. |
| Yarn | `packageManager` in the workspace root `package.json`, provided through Corepack, as the workspace root `CONTRIBUTING.md` describes |
| Network | HTTPS to the npm registry for install. The unit tests need no network. |
| Webex Service App | Client ID, client secret, and organization ID, plus a personal access token or refresh token, only for running against Webex (not for tests) |

## Install

Dependencies are resolved for the whole workspace, from the workspace root:

```bash
yarn
```

Fresh-checkout workspace setup (building `webex-legacy-tools` and sibling `dist/`) is owned by the
workspace root; see [Prebuilding](../../../CONTRIBUTING.md#prebuilding).

## Build

```bash
yarn workspace @webex/byods build:src
```

`build:src` compiles `src/` into `dist/` with the workspace legacy builder and then runs the `build` script,
which writes TypeScript declarations to `dist/types`. To produce only the declarations:

```bash
yarn workspace @webex/byods build
```

## Run

N/A — library package with no start script. The sibling private workspace byods-demo-server is a
sample Express application that imports this package's source and starts with its own `dev`
script; it needs real Service App credentials and is not a
verification command for this package.

## Tests

```bash
yarn workspace @webex/byods test:unit
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/byods test:unit` | `test/unit/spec` | Jest 27 with the babel-jest transform from the legacy Jest config, node test environment | None; jose and the transport are stubbed |
| Lint | `yarn workspace @webex/byods test:style` | `src/**/*.ts` | eslint with the workspace root `.eslintrc.js` | None |
| Docs check | `yarn workspace @webex/byods docs` | `src/index.ts` | typedoc, no output | None |

- `yarn workspace @webex/byods test` runs `test:style` and then `test:unit`; run the two separately to see each result.
- No integration, browser, or end-to-end tier exists: `package.json` defines no such script and the
  package has no `test/integration` directory. Only the `unit` tier is recorded in the SDD manifest.
- Coverage gate: `jest.config.js` collects coverage on every `test:unit` run and fails it below 85%
  lines, functions, and statements or 75% branches, measured over the whole package. The workspace
  pull-request workflow runs `test:unit` for changed packages, so the threshold applies in CI.
- Unit specs import source files by relative path, so they do not depend on a fresh `dist/`.
- Test environment or QA dependencies: none beyond the workspace install.

## Configuration and secrets

- `BYODS_ENVIRONMENT`: `integration` selects the Webex integration API and identity broker; any
  other value, or none, selects production. It is read when `BYODS` is constructed.
- Secrets: the application passes the Service App client ID and secret in `SDKConfig` and the
  personal access token or refresh token to the token manager methods. Never commit them, and never
  put them in test fixtures.
- Token storage: the default adapter keeps one token pair in memory. A persistent adapter is the
  application's responsibility; use one adapter and record per SDK instance.
- Package or artifact access: `yarn` needs access to the registry in the workspace root `.yarnrc.yml`.
- Required neighboring repositories or workspace layout: the webex-js-sdk workspace, for the legacy
  build, Jest, and Babel configuration packages.
- Platform, simulator, device, or SDK setup: N/A.

## First-run verification

1. Precondition: Node.js 22.14 and `yarn` completed at the workspace root.
2. Run `yarn workspace @webex/byods build:src` and check that `dist/index.js` and
   `dist/types/index.d.ts` exist.
3. Run `yarn workspace @webex/byods test:unit`.

Expected result: Jest reports 7 suites and 83 tests passing, and coverage stays above the threshold
(measured on 2026-11-13: 96.9% statements, 93.8% branches, 100% functions). Console output from the
SDK logger is silenced by `jest-preload.js`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- [BYoDS SDK specification](../src/docs/README.md)
