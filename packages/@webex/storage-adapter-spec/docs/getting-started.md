---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/storage-adapter-spec.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: rsarika@cisco.com
updated_at: 2026-09-23T07:36:44Z
validation_status: not-run
-->

# Getting started

Onboarding for **@webex/storage-adapter-spec**.

One thing to know before anything else: this package holds no test file and no process to run. It
exports a conformance suite that sibling workspace packages execute. Verifying a change here means
running a *consumer's* tests — and only one of them actually runs it under Node.

## Prerequisites

| Tool or access                         | Version or requirement |
| -------------------------------------- | ---------------------- |
| Node.js | `>=18`, declared in `package.json` `engines` |
| Yarn | Workspaces are used, so install from the workspace root rather than this directory |
| Container, registry, VPN, or account | N/A — no external account or network access is required to build or lint this package |

## Install

Dependencies are resolved for the whole workspace, not per package:

```bash
yarn install
```

Run it from the workspace root. This package's `@webex/*` dependencies resolve to workspace siblings.

## Build

```bash
yarn workspace @webex/storage-adapter-spec build
```

This transpiles `src/` into the package's git-ignored output directory with source maps, using the
settings re-exported by `babel.config.js`. The published entry point resolves to that output.

## Run

Not applicable. This package has no runnable process, server, or CLI — it is a library consumed at
test time. `package.json` declares no start command.

## Tests

```bash
yarn workspace @webex/webex-core test:unit --targets storage/storage-adapter.js
```

That sibling command is what actually executes this package's suite. Measured 2026-09-23: **21 of 21
cases executed and passed.**

The only verification command this package itself owns is `test:style`, and it only lints.

Three commands will not do what their names suggest:

- `test` chains `test:style && test:unit && test:integration && test:browser`, but this package
  defines neither `test:unit` nor `test:integration`. It fails after the lint step with
  `Couldn't find a script named "test:unit"`.
- `test:browser` is defined, but this package contains no test file for the runner to collect.
- `yarn workspace @webex/storage-adapter-local-storage test:unit` exits zero and looks like a pass,
  but that consumer wraps its call in a Node skip. Measured 2026-09-23: it reported 21 tests and
  **skipped all 21**. The local-forage and session-storage adapters behave the same way. A green run
  from any of the three is not evidence that the contract holds.

Use the table as the repository-level test router. List only tiers that
actually exist; behavioral intent belongs in the owning module specifications and exact
cases remain in the repository's native test sources.

| Tier         | Command              | Test location | Framework   | External dependencies               |
| ------------ | -------------------- | ------------- | ----------- | ----------------------------------- |
| Lint | `yarn workspace @webex/storage-adapter-spec test:style` | `src/` | ESLint via `.eslintrc.js` | None |
| Contract (Node) | `yarn workspace @webex/webex-core test:unit --targets storage/storage-adapter.js` | The sibling `@webex/webex-core` storage test tree | Jest, asserting through `@webex/test-helper-chai` | That package's in-memory adapter; nothing external |
| Contract (browser only) | Each browser adapter's own browser runner | Those sibling packages' test trees | Karma | A browser environment — all three skip entirely under Node |

- Coverage or quality gate: N/A — no coverage gate applies to this package, confirmed by the package
  owner during onboarding. No threshold is enforced in this package's build.
- Enforcement source: none. `jest.config.js` re-exports the workspace configuration and adds no
  threshold, and `package.json` defines no coverage command.
- Test environment or QA dependencies: none owned here. The environment belongs to whichever consumer
  package runs the suite.

## Configuration and secrets

- Required configuration: none. `package.json` declares no environment variables or config files.
- Secret source: N/A — the package reads no secrets.
- Package or artifact access: publishing uses the workspace's npm credentials through the publish
  command in `package.json`; no credentials are needed to build or lint.
- Required neighboring repositories or workspace layout: this package must be installed as part of
  the workspace so its `@webex/*` dependencies resolve. Building it in isolation will fail.
- Platform, simulator, device, or SDK setup: N/A.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn workspace @webex/storage-adapter-spec test:style`.
2. Run `yarn workspace @webex/storage-adapter-spec build` and confirm the output directory is
   regenerated.
3. Run `yarn workspace @webex/webex-core test:unit --targets storage/storage-adapter.js`.

Expected result: the lint step reports no errors, the build writes a transpiled module and source
map, and step 3 reports **21 passed**. Step 3 is the only step that proves the suite itself still
works, so read its summary line rather than trusting the exit code — a run reporting `21 skipped` has
verified nothing.

## Next steps

- [Repository architecture](architecture.md)
- [Module specification](../src/docs/README.md) — the contract this package defines
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
