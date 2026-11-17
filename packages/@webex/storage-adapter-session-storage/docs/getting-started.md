---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/storage-adapter-session-storage.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T06:13:09Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/storage-adapter-session-storage**, a package inside the `webex-js-sdk` Yarn
workspace. Run every command from the workspace root: `yarn` to install, and
`yarn workspace @webex/storage-adapter-session-storage <script>` for the package scripts.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=16`. The workspace root `package.json` `engines.node` reads `18.x`, which conflicts with the other pins; the build and lint pass on 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building, unit tests, and linting |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

Fresh-checkout workspace setup (building `webex-legacy-tools` and sibling `dist/`) is owned by the
workspace root; see [Prebuilding](../../../../CONTRIBUTING.md#prebuilding).

## Build

```bash
yarn workspace @webex/storage-adapter-session-storage build:src
```

`build:src` writes `dist/index.js` and its source map through `webex-legacy-tools`. `dist/` is
ignored by Git. The `build` script runs `build:src`; the package emits no type declarations.

```bash
yarn workspace @webex/storage-adapter-session-storage build
```

## Run

N/A — this is a library with no start script and no side effects on import. To use it, an
application constructs `new StorageAdapterSessionStorage(basekey)` and assigns the instance to a
webex-core storage adapter slot; see the
[module specification](../src/docs/README.md#host-integration-and-theming). It needs a browser:
under Node every storage call fails because `sessionStorage` does not exist.

## Tests

```bash
yarn workspace @webex/storage-adapter-session-storage test:unit
```

```bash
yarn workspace @webex/storage-adapter-session-storage test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/storage-adapter-session-storage test:unit` | `test/unit/spec` | jest (`webex-legacy-tools test --unit --runner jest`) running the shared suite from `@webex/storage-adapter-spec` | None |

`test:style` lints `src/` with eslint through `@webex/eslint-config-legacy`.

- Coverage or quality gate: none; the package defines no coverage script, and the legacy Jest
  configuration it re-exports sets no threshold
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests and lint

Read the unit result carefully: `yarn workspace @webex/storage-adapter-session-storage test:unit` exits 0 with **21 skipped and 0 run** (checked
2026-11-13). The test file wraps the shared suite in `skipInNode`, and the jest environment is Node,
so nothing executes. The test file imports the package by name, which loads `dist/index.js`, so run
`yarn workspace @webex/storage-adapter-session-storage build:src` first whenever the suite does run.

`yarn workspace @webex/storage-adapter-session-storage test:browser` (manifest command `browser-test`) runs `webex-legacy-tools test --unit --runner
karma` over `test/unit/spec` in headless Chrome and Firefox. It exits 0 but reports
`ReferenceError: beforeAll is not defined` and "0 tests completed" (checked 2026-11-13), because the
shared suite calls a Jest global that mocha does not define. It is not listed in the table above
because it verifies nothing; read its SUMMARY line, not its exit code.

Do not run the aggregate `test` script in `package.json`. It runs `test:style` and `test:unit`, then
exits 1 with `Couldn't find a script named "test:integration"` (checked 2026-11-13). It is
deliberately not a manifest command; run the commands above instead.

## Configuration and secrets

- Required configuration: none in the package; the host chooses a basekey and an adapter slot
- Environment overrides: none read by `src/`
- Secret source: N/A; the package holds no secret, but stores host data as plaintext (see the
  [architecture security view](architecture.md#security-architecture))
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core`, and for tests `@webex/storage-adapter-spec`
  and `@webex/test-helper-mocha`, all resolved through the workspace
- Platform, simulator, device, or SDK setup: none for build and lint; runtime use needs a browser
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/storage-adapter-session-storage build:src` and check that it reports `Built storage-adapter-session-storage: 1 files`.
2. Run `yarn workspace @webex/storage-adapter-session-storage test:unit` and check that it reports 21 skipped tests.
3. Run `yarn workspace @webex/storage-adapter-session-storage test:style`.

Expected result: all three commands exit zero. `test:style` reports no error in `src/`; it prints one
"File ignored" warning for `src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
