---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/plugin-authorization-node.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-11T09:32:15Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/plugin-authorization-node**, a package inside the `webex-js-sdk` Yarn
workspace. Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=16`. The workspace root `package.json` `engines.node` still reads `18.x`, which conflicts with the other two; the unit tests pass on 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building and unit tests; the integration suite needs live Webex services and test-user credentials |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

## Build

```bash
yarn workspace @webex/plugin-authorization-node build
```

`build` runs `build:src`, which writes `dist/` through `webex-legacy-tools`. `dist/` is ignored by Git.

## Run

N/A — this is a Node library with no start script. Import `@webex/plugin-authorization-node` (or
`@webex/plugin-authorization`, `webex-node`, or `webex` in Node) and create a webex instance; the
plugin is then `webex.authorization`.

## Tests

```bash
yarn workspace @webex/plugin-authorization-node build:src
yarn workspace @webex/plugin-authorization-node test:unit
yarn workspace @webex/plugin-authorization-node test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/plugin-authorization-node test:unit` | `test/unit/spec` | jest runner through `webex-legacy-tools`, with chai, sinon, and `@webex/test-helper-mock-webex` | A current `dist/` (the spec imports the package by name) |
| Integration | `yarn workspace @webex/plugin-authorization-node test:integration` (mocha through `webex-legacy-tools --integration`); not a routine verification command | `test/integration/spec` | mocha-style `nodeOnly` spec | Live Webex services; `@webex/test-helper-test-users` needs `WEBEX_CLIENT_ID`, `WEBEX_CLIENT_SECRET`, and `WEBEX_SCOPE`, and `@webex/test-helper-appid` needs `WEBEX_APPID_ORGID` and `WEBEX_APPID_SECRET` |
| Browser | `yarn workspace @webex/plugin-authorization-node test:browser` (karma); verifies no behavior | `test/unit/spec`, `test/integration/spec` | karma | Every `nodeOnly` suite is skipped in the browser; only a placeholder case runs |

- Coverage or quality gate: none; the legacy Jest configuration sets no threshold, and the developer
  confirmed that no outside gate applies
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests

`test:style` does not lint `src/authorization.js`, because the shared lint config ignores every file
of that name. `yarn workspace @webex/plugin-authorization-node test` chains style, unit, integration,
and browser runs, so it needs live services.

## Configuration and secrets

- Required configuration: `credentials.client_id`, `credentials.client_secret`, and
  `credentials.redirect_uri` for the code grant (from `Webex.init` config or the `WEBEX_CLIENT_ID`,
  `WEBEX_CLIENT_SECRET`, and `WEBEX_REDIRECT_URI` environment variables read by webex-core
  credentials); the broker URLs derive from `credentials.idbroker.url`
- Secret source: N/A for unit tests, which use fake values; the client secret and any guest issuer
  secret come from the host's server-side configuration
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core`, `@webex/common`, and
  `@webex/internal-plugin-device` resolve through the workspace
- Platform, simulator, device, or SDK setup: Node only
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/plugin-authorization-node build:src`.
2. Run `yarn workspace @webex/plugin-authorization-node test:unit` and check that the
   `plugin-authorization-node` suite lists the four `#requestAuthorizationCodeGrant` cases.
3. Run `yarn workspace @webex/plugin-authorization-node test:style`.

Expected result: all three commands exit zero. `test:style` prints two "File ignored" warnings, for
`src/authorization.js` and `src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
