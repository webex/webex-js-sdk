---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/plugin-authorization-browser.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-04T08:54:29Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/plugin-authorization-browser**, a package inside the `webex-js-sdk` Yarn
workspace. Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=18`. The workspace root `package.json` `engines.node` still reads `18.x`, which conflicts with the other two; the unit tests pass on 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building and unit tests; the integration suite needs live Webex services and a test app user |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

## Build

```bash
yarn workspace @webex/plugin-authorization-browser build
```

`build` runs `build:src`, which writes `dist/` through `webex-legacy-tools`. `dist/` is ignored by Git.

## Run

N/A — this is a browser library with no start script. Import `@webex/plugin-authorization-browser`
(or `@webex/plugin-authorization` in a browser build) and create a webex instance; the plugin is then
`webex.authorization`.

## Tests

```bash
yarn workspace @webex/plugin-authorization-browser build:src
yarn workspace @webex/plugin-authorization-browser test:unit
yarn workspace @webex/plugin-authorization-browser test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/plugin-authorization-browser test:unit` | `test/unit/spec` | jest runner through `webex-legacy-tools`, with chai, sinon, and `@webex/test-helper-mock-webex` | A current `dist/` (the spec imports the package by name) |
| Integration | `yarn workspace @webex/plugin-authorization-browser test:browser:broken` (karma through `webex-legacy-tools --integration`); not a verification command | `test/integration/spec` | mocha-style `browserOnly` spec | Live Webex services, a browser, and a test app user created by `@webex/test-helper-appid` from `WEBEX_APPID_ORGID` and `WEBEX_APPID_SECRET` |
| Automation | None runnable from the package: both suites are `describe.skip` | `test/automation/spec` | mocha-style specs with `@webex/test-helper-automation` | Live Webex services, test users, `WEBEX_REDIRECT_URI` |

- Coverage or quality gate: none; the legacy Jest configuration sets no threshold, and the developer
  confirmed that no outside gate applies
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests

Do not run `yarn workspace @webex/plugin-authorization-browser test`: it chains the undefined
`test:integration` and `test:browser` scripts.

## Configuration and secrets

- Required configuration: `credentials.client_id`, `redirect_uri`, and `scope`; `clientType` defaults
  to `public` in `src/config.js`, and `confidential` switches login to the authorization-code grant
- Secret source: N/A for unit tests, which use fake values; `createJwt` takes a guest issuer secret
  from the caller
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core`, `@webex/common`, and
  `@webex/internal-plugin-device` resolve through the workspace
- Platform, simulator, device, or SDK setup: a browser window (`location`, `history`,
  `sessionStorage`); unit tests supply a mock window
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/plugin-authorization-browser build:src`.
2. Run `yarn workspace @webex/plugin-authorization-browser test:unit` and check that the
   `plugin-authorization-browser` suite lists the `#initialize()`, `#initiateLogin()`, `#_cleanUrl()`,
   `#initiateImplicitGrant()`, and `#initiateAuthorizationCodeGrant()` cases (22 tests).
3. Run `yarn workspace @webex/plugin-authorization-browser test:style`.

Expected result: all three commands exit zero.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
