---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-voicea.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T09:22:36Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/internal-plugin-voicea**, a package inside the `webex-js-sdk` Yarn workspace.
Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=18`. The workspace root `package.json` `engines.node` reads `18.x`, which conflicts with the other two; the unit tests pass on 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building and unit tests |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

On a fresh checkout, prebuild the workspace before the first package build. `yarn` does not build
`@webex/legacy-tools`, whose `webex-legacy-tools` binary runs this package's build and tests, or the
sibling packages' `dist/`, which the unit tests load for `@webex/internal-plugin-mercury` and
`@webex/internal-plugin-llm`:

```bash
yarn prebuild:modules
```

It runs `yarn`, then builds the tools, the legacy tools, `@webex/webex-core`, and every package, in
that order (root `package.json`; see the workspace `CONTRIBUTING.md` "Prebuilding").

## Build

```bash
yarn workspace @webex/internal-plugin-voicea build:src
```

`build:src` writes `dist/` through `webex-legacy-tools` and then runs `build`, which is `tsc` with the
workspace `emitDeclarationOnly` setting: it type-checks `src` and writes declarations to `dist/types`.
`dist/` is ignored by Git.

```bash
yarn workspace @webex/internal-plugin-voicea build
```

Run `build` alone to type-check without rebuilding the JavaScript.

## Run

N/A — this is a library with no start script. Importing `@webex/internal-plugin-voicea` (or the
`webex` package) registers `webex.internal.voicea`; plugin-meetings creates channels from it.

## Tests

```bash
yarn workspace @webex/internal-plugin-voicea build:src
yarn workspace @webex/internal-plugin-voicea test:unit
yarn workspace @webex/internal-plugin-voicea test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-voicea test:unit` | `test/unit/spec` | jest runner through `webex-legacy-tools`, with chai, sinon, `@webex/test-helper-mock-webex`, `@webex/test-helper-mock-web-socket`, and `jsdom-global` | Built `dist/` of the sibling packages the specs import (mercury, llm) |

- Coverage or quality gate: none; the legacy Jest configuration sets no threshold, and the developer
  confirmed that no outside gate applies
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests

The specs import this package's `src` directly, so a stale local `dist/` of this package does not
affect them. `test:browser` runs `webex-legacy-tools test --integration --runner karma`, but the
package has no `test/integration` directory. `yarn workspace @webex/internal-plugin-voicea test`
chains style, unit, `test:integration`, and browser runs, and stops at `test:integration`, which is not
defined in this package's `package.json`.

## Configuration and secrets

- Required configuration: none; the plugin is registered with empty options and reads no `webex.config`
  key
- Secret source: N/A; the package holds no secret
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core` and `@webex/internal-plugin-llm` resolve through
  the workspace; the unit specs also load `@webex/internal-plugin-mercury`
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-voicea build:src`.
2. Run `yarn workspace @webex/internal-plugin-voicea test:unit` and check that three suites pass with
   84 cases.
3. Run `yarn workspace @webex/internal-plugin-voicea test:style`.

Expected result: all three commands exit zero. `test:style` prints one "File ignored" warning, for
`src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
