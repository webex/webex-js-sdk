---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/web-extension-bridge.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: cursor
approved_by: pending
updated_at: 2026-09-23T06:36:39Z
validation_status: pending
-->

# Getting started

Onboarding for **@webex/web-extension-bridge**. Commands are run from the `webex-js-sdk` workspace root.

## Prerequisites

| Tool or access                         | Version or requirement |
| -------------------------------------- | ---------------------- |
| Node.js                                | Published engine `>=18` (`package.json`); local workspace requires **22.14** (`nvm use 22.14`) |
| Yarn                                   | workspace package manager |
| Chrome / Chromium MV3                  | required to load the sample extension; not required for unit tests |
| Git clone of `webex/webex-js-sdk`      | this package is not a standalone git repo |

## Install

```bash
yarn
```

## Build

```bash
yarn workspace @webex/web-extension-bridge build:src
```

## Run

This package has no long-running process. Page consumers call `createWebBridge` from the published root specifier. Extension consumers import `@webex/web-extension-bridge/extension` in a service worker, popup, or content script.

Local samples (outside this SDD root) are built with:

```bash
yarn workspace @webex/web-extension-bridge build:samples
```

Sample steps and load-unpacked instructions remain in `README.md`. After `build:samples`, the page sample is listed on the JS SDK samples index at `docs/index.html`. Do not invent a `dev` or `verify` script; those names exist only in the draft intake spec.

## Tests

```bash
yarn workspace @webex/web-extension-bridge test:unit
yarn workspace @webex/web-extension-bridge test:style
yarn workspace @webex/web-extension-bridge typecheck
```

Use the table as the package-level test router. List only tiers that actually exist.

| Tier         | Command                                                      | Test location | Framework | External dependencies |
| ------------ | ------------------------------------------------------------ | ------------- | --------- | --------------------- |
| Unit         | `yarn workspace @webex/web-extension-bridge test:unit`       | `test/unit`   | mocha     | none                  |
| Integration  | same `test:unit` command; cases live under `test/unit/spec/integration` | `test/unit/spec/integration` | mocha | fake chrome/window fixtures |
| System / E2E | N/A — no e2e script or `test/e2e` directory                  | N/A           | N/A       | N/A                   |

- Coverage or quality gate: no in-package coverage script; intake NFR5 is not enforced by `package.json`
- Enforcement source: `package.json` scripts `test`, `test:unit`, `test:style`
- Test environment or QA dependencies: none; tests use `test/unit/lib` fakes

## Configuration and secrets

- Required configuration: none for unit tests. Consumers supply `allowedOrigins` (required on the worker; optional on the page and defaulting to the document origin).
- Secret source: N/A. The SDK mints session tokens with CSPRNG and does not load credentials.
- Package or artifact access: workspace `yarn` install
- Required neighboring repositories or workspace layout: this package lives in `packages/@webex/web-extension-bridge` of `webex-js-sdk`
- Platform, simulator, device, or SDK setup: Chromium 116+ for real extension samples (`README.md`)
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/web-extension-bridge test:unit`.
2. Check mocha exit 0.
3. Run `yarn workspace @webex/web-extension-bridge test:style`.

Expected result: unit tests and eslint complete without errors.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- Product walkthrough: [README.md](../README.md)
