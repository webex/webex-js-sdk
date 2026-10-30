---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for webex.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-15T15:50:41Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **webex**, the aggregate Webex JS SDK npm package. Commands run from the
webex-js-sdk workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js | 22.14, required for working in this repository by the workspace root `AGENTS.md`; the root `.nvmrc` selects the Node 22 LTS line |
| Yarn | 3.4.1, the version pinned by the workspace root `packageManager` field, provided through Corepack: enable Corepack for the selected Node.js version, as the workspace root `CONTRIBUTING.md` setup steps require. Workspaces are used, so install from the workspace root rather than this directory |
| Test-user access for `test:integration` | `WEBEX_CLIENT_ID` and `WEBEX_CLIENT_SECRET` (described in the workspace root `CONTRIBUTING.md` and `ENV.md`), and network access to Webex services |
| Browser for the karma run | A local browser for the karma runner that `test:browser:broken` starts through `@webex/legacy-tools` |

The `package.json` `engines` value `>=18` is the floor for applications that install the package,
not the development runtime. The workspace root `package.json` declares `engines.node` `18.x`; that
field does not set the development runtime either, which is Node.js 22.14 as above.

## Install

The repository is already cloned when you are reading this file. Dependencies are resolved for the
whole workspace:

```bash
yarn install
```

## Build

```bash
yarn workspace webex build
```

`scripts.build` runs `build:src`, which uses the `@webex/legacy-tools` builder to compile `.js` and
`.ts` files from `src/` into `dist/` with source maps. The manifest records `build:src` as the
compile role and `build` as the package role. The `umd/` bundles are built by the workspace root
webpack configuration, not by this package's scripts.

## Run

N/A — library package with no start script. Require `webex` (or `webex/meetings`, `webex/calling`)
from a consumer and call `init`.

## Tests

```bash
yarn workspace webex test:unit
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace webex test:unit` | `test/unit/spec` | Jest, chai | Built workspace packages that the spec imports |
| Integration | `yarn workspace webex test:integration` | `test/integration/spec` | Mocha, chai, sinon, `@webex/test-helper-test-users` | Test-user credentials and Webex services |
| Browser | `yarn workspace webex test:browser:broken` | `test/integration/spec` under karma | karma | A browser; not a no-op here, because four integration specs exist; the script name marks it broken |
| Lint | `yarn workspace webex test:style` | `src/` | eslint | None |
| Helper lint | `yarn workspace webex eslint ./env.js ./browser.js ./process` | `env.js`, `browser.js`, `process` | eslint | None |

- The karma run is manifest `commands.browser-test` with role `other`, because the SDD manifest
  `tests` schema has no browser tier, and the integration tier is already the Mocha run of the same
  specs.
- Run untargeted, the integration tier fails whenever `test/integration/spec/env.js` runs, because it
  requires the unexported `webex/env` subpath. Pass the `--targets` option described in the workspace
  root `AGENTS.md`: `yarn workspace webex test:integration --targets commonjs.js` and
  `yarn workspace webex test:integration --targets init.js`. `request.js` is not required while
  `package.json` has no `version`, because its user-agent case then expects `webex/undefined`.
- The `package.json` script `test` chains `test:style`, `test:unit`, and `test:integration`; run
  the tiers individually.
- The unit spec constructs real `Webex` instances, which try to reach the service catalog. Without
  network access those requests fail and are logged, but the tests still pass.
- Coverage or quality gate: N/A — no coverage threshold.
- Enforcement source: none. `jest.config.js` re-exports `@webex/jest-config-legacy`, which sets
  `collectCoverage: false` and no threshold.
- Test environment or QA dependencies: the unit spec imports `jsdom-global/register`, `webex`, and
  `@webex/test-helper-chai`, and mocks the sibling packages plugin-meetings (by relative path) and
  internal-plugin-calendar. Each of those package names still resolves to the package's build
  output, so a fresh clone needs the workspace build described in First-run verification.

## Configuration and secrets

- Required configuration: none to build or run the unit tests. At runtime, callers pass config and
  credentials to `init`. `src/config.js` reads the environment variable `HYDRA_SERVICE_URL`, and
  `env.js` reads `WEBEX_ACCESS_TOKEN`.
- Secret source: none in this package. Integration tests create test users through
  `@webex/test-helper-test-users`, which requires `WEBEX_CLIENT_ID` and `WEBEX_CLIENT_SECRET`; the
  service URLs it also needs default from the workspace root `.env.default`.
- Package or artifact access: `yarn install` resolves external dependencies from the npm registry
  set in the workspace root `.yarnrc.yml` (`registry.npmjs.org`), so it needs network access to that
  registry; workspace packages resolve locally.
- Required neighboring repositories or workspace layout: the webex-js-sdk workspace, because
  webex-core, calling, contact-center, and the plugin packages are `workspace:*` dependencies.
- Platform, simulator, device, or SDK setup: N/A.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Precondition: complete the workspace root `CONTRIBUTING.md` Dependencies and Prebuilding steps.
   Select Node.js 22.14, enable Corepack (see Prerequisites), run `yarn install` from the workspace
   root, and then run the workspace root `prebuild:modules` script (manifest `workspace-prebuild`).
2. Why the prebuild is required: `yarn install` does not build the
   `webex-legacy-tools` CLI that this package's scripts call, because its binary lives in the
   untracked build output of the workspace legacy tools package. That root script installs again,
   then builds the workspace tools, the legacy tools, webex-core, and the `build:src` output of the
   workspace packages that define it, including the plugin packages, `@webex/calling`, and the test helpers that the
   unit spec loads. Without it, `test:unit` cannot start the `webex-legacy-tools` binary; with the
   tools built but the sibling packages unbuilt, Jest fails with "Cannot find module", first for the
   sibling package plugin-meetings.
3. Run `yarn workspace webex build` and check that `dist/` contains `index.js`, `meetings.js`, and
   `calling.js`.
4. Run `yarn workspace webex test:unit`.

Expected result: Jest reports one suite passing with 4 tests: `.version`, `#version`, and the two
`fedramp` cases.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- [webex bundle entry points specification](../src/docs/README.md)
