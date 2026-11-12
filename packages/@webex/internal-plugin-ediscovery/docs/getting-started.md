---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-ediscovery.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T06:44:53Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/internal-plugin-ediscovery**, a package inside the `webex-js-sdk` Yarn
workspace. Run every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=18`. The workspace root `package.json` `engines.node` reads `18.x`; the unit tests pass on 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building and unit tests; the integration spec needs a provisioned compliance test user and the live eDiscovery service |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

On a fresh checkout, prebuild the workspace before the first package build. `yarn` does not build
`@webex/legacy-tools`, whose `webex-legacy-tools` binary runs every script of this package, or the
sibling packages' `dist/`:

```bash
yarn prebuild:modules
```

It runs `yarn`, then builds the tools, the legacy tools, `@webex/webex-core`, and every package, in that
order (root `package.json`).

## Build

```bash
yarn workspace @webex/internal-plugin-ediscovery build
```

`build` runs `build:src`, which writes `dist/` through `webex-legacy-tools`. `dist/` is ignored by Git.

## Run

N/A — this is a library with no start script. Import `@webex/internal-plugin-ediscovery` and create a
webex instance with a compliance officer's credentials; the plugin is then `webex.internal.ediscovery`.

## Tests

```bash
yarn workspace @webex/internal-plugin-ediscovery build:src
yarn workspace @webex/internal-plugin-ediscovery test:unit
yarn workspace @webex/internal-plugin-ediscovery test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-ediscovery test:unit` | `test/unit/spec` | jest runner through `webex-legacy-tools`, with chai, sinon, and `@webex/test-helper-mock-webex` | A current `dist/` (the specs import the package by name) |
| Integration | No package script runs it | `test/integration/spec` | mocha-style spec | Live eDiscovery service; a compliance test user created by `@webex/test-helper-test-users` |
| Browser | `yarn workspace @webex/internal-plugin-ediscovery test:browser:broken` (karma); not a routine verification command | `test/integration/spec` | karma | Named broken; needs the same live services as the integration spec |

- Coverage or quality gate: none; the legacy Jest configuration sets no threshold, and the developer
  confirmed that no outside gate applies
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests

`test:style` does not lint `src/ediscovery.js`, because the shared lint config ignores every file of that
name, and `src/index.js` disables every rule at its top. `yarn workspace @webex/internal-plugin-ediscovery
test` chains `test:integration` and `test:browser`, which this package does not define, so it fails after
the unit run.

## Configuration and secrets

- Required configuration: none beyond the defaults in `src/config.js` (`offset` 0, `size` 100, `timeoutMs`
  30000); per-call `options` override them
- Secret source: N/A for unit tests, which use fake values; a real run needs a compliance officer token,
  and decryption needs the KMS org-agent role
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core`, `@webex/common`,
  `@webex/internal-plugin-encryption`, and `@webex/internal-plugin-conversation` resolve through the
  workspace; the unit specs also mount `@webex/internal-plugin-mercury`
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-ediscovery build:src`.
2. Run `yarn workspace @webex/internal-plugin-ediscovery test:unit` and check that three suites and 122
   cases pass.
3. Run `yarn workspace @webex/internal-plugin-ediscovery test:style`.

Expected result: all three commands exit zero. `test:style` prints six warnings and no errors, including
"File ignored" for `src/ediscovery.js`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
