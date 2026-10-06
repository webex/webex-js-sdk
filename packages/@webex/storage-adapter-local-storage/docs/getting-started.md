---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/storage-adapter-local-storage.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rsarika@cisco.com
updated_at: 2026-10-06T06:09:53Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/storage-adapter-local-storage**. All commands are run from the repository
root, not the package directory.

## Prerequisites

| Tool or access                         | Version or requirement |
| -------------------------------------- | ---------------------- |
| Node | `package.json` declares `engines.node >= 18`; the repository `.nvmrc` pins `lts/jod` and the root agent instructions specify 22.14. Verified working: `v22.14.0`. |
| Yarn | `3.4.1`, workspace-managed |
| Firefox and Chrome | Required only for `test:browser`; the Karma runner launches both |
| Registry or VPN access | N/A — all internal dependencies resolve as `workspace:*` |

## Install

```bash
git clone https://github.com/webex/webex-js-sdk.git
cd webex-js-sdk
nvm use 22.14
yarn install
```

## Build

```bash
yarn workspace @webex/storage-adapter-local-storage build:src
```

Emits `dist/index.js` and `dist/index.js.map`. Measured 2026-10-01: exit 0, 1 file emitted. `dist/`
is not version-controlled — the repository-root `.gitignore` ignores `dist`.

## Run

This package has no runnable entry point — it is a library consumed in-process. To exercise it,
configure it as a bounded adapter in a browser build of the SDK, as
`packages/webex/src/config-storage.shim.js` line 9 does:

```js
import StorageAdapterLocalStorage from '@webex/storage-adapter-local-storage';
import WebexCore from '@webex/webex-core';

const webex = new WebexCore({
  config: {storage: {boundedAdapter: new StorageAdapterLocalStorage('webex')}},
});
```

## Tests

```bash
yarn workspace @webex/storage-adapter-local-storage test:unit
```

> **Read this before trusting a green run.** Neither test route in this package actually executes
> the module. Check the reported test *count*, not the exit code.

| Tier         | Command              | Test location | Framework   | External dependencies               |
| ------------ | -------------------- | ------------- | ----------- | ----------------------------------- |
| Unit         | `yarn workspace @webex/storage-adapter-local-storage test:unit` | `test/unit/spec` | Jest via `@webex/jest-config-legacy` | None |
| Browser      | `yarn workspace @webex/storage-adapter-local-storage test:browser` | `test/unit/spec` | Karma + Mocha via `webex-legacy-tools` | Firefox, Chrome Headless |

Measured 2026-10-01 with Node v22.14.0:

- `test:unit` → exit 0, **21 tests skipped, 0 executed**. `testEnvironment` is `node`
  (`packages/legacy/jest/static/index.js` line 4), `localStorage` is absent, and
  `test/unit/spec/storage-adapter-local-storage.js` line 9 wraps the suite in `skipInNode`.
- `test:browser` → exit 0, **0 tests completed**. Both browsers report
  `ReferenceError: beforeAll is not defined`, because `@webex/storage-adapter-spec/src/index.js` line 40
  uses a Jest global under Mocha, so the suite throws while being defined.
- `test:style` → exit 0, 0 errors, **1 warning**. The warning is `src/docs/README.md`: the lint
  script globs `./src/**/*.*`, which matches the canonical module spec, and ESLint reports the
  Markdown file as ignored. See the note under First-run verification.
- `test` (aggregate) → **exit 1**: `Couldn't find a script named "test:integration"`. Do not use it.

There is no integration or end-to-end tier. The nearest executing verification of the shared adapter
contract lives in a sibling package, where `@webex/webex-core` runs the same abstract suite against
`MemoryStoreAdapter` — that exercises the contract, not this implementation.

- Coverage or quality gate: **none**. Owner-verified absence.
- Enforcement source: `packages/legacy/jest/static/index.js` line 5 sets `collectCoverage: false`; no
  threshold is configured, and the CI job `.github/workflows/pull-request.yml` lines 150–192 runs
  `test:coverage`, which this package does not define.
- Test environment or QA dependencies: none beyond the local browsers for the Karma route.

## Configuration and secrets

- Required configuration: none. The package reads no environment variables and no config file.
- Secret source: N/A for development. Be aware at runtime the adapter persists OAuth access and
  refresh tokens as plaintext JSON in `localStorage` — see the
  [security architecture](architecture.md#security-architecture).
- Package or artifact access: N/A — all internal dependencies are `workspace:*`.
- Required neighboring repositories or workspace layout: none. `@webex/webex-core` must build first,
  since `NotFoundError` is imported from it; Yarn workspaces handles the ordering.
- Platform, simulator, device, or SDK setup: a browser is required for `test:browser` only.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/storage-adapter-local-storage test:style`.
2. Run `yarn workspace @webex/storage-adapter-local-storage build:src`.
3. Confirm `packages/@webex/storage-adapter-local-storage/dist/index.js` exists.

Expected result: lint exits 0 with one warning naming `src/docs/README.md`, and the build prints
`Built storage-adapter-local-storage: 1 files → ./dist`.

That warning appeared when SDD onboarding placed the canonical module spec at `src/docs/README.md`,
inside the `./src/**/*.*` lint glob. It is cosmetic — ESLint lints no Markdown either way — but it
is new. The one-line fix is to narrow the `test:style` script to `eslint ./src/**/*.js`, which is a
`package.json` change and therefore an owner decision rather than part of this spec-only change.

Do not use a passing `test:unit` as a first-run signal; it passes without executing anything.

## Next steps

- [Repository architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Module specification](../src/docs/README.md)
- [Documentation index](index.md)
