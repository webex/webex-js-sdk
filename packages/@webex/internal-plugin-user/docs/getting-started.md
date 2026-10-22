---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-user.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-10-22T06:52:30Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/internal-plugin-user**. Commands run from the webex-js-sdk workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js | `>=18`, declared in `package.json` `engines`. Follow the workspace root setup instructions for the exact version. |
| Yarn | Workspaces are used, so install from the workspace root rather than this directory |
| Live services and test users | Only for `test/integration/spec/user.js`, which `@webex/test-helper-test-users` drives against real services |

## Install

The repository is already cloned when you are reading this file. Dependencies are resolved for the
whole workspace:

```bash
yarn
```

## Build

```bash
yarn workspace @webex/internal-plugin-user build
```

`scripts.build` runs `build:src`, which uses the `@webex/legacy-tools` builder to compile `.js` and
`.ts` files from `src/` into `dist/` with source maps. The manifest records `build:src` as the
compile role and `build` as the package role.

## Run

N/A — library package with no start script. Import the package from a consumer; sibling packages such
as internal-plugin-conversation import it so that `webex.internal.user` exists.

## Tests

```bash
yarn workspace @webex/internal-plugin-user test:unit
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-user test:unit` | `test/unit/spec` | jest, chai, sinon, `@webex/test-helper-mock-webex` | None |
| Browser (karma, marked broken) | `yarn workspace @webex/internal-plugin-user test:browser:broken` | `test/integration/spec` | karma | A browser, live services, and test users |
| Lint | `yarn workspace @webex/internal-plugin-user test:style` | `src/` | eslint | None |

- The browser run is manifest `commands.browser-test-broken` with role `other`, because the SDD
  manifest `tests` schema allows only `unit`, `integration`, `e2e`, and `qa`. Its script name in
  `package.json` ends in `:broken`; treat it as unsupported.
- No standalone integration command exists: `package.json` does not define `test:integration`.
  `test/integration/spec/user.js` is reachable only through the broken karma script.
- Do not use the `package.json` script `test` as a verification command; it chains the undefined
  `test:integration` and `test:browser`.
- Coverage or quality gate: N/A — the owner confirmed that the only enforced gates are eslint
  (`test:style`) and jest unit pass or fail (`test:unit`).
- Enforcement source: none. `jest.config.js` re-exports `@webex/jest-config-legacy`, which sets
  `collectCoverage: false` and no `coverageThreshold`, and `package.json` has no coverage script.
- Test environment or QA dependencies: unit tests use `MockWebex` and need nothing external.

## Configuration and secrets

- Required configuration: none to build or unit-test. At runtime the plugin reads `config.user`
  (`batcherWait`, `batcherMaxCalls`, `batcherMaxWait`, `verifyDefaults`) from `src/config.js` and the
  `config.credentials` URLs and client credentials that the host application supplies
  (`activationUrl`, `generateOtpUrl`, `validateOtpUrl`, `setPasswordUrl`, `identity`, `idbroker`,
  `client_id`, `client_secret`, `scope`). The environment variable `ATLAS_SERVICE_URL` overrides the
  atlas address in `config.device.preDiscoveryServices`.
- Secret source: client credentials and tokens come from the host application and `webex.credentials`
  at runtime; this package reads no secret from files.
- Package or artifact access: N/A — workspace dependencies only.
- Required neighboring repositories or workspace layout: the webex-js-sdk workspace, because
  `@webex/common`, `@webex/internal-plugin-device`, and `@webex/webex-core` are `workspace:*`
  dependencies.
- Platform, simulator, device, or SDK setup: N/A.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn` from the workspace root.
2. Run `yarn workspace @webex/internal-plugin-user build` and check that `dist/index.js` exists.
3. Run `yarn workspace @webex/internal-plugin-user test:unit`.

Expected result: jest reports the `plugin-user` suites passing with no failures.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- [User plugin specification](../src/docs/README.md)
