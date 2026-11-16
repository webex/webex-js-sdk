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
lives at `packages/byods` in the webex-js-sdk workspace. Package commands below run from that
directory; `yarn workspace @webex/byods <script>` from the workspace root is equivalent.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js | 22.14, required for working in this repository by the workspace root `AGENTS.md`; the root `.nvmrc` selects `lts/jod` and the root `package.json` `engines.node` still declares `18.x`. This package declares no `engines` field. |
| Yarn | `yarn@3.4.1`, pinned by the workspace root `packageManager` field and provided through Corepack, as the workspace root `CONTRIBUTING.md` describes |
| Network | HTTPS to the npm registry for install. The unit tests need no network. |
| Webex Service App | Client ID, client secret, and organization ID, plus a personal access token or refresh token, only for running against Webex (not for tests) |

## Install

Dependencies are resolved for the whole workspace, from the workspace root:

```bash
yarn
```

The workspace build tools must be built before any package script runs, as the root
`CONTRIBUTING.md` describes:

```bash
yarn prebuild:modules
```

## Build

```bash
yarn build:src
```

`build:src` compiles `src/` into `dist/` with the workspace legacy builder and then runs `yarn build`,
which writes TypeScript declarations to `dist/types`. To produce only the declarations:

```bash
yarn build
```

Yarn 3 does not run the `prebuild` script automatically; run `yarn prebuild` first when you need a
clean `dist/` (architecture Commands and generated artifacts).

## Run

N/A — library package with no start script. The sibling private workspace byods-demo-server is a
sample Express application that imports this package's source and starts with its own `dev`
script; it needs real Service App credentials and is not a
verification command for this package.

## Tests

```bash
yarn test:unit
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn test:unit` | `test/unit/spec` | Jest 27 with the babel-jest transform from the legacy Jest config, node test environment | None; jose and the transport are stubbed |
| Lint | `yarn test:style` | `src/**/*.ts` | eslint with the workspace root `.eslintrc.js` | None |
| Docs check | `yarn docs` | `src/index.ts` | typedoc, no output | None |

- `yarn test` runs `test:style` and then `test:unit`; run the two separately to see each result.
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

1. Precondition: Node.js 22.14, `yarn`, and `yarn prebuild:modules` completed at the workspace
   root.
2. From `packages/byods`, run `yarn build:src` and check that `dist/index.js` and
   `dist/types/index.d.ts` exist.
3. Run `yarn test:unit`.

Expected result: Jest reports 7 suites and 83 tests passing, and coverage stays above the threshold
(measured on 2026-11-13: 96.9% statements, 93.8% branches, 100% functions). Console output from the
SDK logger is silenced by `jest-preload.js`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- [BYoDS SDK specification](../src/docs/README.md)
