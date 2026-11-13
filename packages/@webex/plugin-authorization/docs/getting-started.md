---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/plugin-authorization.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T05:35:41Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/plugin-authorization**, a package inside the `webex-js-sdk` Yarn workspace.
Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=18`. The workspace root `package.json` `engines.node` reads `18.x` |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building and linting |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

On a fresh checkout, prebuild the workspace before the first package build. `yarn` does not build
`@webex/legacy-tools` or the sibling packages' `dist/`, and this package's built Node entry requires
the built `@webex/plugin-authorization-node`:

```bash
yarn prebuild:modules
```

## Build

```bash
yarn workspace @webex/plugin-authorization build
```

`build` runs `build:src`, which writes `dist/index.js` and `dist/index.browser.js` (with source maps)
through `webex-legacy-tools`. `dist/` is ignored by Git.

## Run

N/A — this is a library with no start script. Import `@webex/plugin-authorization` (or `webex`,
`webex-node`) and create a webex instance; the selected plugin is then `webex.authorization`.

## Tests

```bash
yarn workspace @webex/plugin-authorization build:src
yarn workspace @webex/plugin-authorization test:style
```

The package has no unit or integration tests: there is no `test/` directory, and `package.json`
defines no `test:unit` or `test:integration` script.

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | N/A — `package.json` defines no `test:unit` script | none | N/A | N/A |

`test:style` lints the two entry files with eslint through `@webex/eslint-config-legacy`.
`yarn workspace @webex/plugin-authorization test:browser` runs karma in integration mode, but with no
`test/` directory it has no spec files and verifies nothing.

- Coverage or quality gate: none; the legacy Jest configuration sets no threshold, and the developer
  confirmed that no outside gate applies
- Enforcement source: N/A
- Test environment or QA dependencies: none

`yarn workspace @webex/plugin-authorization test` chains `test:style`, `test:unit`,
`test:integration`, and `test:browser`; it stops with "Couldn't find a script named `test:unit`".

Behavior of `webex.authorization` is tested in the sibling packages: `@webex/plugin-authorization-node`
(`test:unit`) and `@webex/plugin-authorization-browser` (`test:unit`).

## Configuration and secrets

- Required configuration: none in this package. The selected sibling reads `credentials` settings
  from the webex configuration; see its documentation.
- Secret source: N/A; this package handles no secret.
- Package or artifact access: N/A
- Required neighboring packages: `@webex/plugin-authorization-node` and
  `@webex/plugin-authorization-browser` resolve through the workspace.
- Platform, simulator, device, or SDK setup: browser bundles need a resolver that applies the
  `package.json` `browser` field (the workspace webpack build does).
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/plugin-authorization build:src`.
2. Run `yarn workspace @webex/plugin-authorization test:style`.
3. Check that `require('@webex/plugin-authorization')` in Node returns `default` and `config` from
   `@webex/plugin-authorization-node`.

Expected result: `build:src` prints "Built plugin-authorization: 2 files → ./dist" and exits zero;
`test:style` exits zero; in step 3 the exported `config` is `{credentials: {}}` and
`default.prototype.requestAuthorizationCodeGrant` is a function.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
