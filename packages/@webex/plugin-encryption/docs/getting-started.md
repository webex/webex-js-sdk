---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/plugin-encryption.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-16T07:57:20Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/plugin-encryption**, a package inside the `webex-js-sdk` Yarn workspace. Run every command from the workspace root: `yarn` to install, and `yarn workspace @webex/plugin-encryption <script>` for the package scripts, which `package.json` defines.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | Use 22.14: the workspace root `AGENTS.md` requires it and the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=16`. The workspace root `package.json` `engines.node` reads `18.x`, which conflicts with the other pins; the build, tests, and lint pass on 22.14 |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building, unit tests, and linting. Using the plugin against Webex needs an access token with the `spark:kms` scope (`developer-quickstart.md`) |

## Install

```bash
yarn
```

The workspace `deploy.yml` workflow installs with the same command.

Fresh-checkout workspace setup (building `webex-legacy-tools` and sibling `dist/`) is owned by the workspace root; see
[Prebuilding](../../../../CONTRIBUTING.md#prebuilding).

## Build

```bash
yarn workspace @webex/plugin-encryption build:src
```

`build:src` compiles the eight source files to `dist/` with source maps through `webex-legacy-tools`,
then runs the `build` script, which runs `tsc` with declarations only and writes `dist/types`. `dist/`
is ignored by Git.

```bash
yarn workspace @webex/plugin-encryption build
```

`yarn workspace @webex/plugin-encryption build` alone refreshes only the declarations.

## Run

N/A — this is a library with no start script. `require('@webex/plugin-encryption')` returns the
standalone `Webex` constructor and registers `webex.cypher`. The browser sample app that uses it is
served by the workspace, as `developer-quickstart.md` describes.

The API reference is generated with typedoc into the workspace `docs/plugin-encryption` folder,
outside this package:

```bash
yarn workspace @webex/plugin-encryption build:docs
```

It was not run during onboarding.

## Tests

```bash
yarn workspace @webex/plugin-encryption build:src
```

```bash
yarn workspace @webex/plugin-encryption test:unit
```

```bash
yarn workspace @webex/plugin-encryption test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/plugin-encryption test:unit` | `test/unit/spec` | jest (`webex-legacy-tools test --unit --runner jest`) with `@webex/test-helper-mock-webex` | None |

The unit spec imports `src/cypher` relatively, but loads `@webex/internal-plugin-encryption` and
`@webex/test-helper-mock-webex` by name, which resolve to their `dist/`. Make sure they are
built (see the workspace prebuild setup above) before trusting a result.

On 2026-11-16, `yarn workspace @webex/plugin-encryption build:src` and `yarn workspace @webex/plugin-encryption test:unit` passed all 11 cases in the one suite, with
statement coverage of 96.95% and branch coverage of 95.65% over the measured files.

`test:style` lints `src/` with eslint through `@webex/eslint-config-legacy`. On 2026-11-16 it exited 0
with 6 warnings, all in `src/webex.js`: three `import/no-extraneous-dependencies` (for
`@babel/polyfill`, `@webex/plugin-authorization`, and `lodash`) and three
`@typescript-eslint/no-var-requires`. Since this specification exists, it also prints a seventh
warning, "File ignored because of a matching ignore pattern", for `src/docs/README.md`: the shared
ignore list skips `docs/**` and `*.md`.

- Coverage or quality gate: 85% global lines, functions, branches, and statements, set by
  `coverageThreshold` in `jest.config.js` with `collectCoverage: true`. It measures only the files
  the unit spec loads, because no `collectCoverageFrom` is set
- Enforcement source: `yarn workspace @webex/plugin-encryption test:unit` exits nonzero below the threshold (a generator probe with a 99%
  line threshold exited 1); the pull-request workflow's Test - Unit job runs `test:unit` for changed
  packages and their dependents
- Test environment or QA dependencies: none

`yarn workspace @webex/plugin-encryption test:browser` (manifest command `browser-test`) asks karma to run the integration files, but
`webex-legacy-tools` starts karma only for a non-empty file list and this package has no
`test/integration` directory, so it prints nothing and exits 0 (2026-11-16). The package defines no aggregate
`test` script and no `test:integration` script.

## Configuration and secrets

- Required configuration: none. The registered plugin config is `{cypher: {}}` and is not read. The
  defaults in `src/webex-config.ts` are not applied by `Webex.init` today; see the
  [module specification](../src/docs/README.md#evidence-register) (known defect)
- Environment overrides: `HYDRA_SERVICE_URL` sets the Hydra URL in `src/webex-config.ts` (subject to
  that defect); the workspace UMD build defines it per environment
- Secret source: N/A for this package; it holds no secret. Applications supply the access token
- Package or artifact access: N/A
- Required neighboring packages: `@webex/internal-plugin-encryption` and `@webex/webex-core`
  (declared), plus `@webex/plugin-authorization`, `lodash`, and `@babel/polyfill`, which
  `src/webex.js` requires without declaring them; all are present in the workspace install
- Platform, simulator, device, or SDK setup: none
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/plugin-encryption build:src` and check that it reports `Built plugin-encryption: 8 files`.
2. Run `yarn workspace @webex/plugin-encryption test:unit` and check that all 11 cases pass and no coverage threshold message appears.
3. Run `yarn workspace @webex/plugin-encryption test:style`.

Expected result: all three commands exit zero, and `test:style` reports 7 warnings (the six in `src/webex.js` and "File ignored" for `src/docs/README.md`) and no
error.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
