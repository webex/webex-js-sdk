---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/plugin-presence.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T13:37:51Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/plugin-presence**, a package inside the `webex-js-sdk` Yarn workspace. Run
every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=18`. The workspace root `package.json` `engines.node` reads `18.x`, which conflicts with the other pins; the build and unit tests pass on 22.14 |
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
yarn workspace @webex/plugin-presence build:src
```

`build:src` writes JavaScript and source maps for the seven source files to `dist/` through
`webex-legacy-tools`. `dist/` is ignored by Git. It writes no type declarations.

```bash
yarn workspace @webex/plugin-presence build
```

`build` first runs `tsc` with declarations into `dist/types/`, the folder that `package.json` `types`
points to, and then `build:src`.

```bash
yarn workspace @webex/plugin-presence build:docs
```

`build:docs` renders `src/interface.ts` with typedoc into the workspace `docs/presence/` folder, which
is committed; the workspace `build:docs` script runs it.

## Run

N/A — this is a library with no start script. Importing `@webex/plugin-presence` registers
`webex.presence`. `enable`, `disable`, and `isEnabled` need the host to register
`@webex/internal-plugin-feature`, and the worker needs `@webex/internal-plugin-mercury`.

## Tests

```bash
yarn workspace @webex/plugin-presence test:unit
```

```bash
yarn workspace @webex/plugin-presence test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/plugin-presence test:unit` | `test/unit/spec` | jest through `webex-legacy-tools` and `@webex/jest-config-legacy` | None; `@webex/test-helper-mock-webex` and sinon stubs |

Run `build:src` before `test:unit`. The unit specs import `@webex/plugin-presence` by name, which
resolves to `dist/index.js`, so a stale build tests old code. The run reports 2 suites and 29 passing
cases and exits zero; it also prints one unhandled `TypeError` from a background fetch, explained in
the [module specification](../src/docs/README.md#verification).

`test:style` lints `src/` with eslint through `@webex/eslint-config-legacy`. In the onboarding
checkout it exited 1 without linting, because the package-local
`node_modules/@humanwhocodes/object-schema` has no `dist/`; reinstalling the workspace with `yarn` is
the usual repair, which onboarding did not run.

- Coverage or quality gate: none; the package defines no coverage script, and the legacy Jest
  configuration it re-exports sets no threshold
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests and lint

`test/integration/spec/presence.ts` needs live test users and the presence service, is
`describe.skip`, and no script runs it: `package.json` names the karma script `test:browser:broken`
and defines no `test:browser` or `test:integration`. `yarn workspace @webex/plugin-presence test`
chains style, unit, integration, and browser runs, and stops at the missing `test:integration`.

## Configuration and secrets

- Required configuration: none. Defaults live under `webex.config.presence` (`batcherWait`,
  `batcherMaxCalls`, `batcherMaxWait`); an application that wants the worker started at `ready` sets
  `config.presence.initializeWorker`, which has no default (`src/config.ts`)
- Environment overrides: none read by this package
- Secret source: N/A; the package holds no secret and requests go through `webex.request`
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core` and `@webex/internal-plugin-device` resolve
  through the workspace; the host must also register `@webex/internal-plugin-feature` and
  `@webex/internal-plugin-mercury`
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/plugin-presence build:src` and check that it reports
   `Built plugin-presence: 7 files`.
2. Run `yarn workspace @webex/plugin-presence test:unit`.
3. Run `yarn workspace @webex/plugin-presence test:style`.

Expected result: the build and the unit run exit zero, with 29 of 29 cases passing. A working
`test:style` should print warnings but no errors: the workspace-root ESLint, run with this package's
config over the expanded `src/` file list, reported four `require-jsdoc` warnings, three in
`src/index.ts` and one in `src/presence.ts`, and "File ignored" for `src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
