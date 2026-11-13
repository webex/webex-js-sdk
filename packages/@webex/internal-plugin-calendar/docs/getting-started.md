---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-calendar.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T08:24:55Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/internal-plugin-calendar**, a package inside the `webex-js-sdk` Yarn
workspace. Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=18`. The workspace root `package.json` `engines.node` still reads `18.x`, which conflicts with the other two; the unit tests pass on 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building and unit tests; `test:browser` needs live Webex services and test-user credentials |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

On a fresh checkout, prebuild the workspace before the first package build. `yarn` does not build
`@webex/legacy-tools`, whose `webex-legacy-tools` binary is the untracked `dist/cli/index.js`, or the
sibling packages' `dist/`:

```bash
yarn prebuild:modules
```

It runs `yarn`, then builds the tools, the legacy tools, `@webex/webex-core`, and every package, in
that order (root `package.json`; see the workspace `CONTRIBUTING.md` "Prebuilding").

## Build

```bash
yarn workspace @webex/internal-plugin-calendar build
```

`build` runs `build:src`, which writes `dist/` through `webex-legacy-tools`. `dist/` is ignored by Git.

## Run

N/A — this is a library with no start script. Import `@webex/internal-plugin-calendar` and create a
webex instance; the plugin is then `webex.internal.calendar`. Call `register()` before relying on the
`calendar:*` events or on `getFreeBusy`.

## Tests

```bash
yarn workspace @webex/internal-plugin-calendar build:src
yarn workspace @webex/internal-plugin-calendar test:unit
yarn workspace @webex/internal-plugin-calendar test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-calendar test:unit` | `test/unit/spec` | jest runner through `webex-legacy-tools`, with chai, sinon, and `@webex/test-helper-mock-webex` | A current `dist/` (`test/unit/spec/calendar.js` imports the package by name) |
| Integration | `yarn workspace @webex/internal-plugin-calendar test:browser` (karma through `webex-legacy-tools --integration`); not a routine verification command | `test/unit/spec`, `test/integration/spec` | karma | Live Webex services and test users from `@webex/test-helper-test-users`; `test/integration/spec/calendar.js` is skipped |

- Coverage or quality gate: none; the legacy Jest configuration sets no threshold, and the developer
  confirmed that no outside gate applies
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests

There is no `test:integration` script. `yarn workspace @webex/internal-plugin-calendar test` chains
`test:style`, `test:unit`, `test:integration`, and `test:browser`, so it stops with "Couldn't find a
script named test:integration".

## Configuration and secrets

- Required configuration: none for unit tests. At runtime `webex.config.calendar` supplies the
  default `fromDate` and `toDate` of `syncCalendar` (defaults in `src/config.js`, computed when the
  module loads)
- Secret source: N/A for unit tests, which use fake values; live runs use the test-user credentials of
  the workspace test helpers
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core`, `@webex/common`, and the device, encryption,
  conversation, and mercury plugins resolve through the workspace
- Platform, simulator, device, or SDK setup: Node for unit tests; a karma browser for `test:browser`
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-calendar build:src`.
2. Run `yarn workspace @webex/internal-plugin-calendar test:unit` and check that four suites and 28
   tests pass.
3. Run `yarn workspace @webex/internal-plugin-calendar test:style`.

Expected result: all three commands exit zero. `test:style` prints 15 `require-jsdoc` warnings and no
errors.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
