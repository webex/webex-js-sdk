---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/storage-adapter-local-forage.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rsarika@cisco.com
updated_at: 2026-10-06T11:32:37Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/storage-adapter-local-forage**, a package inside the Webex JS SDK yarn
workspace. Run every command below from the workspace root.

## Prerequisites

| Tool or access                         | Version or requirement |
| -------------------------------------- | ---------------------- |
| Node.js                                | `>=18` per `engines` in `package.json`; the workspace's contributor instructions use Node 22.14 through nvm |
| Yarn                                   | The workspace's pinned Yarn 3 release (the package scripts call `yarn`) |
| Browser                                | Needed to exercise the adapter at all; it has no Node storage driver |
| Container, registry, VPN, or account   | N/A; dependencies resolve from the public npm registry configured at the workspace root |

## Install

Clone the Webex JS SDK repository (`https://github.com/webex/webex-js-sdk.git`, the `repository.url` in
`package.json`), then install from its root:

```bash
yarn install
```

## Build

```bash
yarn workspace @webex/storage-adapter-local-forage build
```

`build` runs `build:src`, which transpiles `src/` into `dist/` with source maps. `dist/index.js` is
the published `main` entry point.

## Run

```bash
yarn workspace @webex/storage-adapter-local-forage test:style
```

The package is a library with no runnable entry point. The closest "run" check is linting the source
with the command above. The adapter executes only inside a browser application that assigns it to a
Webex SDK storage slot.

## Tests

```bash
yarn workspace @webex/storage-adapter-local-forage test:browser
```

This package has no canonical unit-test command. `package.json` defines no `test:unit` script, and
the owner confirmed on 2026-10-06 that none is canonical. The command above is the only committed
test runner, but it is not a working tier: it runs Karma with Mocha, and the shared conformance suite
it loads calls the Jest-only `beforeAll`. That result is derived from code and has not been measured.
Do not run the aggregate `test` script; it chains `test:unit` and `test:integration`, neither of which
exists in this package.

| Tier         | Command              | Test location | Framework   | External dependencies               |
| ------------ | -------------------- | ------------- | ----------- | ----------------------------------- |
| Unit         | None canonical; `yarn workspace @webex/storage-adapter-local-forage test:browser` is the only committed runner and does not execute the suite | `test/unit/spec/storage-adapter-local-forage.js` | Karma with Mocha (suite written for Jest globals) | Chrome and Firefox launched by Karma |

- Coverage or quality gate: N/A. The owner confirmed on 2026-10-06 that no coverage gate applies.
- Enforcement source: none. `package.json` defines no `test:coverage` script, and the shared Jest
  configuration disables coverage collection.
- Test environment or QA dependencies: none. Behavioral intent lives in the module specification's
  `Verification` section.

## Configuration and secrets

- Required configuration: none in the package. Hosts select the adapter through their Webex SDK
  storage configuration.
- Secret source: none; the package reads no secrets.
- Package or artifact access: public npm registry, configured at the workspace root.
- Required neighboring repositories or workspace layout: the Webex JS SDK workspace, because the
  package depends on `@webex/common`, `@webex/webex-core`, `@webex/storage-adapter-spec`, and the
  legacy build packages through `workspace:*` ranges.
- Platform, simulator, device, or SDK setup: a browser with IndexedDB, WebSQL, or `localStorage`.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/storage-adapter-local-forage build`.
2. Check that `dist/index.js` exists in the package directory.
3. Run `yarn workspace @webex/storage-adapter-local-forage test:style`.

Expected result: the build writes `dist/index.js` with a source map, and ESLint exits 0 for `src/`.

## Next steps

- [Repository architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- [Module specification](../src/docs/README.md)
