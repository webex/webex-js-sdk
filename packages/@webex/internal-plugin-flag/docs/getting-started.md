---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-flag.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-15T14:22:13Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/internal-plugin-flag**. Commands run from the webex-js-sdk workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js | 22.14, required for working in this repository by the workspace root `AGENTS.md`; the root `.nvmrc` selects the Node 22 LTS line. The workspace root `package.json` `engines` field still says `18.x`; follow the root `AGENTS.md` |
| Yarn | 3.4.1, pinned by the workspace root `packageManager` field and run from the release that the root `.yarnrc.yml` `yarnPath` names, provided through Corepack: enable Corepack for the selected Node.js version, as the workspace root `CONTRIBUTING.md` setup steps require. Workspaces are used, so install from the workspace root rather than this directory |
| Browsers for `test:browser` | Chrome and Firefox. The script passes no browser list, so the legacy-tools `karma-browsers` option keeps its default of both (sibling package legacy-tools, file src/commands/run-tests/run-tests.constants.ts), and karma starts both headless launchers (file src/utils/karma/browsers/browsers.ts of the same package) |

Applications that install the package need Node 18 or later: this package's `package.json`
`engines` says `>=18`, as do its direct workspace dependencies webex-core,
internal-plugin-conversation, and internal-plugin-device. That value is the consumer floor, not the
development runtime.

## Install

The repository is already cloned when you are reading this file. Dependencies are resolved for the
whole workspace:

```bash
yarn install
```

## Build

```bash
yarn workspace @webex/internal-plugin-flag build
```

On a fresh checkout, complete the precondition in First-run verification step 1 first: installing
alone does not provide the `webex-legacy-tools` CLI that this script calls.

`scripts.build` runs `build:src`, which uses the `@webex/legacy-tools` builder to compile `.js` and
`.ts` files from `src/` into the build output directory with source maps. The manifest records
`build:src` as the compile role and `build` as the package role.

## Run

N/A — library package with no start script. Import the package from a consumer so that
`webex.internal.flag` exists; the methods are described in the
[Flag plugin specification](../src/docs/README.md).

## Tests

```bash
yarn workspace @webex/internal-plugin-flag test:unit
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-flag test:unit` | `test/unit/spec` | Jest | This package's build output and the built workspace packages it imports |
| Integration | `yarn workspace @webex/internal-plugin-flag test:browser` | `test/integration/spec` | Mocha with Chai assertions (karma runner) | Chrome and Firefox (see Prerequisites), network access, and the `WEBEX_CLIENT_ID` and `WEBEX_CLIENT_SECRET` environment variables that the workspace test-users helper requires; its other settings have defaults in the workspace root `.env.default`; this package's build output, which the spec imports by name |
| Lint | `yarn workspace @webex/internal-plugin-flag test:style` | `src/` | eslint | None |

- The integration tier is manifest `commands.integration-test` and `tests.integration`. The package
  has no `test:integration` script; `test:browser` passes `--integration` only, so it collects the
  integration spec and not the unit spec (sibling package legacy-tools, file
  src/models/package/package.ts). `--runner karma` selects the runner; the karma configuration
  declares the `mocha` and `chai` frameworks (sibling package legacy-tools, file
  src/utils/karma/karma.constants.ts), and the spec uses Mocha globals with Chai assertions. This
  package uses the unit and integration manifest test tiers, and `test:browser` is the only package
  script that runs the integration spec, `test/integration/spec/flag.js`, so the script is not a
  no-op here. Its result was not verified in this Stage 0.
- The integration spec creates two live test users and a conversation, then flags its activities.
- Do not use the `package.json` script `test` as a verification command; it chains `test:style`,
  `test:unit`, and the undefined `test:integration` script, and never runs `test:browser`.
- `test:style` reports any Markdown under `src/` as ignored, because `@webex/eslint-config-legacy`
  ignores `*.md` files. Before the First-run verification precondition is met, it also warns that the
  `@webex/*` imports in `src/` cannot be resolved; these are warnings, and the script still exits 0.
- Coverage or quality gate: N/A — no coverage threshold.
- Enforcement source: none. `jest.config.js` re-exports `@webex/jest-config-legacy`, which sets
  `collectCoverage: false` and no threshold.
- Test environment or QA dependencies: none beyond the workspace for the unit tier; the integration
  tier needs the variables in its table row. `test/unit/spec/flag.js` imports this package by name,
  which resolves to the build output, so a stale build tests old code. `test/integration/spec/flag.js`
  imports it the same way, so `test:browser` also runs against the build output. Run
  `yarn workspace @webex/internal-plugin-flag build` again after any `src/` change before
  `test:unit` or `test:browser`.

## Configuration and secrets

- Required configuration: none for build, unit, and lint. The integration tier needs the variables in
  Tests. `src/` reads no config key, environment variable, or feature toggle.
- Secret source: none in this package; see the architecture Security architecture. Supply the
  integration-tier client credentials from your environment, never from a committed file.
- Package or artifact access: no private registry or credentials. `yarn install` needs network access
  to the public npm registry set in the workspace root `.yarnrc.yml`, because the Yarn cache is not
  committed.
- Required neighboring repositories or workspace layout: the webex-js-sdk workspace, because sibling
  packages such as webex-core, internal-plugin-conversation, and internal-plugin-device are
  `workspace:*` dependencies.
- Platform, simulator, device, or SDK setup: N/A.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Precondition: a workspace that uses Node.js 22.14 with Corepack enabled (see Prerequisites) and
   has completed the Dependencies and Prebuilding setup in the root `CONTRIBUTING.md`; where that
   setup selects the `.nvmrc` release, select Node.js 22.14 instead, as the root `AGENTS.md`
   requires. Installing alone is not enough: the `webex-legacy-tools` CLI that this package's
   scripts call is untracked build output of the workspace legacy tools package, and the unit spec
   imports the built output of this package and of the workspace packages it loads. The root
   `prebuild:modules` script named there builds all of them.
2. Run `yarn workspace @webex/internal-plugin-flag build` and check that the build output contains
   `index.js`. See Tests for rebuilding after `src/` changes.
3. Run `yarn workspace @webex/internal-plugin-flag test:unit`.

Expected result: Jest reports 1 suite and 9 tests passing. If the suite fails with
`Cannot find module '@webex/internal-plugin-flag'` or a sibling package name such as
`@webex/test-helper-chai`, the precondition in step 1 was not met.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- [Flag plugin specification](../src/docs/README.md)
