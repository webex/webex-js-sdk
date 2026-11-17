---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-board.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T07:38:37Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/internal-plugin-board**, a package inside the `webex-js-sdk` Yarn workspace.
Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=16`. The workspace root `package.json` `engines.node` still reads `18.x`, which conflicts with the other two; the unit tests pass on 22.14 |
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
yarn workspace @webex/internal-plugin-board build
```

`build` runs `build:src`, which writes `dist/` through `webex-legacy-tools`. `dist/` is ignored by Git.

## Run

N/A — this is a library with no start script. Import `@webex/internal-plugin-board` and create a
webex instance; the plugin is then `webex.internal.board`.

## Tests

```bash
yarn workspace @webex/internal-plugin-board build:src
yarn workspace @webex/internal-plugin-board test:unit
yarn workspace @webex/internal-plugin-board test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-board test:unit` | `test/unit/spec` | jest runner through `webex-legacy-tools`, with chai, sinon, `@webex/test-helper-mock-webex`, and `@webex/test-helper-mock-web-socket` | A current `dist/` (the specs import the package by name) |
| Integration | `yarn workspace @webex/internal-plugin-board test:browser` (karma through `webex-legacy-tools --integration`); not a routine verification command | `test/unit/spec`, `test/integration/spec` | karma | Live Webex services and test users from `@webex/test-helper-test-users`; `test/integration/spec/realtime.js` and `test/integration/spec/sharing-mercury.js` are skipped |

- Coverage or quality gate: none; the legacy Jest configuration sets no threshold, and the developer
  confirmed that no outside gate applies
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests

There is no `test:integration` script. `yarn workspace @webex/internal-plugin-board test` chains
`test:style`, `test:unit`, `test:integration`, and `test:browser`, so it stops with "Couldn't find a
script named test:integration".

## Configuration and secrets

- Required configuration: none for unit tests. At runtime `webex.config.board` supplies page sizes,
  socket timers, and the binding prefix (defaults in `src/config.js`); the timers read
  `MERCURY_PING_INTERVAL`, `MERCURY_PONG_TIMEOUT`, and `MERCURY_FORCE_CLOSE_DELAY` when set
- Secret source: N/A for unit tests, which use fake values; live runs use the test-user credentials of
  the workspace test helpers
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core`, `@webex/common`, and the mercury, encryption,
  conversation, and feature plugins resolve through the workspace
- Platform, simulator, device, or SDK setup: Node for unit tests; a karma browser for `test:browser`
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-board build:src`.
2. Run `yarn workspace @webex/internal-plugin-board test:unit` and check that three suites and 58
   tests pass.
3. Run `yarn workspace @webex/internal-plugin-board test:style`.

Expected result: all three commands exit zero. `test:style` prints `require-jsdoc` warnings and no
errors.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
