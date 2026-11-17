---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/plugin-webhooks.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T02:40:15Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/plugin-webhooks**, a package inside the `webex-js-sdk` Yarn workspace.
Run `yarn` and `yarn prebuild:modules` at the workspace root, and the package scripts from this
package directory, `packages/@webex/plugin-webhooks`, where `package.json` defines them.
From the workspace root, `yarn workspace @webex/plugin-webhooks <script>` runs the same script.

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
yarn build:src
```

`build:src` writes JavaScript and source maps for the two source files to `dist/` through
`webex-legacy-tools`. `dist/` is ignored by Git. The `build` script runs `yarn build:src`; the package
emits no type declarations.

```bash
yarn build
```

## Run

N/A — this is a library with no start script. Importing `@webex/plugin-webhooks` registers
`webex.webhooks`. Receiving the event deliveries a webhook triggers needs a server of the
application's own at the webhook's `targetUrl`; this package provides none.

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

`yarn test:browser` (manifest command `browser-test`) runs `webex-legacy-tools test --integration
--runner karma` over `test/integration/spec/webhooks.js`, whose 7 cases create a test user, a room,
and webhooks against the live services. The whole suite is wrapped in `describe.skip`, so it would run
no case even if it bundled. On 2026-11-13 under Node 22.14 the karma bundle failed to parse `isbot`
(an ES module in the workspace `node_modules`), so the run reported a bundle error in Chrome and
Firefox headless, completed 0 tests, and still exited zero. It is not listed in the table above
because it verifies nothing today, and its exit code is not a test result.

Do not run the aggregate `test` script in `package.json`. It runs `test:style`, then exits 1 with
`Couldn't find a script named "test:unit"` (checked 2026-11-13); it would also call
`test:integration`, which this package does not define either. It is deliberately not a manifest
command; run the commands above instead.

## Configuration and secrets

- Required configuration: none. The plugin registers no config of its own
- Environment overrides: none read by this package
- Secret source: N/A; the package holds no secret
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core` resolves through the workspace. The integration
  spec also needs `@webex/internal-plugin-device` and the peer dependencies `@webex/plugin-logger` and
  `@webex/plugin-rooms`; `src/` uses none of them
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn build:src` and check that it reports `Built plugin-webhooks: 2 files`.
2. Run `yarn test:style`.

Expected result: both commands exit zero. `test:style` prints no warning for `src/webhooks.js` or
`src/index.js`, only "File ignored" for `src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
