---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-lyra.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T15:15:46Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/internal-plugin-lyra**, a package inside the `webex-js-sdk` Yarn workspace.
Run `yarn` and `yarn prebuild:modules` at the workspace root, and the package scripts from this
package directory, `packages/@webex/internal-plugin-lyra`, where `package.json` defines them.
From the workspace root, `yarn workspace @webex/internal-plugin-lyra <script>` runs the same script.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=18`. The workspace root `package.json` `engines.node` reads `18.x`, which conflicts with the other pins; the build, unit tests, and lint pass on 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building, unit tests, and linting |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

On a fresh checkout, prebuild the workspace before the first package build. `yarn` does not build
`@webex/legacy-tools`, whose `webex-legacy-tools` binary runs this package's build and tests, or the
sibling packages' `dist/`:

```bash
yarn prebuild:modules
```

It runs `yarn`, then builds the tools, the legacy tools, `@webex/webex-core`, and every package, in
that order (root `package.json`; see the workspace `CONTRIBUTING.md` "Prebuilding").

## Build

```bash
yarn build:src
```

`build:src` writes JavaScript and source maps for the five source files to `dist/` through
`webex-legacy-tools`. `dist/` is ignored by Git. The `build` script runs `yarn build:src`; the package
emits no type declarations.

```bash
yarn build
```

## Run

N/A — this is a library with no start script. Importing `@webex/internal-plugin-lyra` registers
`webex.internal.lyra` together with the mercury, encryption, conversation, and feature plugins.

## Tests

```bash
yarn test:unit
```

```bash
yarn test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn test:unit` | `test/unit/spec` | jest through `webex-legacy-tools` and `@webex/jest-config-legacy` | None; `@webex/test-helper-mock-webex` and sinon stubs |

Run `build:src` before `test:unit`. The unit specs import `@webex/internal-plugin-lyra` by name, which
resolves to `dist/index.js`, so a stale build tests old code.

`test:style` lints `src/` with eslint through `@webex/eslint-config-legacy`.

- Coverage or quality gate: none; the package defines no coverage script, and the legacy Jest
  configuration it re-exports sets no threshold
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests and lint

`test:browser` runs `webex-legacy-tools test --integration --runner karma` over the two specs in
`test/integration/spec`, which need live test users, a `LYRA_SPACE` machine user, mercury, and the
Lyra service. On 2026-11-12 under Node 22.14 the karma bundle failed to parse `isbot` (an ES module in
the workspace `node_modules`), so the run reported "0 tests completed" and still exited zero. It is not
listed in the table above because it verifies nothing today.

`yarn test` chains style, unit, integration, and browser runs, and stops at `test:integration`, which is not defined in this package's `package.json`.

## Configuration and secrets

- Required configuration: none. `config.lyra` is an empty object and no code reads a key from it
  (`src/config.js`)
- Environment overrides: none read by this package
- Secret source: N/A; the package holds no secret
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core`, `@webex/common`,
  `@webex/internal-plugin-encryption`, `@webex/internal-plugin-mercury`,
  `@webex/internal-plugin-conversation`, and `@webex/internal-plugin-feature` resolve through the
  workspace
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn build:src` and check that it reports
   `Built internal-plugin-lyra: 5 files`.
2. Run `yarn test:unit`.
3. Run `yarn test:style`.

Expected result: all three commands exit zero. The unit run reports 20 passing tests in 3 suites.
`test:style` prints warnings but no errors: one `no-unreachable` warning in `src/space.js` and "File
ignored" for `src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
