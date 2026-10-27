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
approved_by: pending
updated_at: 2026-10-14T13:20:00Z
validation_status: not-run
-->

# Getting started

Onboarding for **@webex/plugin-authorization-browser-first-party**. All commands run from the
monorepo root, because the package is a yarn workspace member.

## Prerequisites

| Tool or access                         | Version or requirement |
| -------------------------------------- | ---------------------- |
| node                                   | 22.14 for workspace work, per the monorepo root `AGENTS.md`; the package declares `>=8` in `package.json` engines |
| yarn                                   | 3.4.1 (`packageManager` in the root `package.json`) |
| Container, registry, VPN, or account   | N/A for build and unit tests; the automation suite needs test-user credentials and is currently skipped |

## Install

```bash
git clone https://github.com/webex/webex-js-sdk.git
yarn install
```

## Build

```bash
yarn workspace @webex/plugin-authorization-browser-first-party build:src
```

`build` runs `build:src`, which compiles `src/` to `dist/` with source maps.

## Run

```bash
yarn workspace @webex/plugin-authorization-browser-first-party build
```

The package has no start script. It runs inside a host page that imports it before the `webex`
bundle; exercising a real login needs that host page and a registered OAuth client.

## Tests

```bash
yarn workspace @webex/plugin-authorization-browser-first-party test:unit
```

Run `build:src` first: the unit spec imports the default export by package name, which resolves to
`dist/index.js`.

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/plugin-authorization-browser-first-party test:unit` | `test/unit/spec` | jest via `webex-legacy-tools`, with chai and sinon | None; MockWebex and a stub window |
| Browser | `yarn workspace @webex/plugin-authorization-browser-first-party test:browser` | `test/automation` | karma via `webex-legacy-tools` | Test users, a browser, `WEBEX_REDIRECT_URI`; the grant suite is `describe.skip` and `--integration` collects no files today |

- Coverage or quality gate: N/A — no repo-specific gate exists (owner-confirmed).
- Enforcement source: `jest.config.js` re-exports the shared legacy jest config, which sets
  `collectCoverage` false and no threshold.
- Test environment or QA dependencies: none for unit tests.

## Configuration and secrets

- Required configuration: none for unit tests. At runtime the host passes `credentials.client_id`,
  `redirect_uri`, `scope`, optional `client_secret`, and `clientType` to `Webex.init`.
- Secret source: confidential-client secrets come from the host application's configuration; this
  package stores none.
- Package or artifact access: public npm and the workspace; no private registry is configured here.
- Required neighboring repositories or workspace layout: the monorepo workspace, for `@webex/webex-core`,
  `@webex/common`, and the shared legacy config packages.
- Platform, simulator, device, or SDK setup: N/A.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/plugin-authorization-browser-first-party build:src`.
2. Check that the output ends with `Built plugin-authorization-browser-first-party: 3 files → ./dist`.
3. Run `yarn workspace @webex/plugin-authorization-browser-first-party test:unit`.

Expected result: `Tests: 73 passed, 73 total` (observed 2026-10-14).

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
