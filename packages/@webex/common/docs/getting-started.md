---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/common.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-09-21T08:58:59Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/common**, a package inside the `webex-js-sdk` monorepo. Every command runs
from the **monorepo root**, not from this package directory.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| node | `>=16` per `package.json` engines. The monorepo root `AGENTS.md` directs contributors to node 22.14 via nvm; that is the wider workspace requirement and satisfies this floor |
| yarn | Yarn workspaces (the repository uses `workspace:*` protocol dependencies) |
| Registry, VPN, or account | N/A for building and testing. Publishing requires npm credentials and is handled centrally by release automation |

## Install

```bash
git clone https://github.com/webex/webex-js-sdk.git
```

```bash
yarn install
```

Install resolves the whole workspace. This package's four toolchain devDependencies
(`@webex/babel-config-legacy`, `@webex/eslint-config-legacy`, `@webex/jest-config-legacy`,
`@webex/legacy-tools`) are workspace-internal and are linked, not downloaded.

## Build

```bash
yarn workspace @webex/common build:src
```

Transpiles `src` into `dist` as JavaScript plus source maps. No `.d.ts` files are produced,
because the package has no TypeScript sources. Never edit `dist` by hand.

## Run

```bash
yarn workspace @webex/common build:src
```

N/A as a standalone application — this is a library with no dev server, CLI, or runnable entry
point. Building it is the only local "run" step; exercise it through a consuming package or the
unit tests.

## Tests

```bash
yarn workspace @webex/common test:unit
```

Use the table as the repository-level test router. Only tiers that actually exist are listed;
behavioral intent belongs in the owning module specification and exact cases remain in the
repository's native test sources.

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/common test:unit` | `test/unit/spec` | jest via `@webex/jest-config-legacy` | None |
| Integration | N/A — no integration tier exists in this package | N/A | N/A | N/A |
| System / E2E | N/A — no end-to-end tier exists in this package | N/A | N/A | N/A |

The package's aggregate `test` script is **not usable**: it chains `test:integration` and
`test:browser`, neither of which is defined in `package.json`, and neither directory exists. It
always fails after the unit tier passes. Run the unit command above instead.

Lint separately with `yarn workspace @webex/common test:style`.

- Coverage or quality gate: N/A — no coverage threshold is configured for this package.
  `jest.config.js` delegates wholesale to the shared workspace config and declares no
  per-package threshold, and `package.json` defines no coverage script.
- Enforcement source: `jest.config.js`, `package.json`
- Test environment or QA dependencies: none. The unit tier runs offline with no fixtures,
  containers, or service dependencies.

## Configuration and secrets

- Required configuration: none. The package reads no config file. The only environment input is
  `NODE_ENV`, which `src/deprecated.js` checks to disable the deprecation decorator in production.
- Secret source: N/A — the package holds no credentials and opens no connections.
- Package or artifact access: N/A for local development. Publishing uses npm credentials held by
  release automation.
- Required neighboring repositories or workspace layout: the package must stay inside the
  `webex-js-sdk` workspace so its `workspace:*` toolchain dependencies resolve.
- Platform, simulator, device, or SDK setup: none. The package targets Node and browsers, but the
  browser variant is selected at bundle time by the `package.json` browser field, so no browser
  tooling is needed to build or unit-test it.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/common build:src`.
2. Check that `dist/index.js` exists and `dist` contains one `.js` file per `src` module.
3. Run `yarn workspace @webex/common test:unit`.

Expected result: the build writes `dist` without error, and jest reports 8 passed suites and
39 tests (38 passed, 1 skipped).

## Next steps

- [Repository architecture](architecture.md)
- Service specification — not applicable for this package
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- [Module specification](../src/docs/README.md)
