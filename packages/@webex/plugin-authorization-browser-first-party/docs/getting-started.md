---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/plugin-authorization-browser-first-party.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-03T06:25:15Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/plugin-authorization-browser-first-party**, a package inside the
`webex-js-sdk` Yarn workspace. Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | `>=8` per this package's `engines`; the workspace `.nvmrc` selects `lts/jod` and the root `AGENTS.md` asks for 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building and unit tests; the skipped automation suite needs test users and a redirect URI |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

## Build

```bash
yarn workspace @webex/plugin-authorization-browser-first-party build
```

`build` runs `build:src`, which writes `dist/` through `webex-legacy-tools`. `dist/` is ignored by Git.

## Run

N/A — this is a browser library with no start script. Import
`@webex/plugin-authorization-browser-first-party` before any other authorization plugin and create a
webex instance; the plugin is then `webex.authorization`.

## Tests

```bash
yarn workspace @webex/plugin-authorization-browser-first-party build:src
yarn workspace @webex/plugin-authorization-browser-first-party test:unit
yarn workspace @webex/plugin-authorization-browser-first-party test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/plugin-authorization-browser-first-party test:unit` | `test/unit/spec` | jest runner through `webex-legacy-tools`, with chai, sinon, and `@webex/test-helper-mock-webex` | A current `dist/` (the spec imports the package by name) |
| Browser | None runnable: `test:browser` collects `test/integration/spec`, which does not exist | — | karma through `webex-legacy-tools` | — |
| Automation | None runnable from the package: `test/automation/spec/authorization-code-grant.js` is `describe.skip` | `test/automation/spec` | mocha-style spec with `@webex/test-helper-automation` | Live Webex services, test users, `WEBEX_REDIRECT_URI` |

- Coverage or quality gate: none; the legacy Jest configuration sets `collectCoverage: false`
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests

Do not run `yarn workspace @webex/plugin-authorization-browser-first-party test`: it chains the
undefined `test:integration` script.

## Configuration and secrets

- Required configuration: `credentials.client_id`, `redirect_uri`, and `scope`; `client_secret` only
  with `clientType: 'confidential'` or for the device flow; `clientType` defaults to `public` in
  `src/config.js`
- Secret source: N/A for unit tests, which use fake values
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core` and `@webex/common` resolve through the workspace
- Platform, simulator, device, or SDK setup: a browser window (`location`, `history`, `sessionStorage`,
  `crypto`); unit tests supply a mock window
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/plugin-authorization-browser-first-party build:src`.
2. Run `yarn workspace @webex/plugin-authorization-browser-first-party test:unit` and check that the
   `plugin-authorization-browser-first-party` suite lists the `#initialize()`, `#initiateLogin()`,
   `#handleThirdPartyCallback()`, and `#initQRCodeLogin()` cases.
3. Run `yarn workspace @webex/plugin-authorization-browser-first-party test:style`.

Expected result: all three commands exit zero.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
