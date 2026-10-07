---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-mercury.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-07T00:19:43Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/internal-plugin-mercury**. Commands run from the webex-js-sdk workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js | `>=18`, declared in `package.json` `engines` |
| Yarn | Workspaces are used, so install from the workspace root rather than this directory |
| Browser for `test:browser` | A local browser for the karma runner that `test:browser` starts through `@webex/legacy-tools` |
| Webex test users | Needed only by the integration specs, which create users through `@webex/test-helper-test-users` |

## Install

The repository is already cloned when you are reading this file. Dependencies are resolved for the
whole workspace:

```bash
yarn install
```

## Build

```bash
yarn workspace @webex/internal-plugin-mercury build
```

`scripts.build` runs `build:src`, which uses the `@webex/legacy-tools` builder to compile `.js` and
`.ts` files from `src/` into `dist/` with source maps. The manifest records `build:src` as the
compile role and `build` as the package role.

## Run

N/A — library package with no start script. Import the package from a consumer; `webex` imports it
so that `webex.internal.mercury` exists.

## Tests

```bash
yarn workspace @webex/internal-plugin-mercury test:unit
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-mercury test:unit` | `test/unit/spec` | mocha, chai, sinon, fake timers | None |
| Unit and integration in a browser | `yarn workspace @webex/internal-plugin-mercury test:browser` | `test/unit/spec`, `test/integration/spec` | karma | A browser; provisioned Webex test users for the integration specs |
| Lint | `yarn workspace @webex/internal-plugin-mercury test:style` | `src/` | eslint | None |

- The browser run is manifest `commands.browser-test` with role `other`, because the SDD manifest
  `tests` schema allows only `unit`, `integration`, `e2e`, and `qa`.
- No standalone integration tier exists: `package.json` does not define `test:integration`, so the
  integration specs run only inside the browser run.
- Do not use the `package.json` script `test` as a verification command; it chains the undefined
  `test:integration`.
- Coverage or quality gate: N/A — no coverage threshold.
- Enforcement source: none. `test:unit` uses the legacy-tools Mocha runner without coverage, and
  `jest.config.js` re-exports `@webex/jest-config-legacy`, which sets `collectCoverage: false`.
- Test environment or QA dependencies: Webex test-user provisioning for integration specs only.

## Configuration and secrets

- Required configuration: none to build or unit-test. At runtime, `config.mercury` defaults come from
  `src/config.js`, and the environment variables `MERCURY_PING_INTERVAL`, `MERCURY_PONG_TIMEOUT`,
  `MERCURY_BACKOFF_TIME_MAX`, `MERCURY_BACKOFF_TIME_RESET`, `MERCURY_FORCE_CLOSE_DELAY`, and
  `MERCURY_LOGOUT_REASON` override them. `ENABLE_MERCURY_LOGGING` turns on envelope debug logs.
- Secret source: the access token comes from `webex.credentials` at runtime; this package reads no
  secret from files or the environment.
- Package or artifact access: N/A — workspace dependencies only.
- Required neighboring repositories or workspace layout: the webex-js-sdk workspace, because sibling
  packages such as webex-core and internal-plugin-device are `workspace:*` dependencies.
- Platform, simulator, device, or SDK setup: N/A.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn install` from the workspace root.
2. Run `yarn workspace @webex/internal-plugin-mercury build` and check that `dist/index.js` exists.
3. Run `yarn workspace @webex/internal-plugin-mercury test:unit`.

Expected result: mocha reports the `plugin-mercury` suites passing with no failures.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- [Mercury plugin specification](../src/docs/README.md)
