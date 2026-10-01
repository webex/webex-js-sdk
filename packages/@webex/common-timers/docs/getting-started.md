---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/common-timers.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-09-28T05:34:36Z
validation_status: pass
-->

# Getting started

Onboarding for **`@webex/common-timers`**. The package is one of many in the Webex JS SDK yarn
workspace, so every command below is run from the workspace root and targets this package by name.

## Prerequisites

| Tool or access | Version or requirement                                                                                                                                                             |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node.js        | `package.json` declares the package floor as `>=18`. The surrounding workspace pins a newer Node through its own `.nvmrc` and contributor instructions, so match the workspace when working in-tree |
| Yarn           | The workspace ships its own Yarn release and resolves it automatically; do not install Yarn separately                                                                              |
| Registry, VPN, or account access | N/A. The package has no runtime dependencies and resolves nothing from a private registry                                                                          |

## Install

```bash
yarn install
```

Run `yarn install` once at the Webex JS SDK workspace root. It installs every package in the
workspace, including this one; there is no package-local install step.

Cloning the workspace is owned at the workspace root, not by this package, so no clone command is
recorded here — follow the root repository's own instructions to obtain a checkout first.

## Build

```bash
yarn workspace @webex/common-timers build:src
```

This runs `webex-legacy-tools build` over `src/` and writes the transpiled module plus type
declarations and source maps to `dist/`, which is what `main` points at for published consumers.
`yarn workspace @webex/common-timers build` is an alias for the same thing.

## Run

```bash
# N/A — this package has no runnable entry point.
yarn workspace @webex/common-timers test:unit
```

There is nothing to start. The package is a library with no CLI, server, or runtime entry point —
`package.json` declares no `bin` and no `start` script. The closest thing to running it is executing
its unit suite, or importing it from a sibling workspace package, which resolves `devMain`
(`src/index.ts`) directly without a build.

## Tests

```bash
yarn workspace @webex/common-timers test:unit
```

The package declares exactly one test tier. `package.json` also declares an aggregate `test` script,
but it chains `test:integration` and `test:browser`, neither of which this package defines — so
`yarn workspace @webex/common-timers test` cannot succeed. Use the individual commands.

| Tier | Command                                            | Test location             | Framework | External dependencies |
| ---- | -------------------------------------------------- | ------------------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/common-timers test:unit`    | `test/unit/spec/index.ts` | jest      | None                  |

Lint runs separately:

```bash
yarn workspace @webex/common-timers test:style
```

- Coverage or quality gate: N/A. The resolved `jest.config.js` sets `collectCoverage: false` and
  declares no threshold, and the package has no `test:coverage` script for the workspace CI coverage
  job to pick up. Verified with the package owner during onboarding.
- Enforcement source: `jest.config.js`, which re-exports the shared `@webex/jest-config-legacy`
  configuration
- Test environment or QA dependencies: none. The suite runs entirely in-process against sinon fake
  timers

## Configuration and secrets

- Required configuration: none. The package reads no environment variable, config file, or remote
  setting.
- Secret source: N/A — the package handles no credentials.
- Package or artifact access: N/A — no runtime dependencies and no private registry.
- Required neighboring repositories or workspace layout: the package must be built and tested from
  inside the Webex JS SDK workspace, because its build, lint, and test configuration are all
  `workspace:*` dependencies (`@webex/legacy-tools`, `@webex/jest-config-legacy`,
  `@webex/eslint-config-legacy`, `@webex/babel-config-legacy`).
- Platform, simulator, device, or SDK setup: N/A.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn install` at the workspace root.
2. Run `yarn workspace @webex/common-timers test:unit`.
3. Run `yarn workspace @webex/common-timers build:src` and confirm `dist/index.js` exists.

Expected result: the unit suite reports **41 passed, 41 total** across two suites — the intended
behaviour spec and the characterization baseline — covering `safeSetTimeout`, `safeSetInterval`, the
`unref` contract on both platform branches, and the three `Timer` methods. The build writes `dist/`.

## Next steps

- [Repository architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Module specification](../src/docs/README.md) — the behavior contract, state machine, and known
  test gaps
- [Documentation index](index.md)
