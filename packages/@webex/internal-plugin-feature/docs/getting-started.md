---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-feature.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-10-12T14:00:30Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/internal-plugin-feature**, a package inside the `webex-js-sdk` Yarn workspace.
Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | `>=18` per this package's `engines`; the workspace `.nvmrc` selects `lts/jod` and the root `AGENTS.md` asks for 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building and unit tests; the integration spec needs test-user credentials and is not wired to a script |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

## Build

```bash
yarn workspace @webex/internal-plugin-feature build
```

`build` runs `build:src`, which writes `dist/` through `webex-legacy-tools`. `dist/` is ignored by Git.

## Run

N/A — this is a library with no start script. Import `@webex/internal-plugin-feature` before creating a
webex instance and read `webex.internal.feature`.

## Tests

```bash
yarn workspace @webex/internal-plugin-feature test:unit
yarn workspace @webex/internal-plugin-feature test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-feature test:unit` | `test/unit/spec` | jest runner through `webex-legacy-tools`, with chai, sinon, and `@webex/test-helper-mock-webex` | None |
| Integration | None runnable: `test:integration` is not defined and `test:browser:broken` is named broken | `test/integration/spec` | mocha-style spec with `@webex/test-helper-test-users` | Live Webex services and test users |

- Coverage or quality gate: none; the legacy Jest configuration sets `collectCoverage: false`
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests

Do not run `yarn workspace @webex/internal-plugin-feature test`: it chains the undefined
`test:integration` script.

## Configuration and secrets

- Required configuration: none; `src/config.js` declares an empty `feature` object
- Secret source: N/A for unit tests; the integration spec creates test users through
  `@webex/test-helper-test-users`
- Package or artifact access: N/A
- Required neighboring packages: `@webex/internal-plugin-device` and `@webex/webex-core` resolve through
  the workspace
- Platform, simulator, device, or SDK setup: N/A
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-feature test:unit`.
2. Check that the `plugin-feature` suite lists the `getFeature`, `setFeature`, `updateFeature`, and
   change-event cases.
3. Run `yarn workspace @webex/internal-plugin-feature test:style`.

Expected result: both commands exit zero.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
