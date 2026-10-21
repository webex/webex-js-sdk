---
type: Getting Started
title: Getting started
description: Local setup, build, and test routing for @webex/webex-core.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rsarika@cisco.com
updated_at: 2026-10-07T13:20:21Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/webex-core**, a workspace package of the Webex JS SDK monorepo. Every command
runs from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| --- | --- |
| Node.js | `>=18` per the package `engines`; the repository `.nvmrc` pins `lts/jod`, and the repo AGENTS instructions ask for 22.14 |
| Yarn | 3.4.1 (root `packageManager`) |
| Webex test users and network access | Required only for the integration and browser suites (see Tests) |

## Install

```bash
yarn install
```

## Build

```bash
yarn workspace @webex/webex-core build:src
```

The build transpiles `src` (js and ts) into the git-ignored `dist` directory that `main` points at.
Consumers inside the workspace that resolve the package by name read `dist`, so rebuild after changing
`src` before trusting a dependent package's tests.

## Run

N/A — the package is a library with no runnable entry point. It is exercised through the unit and
integration suites and through dependent plugins.

## Tests

```bash
yarn workspace @webex/webex-core test:unit
```

| Tier | Command | Test location | Framework | External dependencies |
| --- | --- | --- | --- | --- |
| Unit | `yarn workspace @webex/webex-core test:unit` | `test/unit/spec` | Jest, sinon, chai | None |
| Integration | `yarn workspace @webex/webex-core test:integration` | `test/integration/spec` | Mocha | Provisioned Webex test users, live U2C and identity-broker services, a local fixture server |
| Browser | `yarn workspace @webex/webex-core test:browser` | `test/integration/spec` | Karma | A browser runner plus the integration dependencies |
| Lint | `yarn workspace @webex/webex-core test:style` | `src` | ESLint | None |

- Coverage or quality gate: none enforced for this package (`quality_gates.code_coverage.origin: none`).
- Enforcement source: `.sdd/manifest.json` `quality_gates`.
- Test environment or QA dependencies: the integration tiers need provisioned test users from the shared
  test helpers; the unit tier needs nothing external.
- To run one unit file, pass a path relative to `test/unit/spec`, for example
  `yarn workspace @webex/webex-core test:unit --targets credentials/token.js`.
- The aggregate `test` script chains lint, unit, integration and browser tiers, so it needs the
  integration environment.

## Configuration and secrets

- Required configuration: none for unit tests. Many defaults in `src/config.js` and
  `src/credentials-config.js` read environment variables at import time (for example `U2C_SERVICE_URL`,
  `HYDRA_SERVICE_URL`, `WEBEX_CLIENT_ID`); see the root module specification.
- Secret source: client ids and secrets come from environment variables or host config; never commit them.
- Package or artifact access: the workspace resolves siblings through yarn workspaces; publishing uses
  `yarn workspace @webex/webex-core deploy:npm`.
- Required neighboring packages: `@webex/common`, `@webex/common-timers`, `@webex/http-core` and
  `@webex/storage-adapter-spec` (workspace dependencies).
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn install`.
2. Run `yarn workspace @webex/webex-core test:unit --targets lib/batcher.js`.
3. Run `yarn workspace @webex/webex-core test:style`.

Expected result: the targeted Jest file passes and ESLint reports no errors.

## Next steps

- [Repository architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
