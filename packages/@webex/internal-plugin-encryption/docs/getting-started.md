---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-encryption.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-16T05:59:53Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/internal-plugin-encryption**, a package inside the `webex-js-sdk` Yarn
workspace. Run every command from the workspace root. The package scripts run through
`yarn workspace @webex/internal-plugin-encryption <script>`; `package.json` in
`packages/@webex/internal-plugin-encryption` defines them.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=18`. The workspace root `package.json` `engines.node` reads `18.x`, which conflicts with the other pins; the build and lint pass on 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building, unit tests, and linting. Integration tests need the Webex test-user client secrets that the pull-request workflow writes to `.env` |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command. Run it again whenever the
lockfile changes: this package pins `asn1js` 3.0.10 and `pkijs` 3.3.3 and depends on the workspace
package `@webex/kms-caroots`, and an older install lacks both (see [Tests](#tests)).

Fresh-checkout workspace setup (building `webex-legacy-tools` and sibling `dist/`) is owned by the workspace root; see
[Prebuilding](../../../../CONTRIBUTING.md#prebuilding).

## Build

```bash
yarn workspace @webex/internal-plugin-encryption build:src
```

`build:src` writes JavaScript and source maps for the 15 source files to `dist/` through
`webex-legacy-tools`, then runs the `build:assets` script, which copies `assets/` (without
`README.md`) to `dist/assets/`. `dist/` is ignored by Git. The `build` script runs `yarn build:src`;
the package emits no type declarations.

```bash
yarn workspace @webex/internal-plugin-encryption build
```

## Run

N/A — this is a library with no start script. Importing `@webex/internal-plugin-encryption` registers
`webex.internal.encryption`.

Maintainers refresh the shipped Cisco Union bundle with:

```bash
yarn workspace @webex/internal-plugin-encryption assets:refresh
```

It downloads the latest bundle from Cisco (or reads `--in <file>`), verifies it, refuses a downgrade,
writes `assets/ios_union-<version>.p7b`, regenerates `src/union-bundle.js`, and removes the previous
bundle. It needs network access and was not run during onboarding.

## Tests

```bash
yarn workspace @webex/internal-plugin-encryption build:src
```

```bash
yarn workspace @webex/internal-plugin-encryption test:unit
```

```bash
yarn workspace @webex/internal-plugin-encryption test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-encryption test:unit` | `test/unit/spec` | jest (`webex-legacy-tools test --unit --runner jest`), sinon, `@webex/test-helper-chai` | None |
| Integration | `yarn workspace @webex/internal-plugin-encryption test:integration` | `test/integration/spec` | mocha (`webex-legacy-tools test --integration --runner mocha`) | Real KMS and test users created with the CI secrets |

Run `build:src` before `test:unit`: the unit specs import `dist/` and the package by name, so a stale
`dist/` tests old code.

On 2026-11-16, after `yarn` and `yarn prebuild:modules` at the workspace root, `yarn build:src` and
`yarn test:unit` passed all 92 cases in the four suites. An install older than the current lockfile
fails differently: two suites cannot load without the `@webex/kms-caroots` link, and with an older
root `asn1js` the Union-bundle cases fail with "inputBuffer must be ArrayBuffer". Rerun the install
steps before trusting a unit result.

`test:style` lints `src/` with eslint through `@webex/eslint-config-legacy`. The shared ignore list
skips every file named `kms.js`, so `src/kms.js` is never linted.

- Coverage or quality gate: none; the package defines no coverage script, and the legacy Jest
  configuration it re-exports sets no threshold
- Enforcement source: N/A
- Test environment or QA dependencies: none for unit tests and lint; integration needs the CI secrets

`yarn workspace @webex/internal-plugin-encryption test:integration` runs in the pull-request workflow's Test - Integration job for changed
packages; it was not run during onboarding. `yarn workspace @webex/internal-plugin-encryption test:browser` (manifest command `browser-test`)
runs the same integration specs in karma; it was not run either. Do not run the aggregate `test`
script as a quick check: it chains lint, unit, integration, and karma, and the last two need secrets
and test users.

## Configuration and secrets

- Required configuration: none. Defaults live in `src/config.js` under `webex.config.encryption`;
  certificate-chain validation is off by default, see the
  [module specification](../src/docs/README.md#requirements) (MOD-024 to MOD-027)
- Environment overrides: `NODE_ENV` (`test` adds the DRY replay interceptor and the test-mode KMS
  retry; anything but `production` adds payload logging and the localhost download bypass)
- Secret source: N/A for this package; it holds no secret. Integration tests read the CI secrets
- Package or artifact access: N/A
- Required neighboring packages: the workspace `@webex/*` dependencies in `package.json`, built by
  the workspace prebuild; the host must register `@webex/internal-plugin-metrics` for metrics
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-encryption build:src` and check that it reports `Built internal-plugin-encryption: 15 files`.
2. Run `yarn workspace @webex/internal-plugin-encryption test:unit` and check that all four suites load and pass.
3. Run `yarn workspace @webex/internal-plugin-encryption test:style`.

Expected result: all three commands exit zero. `test:style` reports 13 warnings (12 `require-jsdoc`
and 1 `no-use-before-define`) and no error. It also prints "File ignored" for `src/kms.js` and for
`src/docs/README.md`.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
