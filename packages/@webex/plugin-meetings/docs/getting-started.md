---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/plugin-meetings.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-17T03:14:21Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/plugin-meetings**, a package inside the `webex-js-sdk` Yarn workspace. Run
`yarn` and `yarn prebuild:modules` at the workspace root, and the package scripts from this package
directory, `packages/@webex/plugin-meetings`, where `package.json` defines them. From the workspace
root, `yarn workspace @webex/plugin-meetings <script>` runs the same script.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js | Use Node.js 22.14 for this repository (`nvm install 22.14`, then `nvm use 22.14`), as the workspace root `AGENTS.md` requires; the workspace `.nvmrc` selects `lts/jod` (Node 22). This package's `engines` accepts `>=18`; the workspace root `package.json` `engines.node` reads `18.x` |
| Yarn | The repository Yarn version, `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Webex test users | N/A for building, unit tests, and lint. The browser tier creates Webex test users through `@webex/test-helper-test-users`, which needs `WEBEX_CLIENT_ID`, `WEBEX_CLIENT_SECRET`, and related values in the workspace `.env` |

## Install

From the repository root:

```bash
yarn
```

Select Node 22.14 with `nvm use 22.14` first; `yarn` is the install command (`yarn install` is the
same command), and the workspace `deploy.yml` workflow installs with it. Install from the repository
root with `yarn`.

On a fresh checkout, prebuild the workspace before the first package build. `yarn` does not build
`@webex/legacy-tools`, whose `webex-legacy-tools` binary runs this package's build and tests, or the
sibling packages' `dist/`:

```bash
yarn prebuild:modules
```

It runs `yarn`, then builds the tools, the legacy tools, `@webex/webex-core`, and every package, in
that order (workspace root `package.json`; see the workspace `CONTRIBUTING.md`).

The retained `internal-README.md` contains historical branch, npm, sample, and Sauce Labs
instructions. Current root configuration and package scripts take precedence where those
instructions differ.

## Build

```bash
yarn build:src
```

`build:src` transpiles `src/` (`.js` and `.ts`, with source maps) to `dist/` through
`webex-legacy-tools`, then runs `yarn build`, which emits TypeScript declarations to `dist/types` and
copies the plugin assets. Build output is `dist/`; do not hand-edit generated output.

```bash
yarn build
```

`yarn build` alone emits only the declarations and assets; it does not transpile `src/`, so use
`yarn build:src` for a working `dist/`.

## Run

N/A — the package is a library, not a standalone service; sample applications elsewhere in the
repository host it (the `../../../docs/samples/browser-plugin-meetings` sample, built by the
workspace `samples:build` script). Importing `@webex/plugin-meetings` registers `webex.meetings`.

## Tests

```bash
yarn test:unit
```

```bash
yarn test:style
```

```bash
yarn test:browser
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn test:unit` | `test/unit/spec` | mocha (`webex-legacy-tools test --unit --runner mocha`), sinon, `@webex/test-helper-chai` | None; a current `dist/` from `yarn build:src` |
| Integration (browser) | `yarn test:browser` | `test/integration/spec` | karma (`webex-legacy-tools test --integration --runner karma`) with mocha, in ChromeHeadless and FirefoxHeadless | Webex test users and the services they reach; browser WebRTC and media permissions |

What each command covers:

| Tier | Command | What it covers |
|---|---|---|
| unit | `yarn test:unit` | source-mirrored behavior with Mocha/Sinon/test helpers |
| browser/integration | `yarn test:browser` | browser/media/service integration through Karma |
| lint | `yarn test:style` | source style/static lint (`eslint ./src/**/*.*` through `@webex/eslint-config-legacy`) |
| build/type | `yarn build:src` | transpilation and TypeScript declarations |

From the workspace root, `yarn workspace @webex/plugin-meetings build:src`, `test:style`, `test:unit`,
`test:unit --targets meeting/brbState.ts`, and `test:browser` run the same package scripts.

Run `yarn build:src` before `yarn test:unit`. Twelve unit spec files import the package by name
(`@webex/plugin-meetings`, whose `main` is `dist/index.js`), so a stale or missing `dist/` skews unit
results.

`--targets` is relative to `test/unit/spec/` for unit tests: `yarn test:unit --targets
locus-info/controlsUtils.js` runs `test/unit/spec/locus-info/controlsUtils.js`. Plugin unit tests are
slow. Use the smallest `--targets` value. Temporary Mocha `.only` is permitted for a focused run, but
every `.only` must be removed before completion.

Source is under `src/`; unit tests mirror it under `test/unit/spec/`. Source paths under `src/{area}/`
mirror unit tests under `test/unit/spec/{area}/`. Core areas with broad suites include `meeting`,
`meetings`, `locus-info`, `members`, `media`, `multistream`, `breakouts`, `reachability`, `roap`, and
interceptors. Feature areas have owning test directories when current behavior is covered;
`src/reactions/` has none. Shared fixtures live under `test/unit/spec/fixture/`.

Browser/integration tests live under `test/integration/spec/` and use the package test runner. On
2026-11-16 without test-user credentials, `yarn test:browser` bundled the suites and ran them in both
browsers: the transcription cases passed, `space-meeting` failed because no test user was created,
and the command exited 1.

When adding tests, follow the existing file's style, use Sinon and `@webex/test-helper-chai`, prefer
`calledOnceWithExactly`, use fake timers for timer/retry behavior, and parameterize more than three
similar cases. Use Sinon for mocks/stubs and assertions from `@webex/test-helper-chai`.

- Coverage or quality gate: No package-specific numeric coverage or static-analysis threshold exists,
  by repository-owner confirmation. This does not waive tests: behavior changes need focused
  positive/negative/cleanup coverage, package build, and lint proportional to risk.
  `.sdd/manifest.json` coverage describes documentation trust, not code-test percentage.
- Enforcement source: the workspace `.github/workflows/pull-request.yml` runs `test:unit` and
  `test:style` for changed packages and their dependents, and `test:browser` for changed packages;
  it sets no coverage threshold for this package, which defines no `test:coverage` script.
- Test environment or QA dependencies: Unit tests mock Webex/core/media dependencies and should not
  require production credentials. Browser/integration tests may require browser WebRTC, media
  permissions, Webex test users, remote services, and managed environment values.

Do not run the `test:broken` script: it chains `test:integration`, which this package does not
define.

## Configuration and secrets

- Required configuration: none for build, unit tests, and lint. The plugin's runtime defaults are in
  `src/config.ts`.
- Secret source: environment files and CI/test credentials are local/managed inputs. Unit work is
  local/mocked. Browser or integration flows can require Webex test users, remote services, media
  permissions, and environment credentials; never commit these values. Never add credentials, Webex
  user secrets, Sauce Labs keys, or tokens to source control. Node 22.14 is the repository
  development runtime; do not commit `.env`, credentials, or test-user secrets.
- Package or artifact access: npm/workspace resolution is controlled by repository configuration and
  `package.json`; do not replace workspace dependencies with ad-hoc source paths. Public consumption
  is through `@webex/plugin-meetings`; local development normally uses the workspace build rather
  than publishing.
- Required neighboring repositories or workspace layout: this package lives at
  `packages/@webex/plugin-meetings/` inside the `webex-js-sdk` monorepo. Shared packages are resolved
  through Yarn workspaces. Run package scripts from this package directory, or the equivalent
  `yarn workspace @webex/plugin-meetings <script>` form from the repository root, and avoid modifying
  neighboring packages unless the approved task requires their contract.
- Platform, simulator, device, or SDK setup: none for build and unit tests; the browser tier launches
  headless Chrome and Firefox.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Confirm `node --version` reports the repository-required runtime, `v22.14.0`.
2. Build the package with `yarn build:src`.
3. Run the smallest mirrored unit-test target for the module you will change, for example
   `yarn test:unit --targets locus-info/controlsUtils.js`.
4. Run lint on the package with `yarn test:style`.
5. Before finishing, confirm no temporary Mocha `.only` remains.

Expected result: the build, the focused unit target, and lint exit zero. On 2026-11-16 the
`locus-info/controlsUtils.js` target reported 74 passing tests, and `yarn test:style` reported 0
errors and 163 warnings, including "File ignored" notices for the Markdown files under `src/`.

## Next steps

- Orientation and rules: [`../AGENTS.md`](../AGENTS.md), including its testing workflow and review
  checklist
- Module routing and each module's test strategy and traceability:
  [Specification registry](specs/README.md)
- Architecture: [Package architecture](architecture.md)
- Public and event boundaries: the contract index in [Package architecture](architecture.md)
- Retained consumer examples: [`../README.md`](../README.md) and [`../UPGRADING.md`](../UPGRADING.md)
- [Documentation index](index.md)
