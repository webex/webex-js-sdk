---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-wdm.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-10-12T15:10:04Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/internal-plugin-wdm**, a deprecated alias package inside the Webex JS SDK Yarn workspace.
All commands below run from the monorepo root through `yarn workspace`.

## Prerequisites

| Tool or access                                  | Version or requirement                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Node.js                                         | `>=16` per this package's `engines`; Node.js 22.14 for repository work, as the monorepo root `AGENTS.md` requires (`nvm use 22.14`) |
| Yarn workspaces                                 | Provided by the monorepo root; this package declares its workspace dependencies with `workspace:*`                              |
| Webex test-user provisioning (integration only) | Required by `@webex/test-helper-test-users`; credentials come from the monorepo's environment setup, not this package          |

## Install

Dependencies are installed once for the whole workspace from the monorepo root (the package defines no install
script of its own).

## Build

```bash
yarn workspace @webex/internal-plugin-wdm build:src
```

The output goes to `dist/`, which is not committed.

## Run

This package is a library with no process to start. Consumers import it for its side effect, which loads the device
plugin, and then use `webex.internal.device`. The usage snippet in the package [README](../README.md) shows
`webex.internal.wdm`, which this package does not define (see the module specification's pitfalls).

## Tests

```bash
yarn workspace @webex/internal-plugin-wdm test:unit
```

Use the table as the package-level test router. Behavioral intent belongs in the
[module specification](../src/docs/README.md); exact cases remain in the native test sources.

| Tier                         | Command                                                    | Test location      | Framework           | External dependencies                                              |
| ---------------------------- | ---------------------------------------------------------- | ------------------ | ------------------- | ------------------------------------------------------------------ |
| Unit                         | `yarn workspace @webex/internal-plugin-wdm test:unit`      | `test/unit`        | Jest                | None                                                               |
| Integration (browser runner) | `yarn workspace @webex/internal-plugin-wdm test:browser`   | `test/integration` | Mocha through Karma | Provisioned Webex test users and network access to Webex services  |
| Style                        | `yarn workspace @webex/internal-plugin-wdm test:style`     | `src`              | ESLint              | None                                                               |

- Coverage or quality gate: none known for this package (owner-confirmed absence of a package-specific gate).
- Enforcement source: none.
- Test environment or QA dependencies: the integration spec creates real test users; no manual QA tracker is
  recorded.
- The `test` script in `package.json` chains `test:integration`, which is not defined; run the tiers above
  individually.

## Configuration and secrets

- Required configuration: none for unit tests. This package defines no configuration of its own; runtime behavior is
  configured under `webex.config.device` by the device package.
- Secret source: integration tests obtain credentials through the test-user helper; no secret is stored in this
  package.
- Package or artifact access: workspace packages resolve locally; publishing uses `yarn workspace @webex/internal-plugin-wdm deploy:npm`.
- Required neighboring repositories or workspace layout: this package must stay inside the Webex JS SDK
  workspace so its `workspace:*` dependencies resolve.
- Platform, simulator, device, or SDK setup: the browser tier needs a browser available to Karma.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-wdm test:unit`.
2. Check that the suite reports one passing test and no failures.
3. Run `yarn workspace @webex/internal-plugin-wdm test:style` for the lint check.

Expected result: the single placeholder test passes (it asserts `true` and does not exercise the alias) and ESLint
reports zero errors (it prints one warning that `src/docs/README.md` is ignored by the lint patterns).

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
