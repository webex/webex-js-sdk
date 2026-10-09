---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-metrics.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-10-07T04:50:31Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/internal-plugin-metrics**, a workspace package of the `webex-js-sdk`
monorepo. Every command below is run from the monorepo root.

## Prerequisites

| Tool or access                         | Version or requirement                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| Node.js                                | `22.14` for building and testing, as declared by the repository owner in `.sdd/manifest.json` `toolchain`; `>=18` from `engines` in `package.json` is the consumer runtime floor |
| Yarn                                   | The monorepo's Yarn workspaces; dependencies use the `workspace:*` protocol    |
| Registry or VPN access                 | Public npm only. The package declares no `.npmrc` and no authenticated registry |

## Install

```bash
git clone https://github.com/webex/webex-js-sdk.git
yarn install
```

Consumers outside the monorepo install the published package with:

```bash
npm install --save @webex/internal-plugin-metrics
```

## Build

```bash
yarn workspace @webex/internal-plugin-metrics build:src
```

`build:src` transpiles `src/` to `dist/` and then runs `build`, which emits type declarations to
`dist/types`. Run `yarn workspace @webex/internal-plugin-metrics build` alone for declarations only.

## Run

Not applicable. This package is a library plugin with no runnable entry point. It becomes active by
being imported before a `WebexCore` instance is constructed, which registers
`webex.internal.metrics` and `webex.internal.newMetrics`:

```js
import '@webex/internal-plugin-metrics';

import WebexCore from '@webex/webex-core';

const webex = new WebexCore();
```

## Tests

```bash
yarn workspace @webex/internal-plugin-metrics test:unit
```

Use the table as the repository-level test router. List only tiers that
actually exist; behavioral intent belongs in the owning module specifications and exact
cases remain in the repository's native test sources.

| Tier         | Command                                                            | Test location     | Framework | External dependencies |
| ------------ | ------------------------------------------------------------------ | ----------------- | --------- | --------------------- |
| Unit         | `yarn workspace @webex/internal-plugin-metrics test:unit`           | `test/unit/spec`  | Mocha     | None                  |
| Integration  | Not applicable — the package defines no `test:integration` script and has no `test/integration` directory | — | — | — |
| System / E2E | Not applicable — the package defines no `test:browser` script       | —                 | —         | —                     |

Run one spec with `--targets`, relative to `test/unit/spec/`. Run the focused unit tests with
Node.js 22.14, the declared toolchain version; with nvm, switch first using `nvm use 22.14`:

```bash
yarn workspace @webex/internal-plugin-metrics test:unit --targets network-telemetry.ts
```

- Coverage or quality gate: none. The package's Mocha run enforces no threshold and defines no
  `test:coverage` script, so the monorepo CI coverage job never reaches this workspace.
  `.sdd/manifest.json` records this as `quality_gates.code_coverage.origin: none`.
- Enforcement source: lint only, through `test:style` (`eslint ./src/**/*.*`) configured by
  `.eslintrc.js`.
- Test environment or QA dependencies: none. Every spec runs in-process against
  `@webex/test-helper-mock-webex`.

The `test` script in `package.json` is not a working gate: it chains `test:integration` and
`test:browser`, which this package does not define. `.sdd/manifest.json` records `commands.build`
as an unresolved owner decision for that reason.

## Configuration and secrets

- Required configuration: none to build or test. At runtime the plugin reads its own defaults from
  `src/config.js`; both telemetry features it gates (`metrics.unhandledExceptionTelemetry.enabled`
  and `metrics.networkTelemetry.enabled`) default to `false`.
- Secret source: none. The package holds no credentials and reads only
  `process.env.METRICS_SERVICE_URL`, an optional pre-discovery service override in `src/config.js`.
- Package or artifact access: public npm. `@webex/event-dictionary-ts` is the one external runtime
  dependency pinned in `package.json`.
- Required neighboring repositories or workspace layout: none beyond the monorepo itself. The
  package depends on the `@webex/webex-core`, `@webex/common` and `@webex/common-timers` workspace
  siblings, which `yarn install` links.
- Platform, simulator, device, or SDK setup: none. Browser-only behavior is guarded at runtime, so
  the unit suite runs under Node.js.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-metrics build:src`.
2. Check that `dist/index.js` and `dist/types/index.d.ts` exist, matching the `main` and `types`
   fields in `package.json`.
3. Run `yarn workspace @webex/internal-plugin-metrics test:unit --targets network-telemetry.ts`.

Expected result: the build emits `dist/` without errors and the focused spec passes, exercising the
request-outcome collector end to end against the mocked SDK.

## Next steps

- [Repository architecture](architecture.md)
- Service specification — not applicable for this package
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
