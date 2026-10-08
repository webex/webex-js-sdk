---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-device.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-10-07T15:08:52Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/internal-plugin-device**, a package inside the Webex JS SDK Yarn workspace. All
commands below run from the monorepo root through `yarn workspace`.

## Prerequisites

| Tool or access                                | Version or requirement                                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Node.js                                       | `>=18` per this package's `engines`; use the version the monorepo root `AGENTS.md` pins for repository work           |
| Yarn workspaces                               | Provided by the monorepo root; this package declares its workspace dependencies with `workspace:*`                    |
| Webex test-user provisioning (integration only) | Required by `@webex/test-helper-test-users`; credentials come from the monorepo's environment setup, not this package |

## Install

Dependencies are installed once for the whole workspace from the monorepo root (the package defines no install
script of its own).

## Build

```bash
yarn workspace @webex/internal-plugin-device build:src
```

## Run

This package is a library with no process to start. Consumers import it for its side effect and then use
`webex.internal.device`, as shown in the package [README](../README.md).

## Tests

```bash
yarn workspace @webex/internal-plugin-device test:unit
```

Use the table as the package-level test router. Behavioral intent belongs in the
[module specification](../src/docs/README.md); exact cases remain in the native test sources.

| Tier                          | Command                                                       | Test location        | Framework              | External dependencies                                          |
| ----------------------------- | ------------------------------------------------------------- | -------------------- | ---------------------- | -------------------------------------------------------------- |
| Unit                          | `yarn workspace @webex/internal-plugin-device test:unit`      | `test/unit`          | Jest                   | None                                                           |
| Integration (browser runner)  | `yarn workspace @webex/internal-plugin-device test:browser`   | `test/integration`   | Mocha through Karma    | Provisioned Webex test users and network access to Webex services |
| Style                         | `yarn workspace @webex/internal-plugin-device test:style`     | `src`                | ESLint                 | None                                                           |

- Coverage or quality gate: none known for this package (owner-confirmed absence of a repo-specific gate).
- Enforcement source: none.
- Test environment or QA dependencies: integration specs create real test users; no manual QA tracker is
  recorded.

## Configuration and secrets

- Required configuration: none for unit tests. Runtime behavior is configured under `webex.config.device`; the
  defaults are in `src/config.js`.
- Secret source: integration tests obtain credentials through the test-user helper; no secret is stored in this
  package.
- Package or artifact access: workspace packages resolve locally; publishing uses `yarn workspace @webex/internal-plugin-device deploy:npm`.
- Required neighboring repositories or workspace layout: this package must stay inside the Webex JS SDK
  workspace so its `workspace:*` dependencies resolve.
- Platform, simulator, device, or SDK setup: the browser tier needs a browser available to Karma; IP network
  detection needs WebRTC and is not exercised under Node.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/internal-plugin-device test:unit`.
2. Check that every suite reports a pass and no failures.
3. Run `yarn workspace @webex/internal-plugin-device test:style` for the lint check.

Expected result: all six unit suites pass and ESLint reports zero errors (it currently prints warnings, including a
warning that `src/docs/README.md` is ignored by the lint patterns).

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
