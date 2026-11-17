---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/plugin-attachment-actions.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T02:56:49Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/plugin-attachment-actions**, a package inside the `webex-js-sdk` Yarn
workspace. Run `yarn` and `yarn prebuild:modules` at the workspace root, and the package scripts from
this package directory, `packages/@webex/plugin-attachment-actions`, where `package.json` defines them.
From the workspace root, `yarn workspace @webex/plugin-attachment-actions <script>` runs the same
script.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=16`. The workspace root `package.json` `engines.node` reads `18.x`, which conflicts with the other pins; the build and lint pass on 22.14 |
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
yarn build:src
```

`build:src` writes JavaScript and source maps for the two source files to `dist/` through
`webex-legacy-tools`. `dist/` is ignored by Git. The `build` script runs `yarn build:src`; the package
emits no type declarations.

```bash
yarn build
```

## Run

N/A — this is a library with no start script. Importing `@webex/plugin-attachment-actions` registers
`webex.attachmentActions`.

## Tests

```bash
yarn test:style
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
`test/unit` directory. Add both together when you add the first unit case; sibling legacy packages
define `test:unit` as `webex-legacy-tools test --unit --runner jest`.

`package.json` defines no `test:integration` script, so mocha never runs
`test/integration/spec/attachmentActions.js`. `yarn test:browser:broken` (manifest command
`browser-test`) runs that spec through karma. On 2026-11-13 under Node 22.14 the karma bundle failed to
parse `isbot` (an ES module in the workspace `node_modules`), so Chrome and Firefox headless reported a
bundle error, ran no case, and the command still exited zero. If the spec is run, its two cases need
two provisioned test users from `@webex/test-helper-test-users` and the live services.

That command is not listed in the table above because it verifies nothing today, and its exit code is
not a test result.

Do not run the aggregate `test` script in `package.json`. It runs `test:style`, then exits 1 with
`Couldn't find a script named "test:unit"` (checked 2026-11-13); it also names `test:integration` and
`test:browser`, which do not exist. It is deliberately not a manifest command; run the commands above
instead.

## Configuration and secrets

- Required configuration: none. The plugin registers no config of its own
- Environment overrides: none read by `src/` directly; the `debug` package reads `DEBUG`, and
  `DEBUG=attachmentActions` turns on the trace of each created event
- Secret source: N/A; the package holds no secret
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core`, `@webex/common`,
  `@webex/internal-plugin-conversation`, and `@webex/internal-plugin-mercury` resolve through the
  workspace; the host must also register `@webex/plugin-people` and `@webex/plugin-logger`, the peer
  dependencies that `listen()` and the conversion error line reach at run time
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn build:src` and check that it reports `Built plugin-attachment-actions: 2 files`.
2. Run `yarn test:style`.

Expected result: both commands exit zero. `test:style` reports 0 errors and 2 warnings: the
`@typescript-eslint/no-var-requires` warning for the `debug` require in `src/attachmentActions.js`, and
one "File ignored" warning for `src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
