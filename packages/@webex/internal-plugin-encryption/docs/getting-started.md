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
approved_by: riag@cisco.com
updated_at: 2026-11-05T12:32:04Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/internal-plugin-encryption**, the encryption and KMS client plugin inside the Webex JS SDK
Yarn workspace. All commands below run from the monorepo root through `yarn workspace`.

## Prerequisites

| Tool or access                                  | Version or requirement                                                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                                         | `>=18` per this package's `engines`; Node.js 22.14 for repository work, as the monorepo root `AGENTS.md` requires (`nvm use 22.14`) |
| Yarn workspaces                                 | Provided by the monorepo root; this package declares its workspace dependencies with `workspace:*`                                   |
| Webex test-user provisioning (integration only) | Required by `@webex/test-helper-test-users`; credentials come from the monorepo's environment setup, not this package               |

## Install

Dependencies are installed once for the whole workspace from the monorepo root (the package defines no install
script of its own).

## Build

```bash
yarn workspace @webex/internal-plugin-encryption build:src
```

The output goes to `dist/`, which is not committed. The build also copies `assets/` to `dist/assets`
(`build:assets`). Run it before the unit tests: `test/unit/spec/kms.js` imports from `dist/`.

## Run

This package is a library with no process to start. Consumers import it for its side effect and then use
`webex.internal.encryption`:

```js
import '@webex/internal-plugin-encryption';
import WebexCore from '@webex/webex-core';

const webex = new WebexCore();
// webex.internal.encryption and webex.internal.encryption.kms are now registered
```

Maintainers refresh the shipped CA-root bundle with `yarn workspace @webex/internal-plugin-encryption assets:refresh`
(see [../assets/README.md](../assets/README.md)).

## Tests

```bash
yarn workspace @webex/internal-plugin-encryption build:src
yarn workspace @webex/internal-plugin-encryption test:unit
```

Use the table as the package-level test router. Behavioral intent belongs in the
[module specification](../src/docs/README.md); exact cases remain in the native test sources.

| Tier                         | Command                                                           | Test location      | Framework           | External dependencies                                              |
| ---------------------------- | ----------------------------------------------------------------- | ------------------ | ------------------- | ------------------------------------------------------------------ |
| Unit                         | `yarn workspace @webex/internal-plugin-encryption test:unit`      | `test/unit`        | Jest                | None (needs a prior `build:src` for the KMS suite)                 |
| Integration (Node runner)    | `yarn workspace @webex/internal-plugin-encryption test:integration` | `test/integration` | Mocha               | Provisioned Webex test users and network access to Webex services  |
| Integration (browser runner) | `yarn workspace @webex/internal-plugin-encryption test:browser`   | `test/integration` | Mocha through Karma | Same as above, plus a browser for Karma                            |
| Style                        | `yarn workspace @webex/internal-plugin-encryption test:style`     | `src`              | ESLint              | None                                                               |

- Coverage or quality gate: none specific to this package; confirmed by the owner (riag@cisco.com, 2026-11-05).
  The monorepo root `jest.config.js` carries its own global thresholds, which are not designated as this package's gate.
- Enforcement source: none found in this package.
- Test environment or QA dependencies: integration specs create real test users; no manual QA tracker is recorded.

## Configuration and secrets

- Required configuration: none for unit tests. Runtime behavior is configured under `webex.config.encryption`
  (defaults in `src/config.js`; certificate-validation keys documented in `../README.md`).
- Secret source: integration tests obtain credentials through the test-user helper; no secret is stored in this
  package.
- Package or artifact access: workspace packages resolve locally; publishing uses
  `yarn workspace @webex/internal-plugin-encryption deploy:npm`.
- Required neighboring repositories or workspace layout: this package must stay inside the Webex JS SDK
  workspace so its `workspace:*` dependencies resolve.
- Platform, simulator, device, or SDK setup: the browser tier needs a browser available to Karma.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-encryption build:src`.
2. Run `yarn workspace @webex/internal-plugin-encryption test:unit`.
3. Run `yarn workspace @webex/internal-plugin-encryption test:style` for the lint check.

Expected result: the unit suites for encryption, KMS, certificate validation, and errors pass and ESLint reports zero
errors. Not run during generation of these documents; confirm locally.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
