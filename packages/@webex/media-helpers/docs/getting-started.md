---
type: Getting Started
title: Getting started
description: Local setup, build, and test routing for @webex/media-helpers.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-09-30T05:28:59Z
validation_status: pass
-->

# Getting started

Onboarding for **`@webex/media-helpers`**. This package is a workspace member of the `webex-js-sdk`
monorepo, so install and build commands run from the monorepo root.

## Prerequisites

| Tool or access | Version or requirement                                                            |
| -------------- | --------------------------------------------------------------------------------- |
| Node.js        | `package.json` declares `engines.node >=18`; the monorepo `AGENTS.md` instructs contributors to use 22.14 |
| Yarn           | 3.4.1, pinned by the monorepo root `package.json` `packageManager` field; the package is a member of the `workspaces` declared there |
| npm registry access | Required to install the exact pinned `@webex/internal-media-core` and `@webex/web-media-effects` releases |

## Install

```bash
git clone https://github.com/webex/webex-js-sdk.git
yarn install
```

## Build

```bash
yarn workspace @webex/media-helpers build:src
```

This emits transpiled JavaScript, source maps, and type declarations into `dist/`, which is what
`deploy:npm` publishes. `yarn workspace @webex/media-helpers build` runs only the declaration step,
because the monorepo root `tsconfig.json` sets `emitDeclarationOnly: true`.

## Run

Not applicable. This package is a library consumed by other packages and by npm consumers; it has no
runnable entry point of its own.

## Tests

```bash
yarn workspace @webex/media-helpers test:unit
```

Use the table as the repository-level test router. List only tiers that
actually exist; behavioral intent belongs in the owning module specifications and exact
cases remain in the repository's native test sources.

| Tier         | Command                                          | Test location        | Framework | External dependencies |
| ------------ | ------------------------------------------------ | -------------------- | --------- | --------------------- |
| Unit         | `yarn workspace @webex/media-helpers test:unit`  | `test/unit/spec/`    | Jest      | None — `jsdom-global` supplies the DOM |
| Integration  | Not present                                      | —                    | —         | —                     |
| System / E2E | Not present                                      | —                    | —         | —                     |

The `test:browser` and `test:broken` scripts in `package.json` target an integration suite that does
not exist in this package: there is no `test/integration` directory, and `test:broken` chains a
`test:integration` script the package never defines. Do not treat either as a working gate.

- Coverage or quality gate: none. The inherited `@webex/jest-config-legacy` preset sets
  `collectCoverage: false` and declares no `coverageThreshold`, and this package is not registered in
  the monorepo root `jest.config.js` projects list.
- Enforcement source: `package.json` and the inherited `@webex/jest-config-legacy` preset.
- Test environment or QA dependencies: none.

## Configuration and secrets

- Required configuration: none. The unit suite stubs the upstream capture functions and needs no
  media devices or credentials.
- Secret source: not applicable to this package.
- Package or artifact access: the npm registry, for the pinned upstream `@webex` media packages.
- Required neighboring repositories or workspace layout: the package must be built inside the
  `webex-js-sdk` workspace, because its dev tooling resolves through `workspace:*` dependencies.
- Platform, simulator, device, or SDK setup: none for unit tests. Exercising real capture requires a
  browser with camera and microphone permissions.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/media-helpers build:src`.
2. Check that `dist/index.js` and `dist/index.d.ts` exist.
3. Run `yarn workspace @webex/media-helpers test:unit`.

Expected result: the build completes without TypeScript errors, and the unit run reports
`Test Suites: 1 passed, 1 total` and `Tests: 31 passed, 31 total`.

## Next steps

- [Repository architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Module specification](README.md)
- [Documentation index](index.md)
