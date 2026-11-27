---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/plugin-team-memberships.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T17:50:02Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/plugin-team-memberships**, a package inside the `webex-js-sdk` Yarn
workspace. Run every command from the workspace root: `yarn` to install, and
`yarn workspace @webex/plugin-team-memberships <script>` for the package scripts, which `package.json` defines.

## Prerequisites

| Tool or access | Version source or requirement |
| -------------- | ----------------------------- |
| Node.js        | Development version: `.nvmrc` and the workspace root `AGENTS.md`. Consumer floor: `engines.node` in `package.json`. The workspace root `package.json` `engines.node` disagrees with both; the build and lint pass on the development version |
| Yarn           | `packageManager` in the workspace root `package.json` |
| Registry or account access | N/A for building and linting |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

Fresh-checkout workspace setup (building `webex-legacy-tools` and sibling `dist/`) is owned by the workspace root; see
[Prebuilding](../../../../CONTRIBUTING.md#prebuilding).

## Build

```bash
yarn workspace @webex/plugin-team-memberships build:src
```

`build:src` writes JavaScript and source maps for the two source files to `dist/` through
`webex-legacy-tools`. `dist/` is ignored by Git. The `build` script runs `yarn workspace @webex/plugin-team-memberships build:src`; the package
emits no type declarations.

```bash
yarn workspace @webex/plugin-team-memberships build
```

## Run

N/A — this is a library with no start script. Importing `@webex/plugin-team-memberships` registers
`webex.teamMemberships`.

## Tests

```bash
yarn workspace @webex/plugin-team-memberships test:style
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

`yarn workspace @webex/plugin-team-memberships test:browser` (manifest command `browser-test`) runs `webex-legacy-tools test --integration
--runner karma` over `test/integration/spec/team-memberships.js`, whose 8 cases create test users, a
team, and a team room and call the live services. On 2026-11-12 under Node 22.14 the karma bundle
failed to parse `isbot` (an ES module in the workspace `node_modules`), so the run reported a bundle
error in Chrome and Firefox headless, ran no case, and still exited zero. It is not listed in the table
above because it verifies nothing today, and its exit code is not a test result.

Do not run the aggregate `test` script in `package.json`. It runs `test:style`, then exits 1 with
`Couldn't find a script named "test:unit"` (checked 2026-11-12); it would also call
`test:integration`, which this package does not define either. It is deliberately not a manifest
command; run the commands above instead.

## Configuration and secrets

- Required configuration: none. The plugin registers no config of its own
- Environment overrides: none read by this package
- Secret source: N/A; the package holds no secret
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core` resolves through the workspace; the integration
  spec also needs `@webex/internal-plugin-device`, `@webex/plugin-logger`, `@webex/plugin-rooms`, and
  `@webex/plugin-teams`, which `src/` does not import
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/plugin-team-memberships build:src` and check that it reports `Built plugin-team-memberships: 2 files`.
2. Run `yarn workspace @webex/plugin-team-memberships test:style`.

Expected result: both commands exit zero. `test:style` reports no warning or error in `src/`; it prints
"File ignored" for `src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
