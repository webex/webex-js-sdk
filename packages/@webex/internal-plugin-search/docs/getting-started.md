---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-search.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T11:40:54Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/internal-plugin-search**, a package inside the `webex-js-sdk` Yarn workspace.
Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=18`. The workspace root `package.json` `engines.node` reads `18.x`, which conflicts with the other pins; the build and lint pass on 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building and linting |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

On a fresh checkout, prebuild the workspace before the first package build. `yarn` does not build
`@webex/legacy-tools`, whose `webex-legacy-tools` binary runs this package's build, or the sibling
packages' `dist/`:

```bash
yarn prebuild:modules
```

It runs `yarn`, then builds the tools, the legacy tools, `@webex/webex-core`, and every package, in
that order (root `package.json`; see the workspace `CONTRIBUTING.md` "Prebuilding").

## Build

```bash
yarn workspace @webex/internal-plugin-search build:src
```

`build:src` writes JavaScript and source maps for the three source files to `dist/` through
`webex-legacy-tools`. `dist/` is ignored by Git. The `build` script runs `yarn build:src`; the package
emits no type declarations.

```bash
yarn workspace @webex/internal-plugin-search build
```

## Run

N/A — this is a library with no start script. Importing `@webex/internal-plugin-search` registers
`webex.internal.search`; `search` needs a registered device, because it reads and writes
`webex.internal.device`.

## Tests

```bash
yarn workspace @webex/internal-plugin-search test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | N/A — `package.json` defines no `test:unit` script | none | N/A | N/A |

`test:style` lints `src/` with eslint through `@webex/eslint-config-legacy`.

- Coverage or quality gate: none; the package defines no unit test, no coverage script, and the legacy
  Jest configuration it re-exports sets no threshold
- Enforcement source: N/A
- Test environment or QA dependencies: none for lint

This package has no unit tests: `package.json` defines no `test:unit` script and there is no
`test/unit` directory. Add both together when you add the first unit case.

`test:browser` runs `webex-legacy-tools test --integration --runner karma` over
`test/integration/spec/search.js`. That spec is wrapped in `xdescribe`, so every case is skipped, and it
needs live test users and the search service. On 2026-11-12 under Node 22.14 the karma bundle also
failed to parse `isbot` (an ES module in the workspace `node_modules`), so the run reported
"0 tests completed" and still exited zero. It is not listed in the table above because it verifies
nothing today.

`yarn workspace @webex/internal-plugin-search test` chains style, unit, integration, and browser runs,
and stops at `test:unit`, which is not defined in this package's `package.json`.

## Configuration and secrets

- Required configuration: none; the default under `webex.config.search` is an empty object
  (`src/config.js`) and nothing reads it
- Secret source: N/A; the package holds no secret. The search key lives in KMS and only its URL is set
  on the device
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core`, `@webex/common`,
  `@webex/internal-plugin-encryption`, and `@webex/internal-plugin-conversation` resolve through the
  workspace; the host must also register `webex.internal.device`, which `search` reads for `userId`
  and `searchEncryptionKeyUrl`
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-search build:src` and check that it reports
   `Built internal-plugin-search: 3 files`.
2. Run `yarn workspace @webex/internal-plugin-search test:style`.

Expected result: both commands exit zero. `test:style` prints warnings but no errors: seven
`require-jsdoc` warnings (five in `src/index.js`, two in `src/search.js`) and "File ignored" for
`src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
