---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-ai-assistant.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T09:49:19Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/internal-plugin-ai-assistant**, a package inside the `webex-js-sdk` Yarn
workspace. Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=16`. The workspace root `package.json` `engines.node` reads `18.x`, which conflicts with the other two; the unit tests pass on 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building and unit tests |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

On a fresh checkout, prebuild the workspace before the first package build. `yarn` does not build
`@webex/legacy-tools`, whose `webex-legacy-tools` binary runs this package's build and tests, or the
sibling packages' `dist/`, which the unit spec loads:

```bash
yarn prebuild:modules
```

It runs `yarn`, then builds the tools, the legacy tools, `@webex/webex-core`, and every package, in
that order (root `package.json`; see the workspace `CONTRIBUTING.md` "Prebuilding").

## Build

```bash
yarn workspace @webex/internal-plugin-ai-assistant build:src
```

`build:src` writes JavaScript and source maps for the six source files to `dist/` through
`webex-legacy-tools`. `dist/` is ignored by Git. The `build` script runs `yarn build:src`; the
package has no `tsconfig.json` and emits no type declarations.

```bash
yarn workspace @webex/internal-plugin-ai-assistant build
```

## Run

N/A — this is a library with no start script. Importing `@webex/internal-plugin-ai-assistant`
registers `webex.internal.aiassistant`; call `register()` before sending requests.

## Tests

```bash
yarn workspace @webex/internal-plugin-ai-assistant build:src
yarn workspace @webex/internal-plugin-ai-assistant test:unit
yarn workspace @webex/internal-plugin-ai-assistant test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-ai-assistant test:unit` | `test/unit/spec` | jest runner through `webex-legacy-tools`, with chai, chai-as-promised, sinon, and `@webex/test-helper-mock-webex` | This package's built `dist/`, which the spec imports by package name, and the sibling packages' `dist/` |

- Coverage or quality gate: none; the legacy Jest configuration sets no threshold and the package
  defines no coverage script
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests

Run `build:src` before `test:unit`: the spec imports this package by name, which resolves to
`dist/index.js`, so a stale `dist/` tests old code. `test:browser` runs `webex-legacy-tools test
--integration --runner karma`, but the package has no `test/integration` directory.
`yarn workspace @webex/internal-plugin-ai-assistant test` chains style, unit, `test:integration`, and
browser runs, and stops at `test:integration`, which is not defined in this package's `package.json`.

## Configuration and secrets

- Required configuration: none; the default `webex.config.aiassistant.requestTimeout` is 60000 ms
  (`src/config.ts`)
- Secret source: N/A; the package holds no secret
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core`, `@webex/internal-plugin-mercury`, and
  `@webex/common-timers` resolve through the workspace; `@webex/internal-plugin-encryption` must be
  loaded by the host, because this package calls it without declaring it
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-ai-assistant build:src`.
2. Run `yarn workspace @webex/internal-plugin-ai-assistant test:unit` and check that one suite passes
   with 31 cases.
3. Run `yarn workspace @webex/internal-plugin-ai-assistant test:style`.

Expected result: all three commands exit zero. `test:style` prints two warnings: "File ignored" for
`src/docs/README.md`, and `no-restricted-exports` for `src/index.ts`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
