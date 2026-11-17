---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/plugin-device-manager.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T03:13:49Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/plugin-device-manager**, a package inside the `webex-js-sdk` Yarn workspace.
Run `yarn` and `yarn prebuild:modules` at the workspace root, and the package scripts from this
package directory, `packages/@webex/plugin-device-manager`, where `package.json` defines them. From
the workspace root, `yarn workspace @webex/plugin-device-manager <script>` runs the same script.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=16`. The workspace root `package.json` `engines.node` reads `18.x`, which conflicts with the other pins; the build, unit tests, and lint pass on 22.14 |
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

N/A — this is a library with no start script. Importing `@webex/plugin-device-manager` registers
`webex.devicemanager`. The package-root `webex.js` and the `sample/` page are manual-trial files that
no script builds or serves: the page loads `../webex.min.js`, which does not exist, and the
`samples:devicemanager` script the README names is not defined in the workspace `package.json`.

## Tests

```bash
yarn test:unit
```

```bash
yarn test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn test:unit` | `test/unit/spec` | jest (`webex-legacy-tools test --unit --runner jest`), sinon, `@webex/test-helper-chai` | None |

`test:style` lints `src/` with eslint through `@webex/eslint-config-legacy`.

- Coverage or quality gate: none; the package defines no coverage script, and the legacy Jest
  configuration it re-exports sets no threshold
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests and lint

The unit spec imports `src/` by relative path, so it does not need a fresh `dist/`. It covers only
`getPairedDevice` and the paired-method accessors; see the module specification's Verification
section for the gaps.

`yarn test:browser` (manifest command `browser-test`) runs `webex-legacy-tools test --integration
--runner karma`, which collects `test/integration/spec`. This package has no such directory, so the
command finds no file, starts no browser, prints nothing, and exits zero (checked 2026-11-13). It is
not listed in the table above because it verifies nothing.

Do not run the aggregate `test` script in `package.json`. It runs `test:style` and `test:unit`, then
exits 1 with `Couldn't find a script named "test:integration"` (checked 2026-11-13). It is
deliberately not a manifest command; run the commands above instead.

## Configuration and secrets

- Required configuration: none. The plugin registers the empty config `{}` (`src/config.js`)
- Environment overrides: none read by `src/`
- Secret source: N/A; the package holds no secret
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core`, `@webex/internal-plugin-device`,
  `@webex/internal-plugin-lyra`, and `@webex/internal-plugin-search` resolve through the workspace;
  mercury and encryption are registered by the Lyra plugin
- Platform, simulator, device, or SDK setup: none for build and tests; pairing needs a Lyra-enabled
  room device on the user's account
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn build:src` and check that it reports `Built plugin-device-manager: 5 files`.
2. Run `yarn test:unit` and check that 14 tests pass.
3. Run `yarn test:style`.

Expected result: all three commands exit zero. `test:style` reports 5 `require-jsdoc` warnings and no
error in `src/`; it also prints "File ignored" for `src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
