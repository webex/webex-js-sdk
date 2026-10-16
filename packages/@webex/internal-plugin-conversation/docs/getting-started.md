---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-conversation.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-10-16T01:43:45Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/internal-plugin-conversation**, a package inside the Webex JS SDK yarn
workspace. Commands below were verified against `package.json`.

## Prerequisites

| Tool or access                         | Version or requirement |
| -------------------------------------- | ---------------------- |
| Node.js                                | 22.14 for development (root `AGENTS.md`); `engines.node >=18` for consumers |
| Yarn                                   | Workspace Yarn declared by the monorepo root (`yarn@3.4.1`) |
| Webex test users                       | Required only for integration specs |

## Install

Inside the monorepo, select Node 22.14 with nvm and install from the repository root:

```bash
yarn install
```

A consuming project installs the published package:

```bash
npm install --save @webex/internal-plugin-conversation
```

## Build

```bash
yarn workspace @webex/internal-plugin-conversation build:src
```

`build` runs the same `build:src`, which writes `dist/` with source maps.

## Run

There is no runnable app. Import the package for its side effect: it registers the plugin on a
WebexCore instance, after which the API is reached as `webex.internal.conversation`. The exact
exports are declared in `src/index.js` and the method surface in `src/conversation.js`.

## Tests

```bash
yarn workspace @webex/internal-plugin-conversation test:unit
```

| Tier         | Command              | Test location | Framework   | External dependencies               |
| ------------ | -------------------- | ------------- | ----------- | ----------------------------------- |
| Unit         | `yarn workspace @webex/internal-plugin-conversation test:unit` | `test/unit/spec` | Jest via `@webex/jest-config-legacy`, sinon, `@webex/test-helper-chai` | None (MockWebex) |
| Integration  | `yarn workspace @webex/internal-plugin-conversation test:browser` | `test/integration/spec` | Karma via webex-legacy-tools | Live Webex services and test users from `@webex/test-helper-test-users` |

- Coverage or quality gate: N/A — the package owner confirmed no coverage gate applies, and the
  shared Jest configuration does not collect coverage.
- Enforcement source: `jest.config.js` (re-exports `@webex/jest-config-legacy`)
- Test environment or QA dependencies: integration specs need credentials for test-user creation.

## Configuration and secrets

- Required configuration: none; defaults live in `src/config.js` under `webex.config.conversation`
  (HTML allow-lists, URL schemes, thumbnail limits, decryption failure message, and the two crypto
  transform toggles).
- This is the list of environment variables that affect this plugin (read by the WebexCore services
  plugin when this plugin resolves a cluster URL):
  - `WEBEX_CONVERSATION_DEFAULT_CLUSTER` - The name of the conversation cluster that contains all of
    the organizations and spaces prior to federation phase 2. This defaults to
    `urn:TEAM:us-east-2_a:identityLookup` for production but can be changed to
    `urn:TEAM:us-east-1_int13:identityLookup` for integration.
  - `WEBEX_CONVERSATION_CLUSTER_SERVICE` - The name of the conversation cluster service used to
    lookup the host in the hostmap. Defaults to `identityLookup`, but if the service changes, will
    need to be updated.
- Secret source: test-user credentials come from the workspace test helpers; none are stored here.
- Package or artifact access: workspace dependencies resolve through `workspace:*`.
- Required neighboring repositories or workspace layout: the monorepo checkout.
- Platform, simulator, device, or SDK setup: N/A.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-conversation build:src`.
2. Check that `dist/index.js` exists.
3. Run `yarn workspace @webex/internal-plugin-conversation test:unit`.

Expected result: 4 test suites and 97 tests pass.

## Next steps

- [Repository architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- Pull requests welcome. Please see the repository-root CONTRIBUTING.md for more details.
