---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/plugin-logger.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-06T10:57:01Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/plugin-logger**.

The unit spec is `test/unit/spec/logger.js`. `test:unit` runs it under jest in Node, and `test:browser` runs it under karma.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js | `>=18`, declared in `package.json` `engines` |
| Yarn | Workspaces are used, so install from the workspace root rather than this directory |
| Browser for `test:browser` | The karma runner used by `webex-legacy-tools test --unit --runner karma` |
| Container, registry, VPN, or account | N/A — no external account is required to build, lint, or unit-test this package |

## Install

Dependencies are resolved for the whole workspace, not per package:

```bash
yarn install
```

Run it from the workspace root.

## Build

Compile sources to `dist/`:

```bash
yarn workspace @webex/plugin-logger build
```

`scripts.build` runs `build:src`, which calls `webex-legacy-tools build -dest "./dist" -src "./src" -js -ts -maps`. The manifest records `build:src` as the compile role and `build` as the package role.

## Run

N/A — library package with no start script.

Import the package from a consumer. `webex` and `webex-node` import it so that `webex.logger` is this plugin.

## Tests

| Tier | Command | What it covers |
| ---- | ------- | -------------- |
| Unit (Node) | `yarn workspace @webex/plugin-logger test:unit` | `test/unit/spec/logger.js` under jest, including `nodeOnly` cases |
| Unit (browser) | `yarn workspace @webex/plugin-logger test:browser` | The same spec under karma, including `browserOnly` cases |
| Lint | `yarn workspace @webex/plugin-logger test:style` | eslint over `src/` |
| Integration | N/A — `package.json` does not define `test:integration` | — |

Do not use `package.json` `scripts.test` as a verification command. It chains `test:integration`, which is not defined.

## Configuration and secrets

| Item | Where it lives |
| ---- | -------------- |
| `WEBEX_LOG_LEVEL` | Environment variable. Read once into `config.logger.level` by `src/config.js` and again on each call by `getCurrentLevel` in `src/logger.js`. |
| `NODE_ENV` | `test` forces level `trace` when no level is configured and enables test-only output tweaks |
| `config.logger.*` | `level`, `clientLevel`, `bufferLogLevel`, `historyLength`, `clientHistoryLength`, `separateLogBuffers`, `clientName`. Defaults for `level` and `historyLength` are in `src/config.js`. |
| Secrets | N/A — this package reads no credentials. It removes `authorization` keys from logged values. |

## First-run verification

1. `yarn install` from the workspace root.
2. `yarn workspace @webex/plugin-logger build`
3. `yarn workspace @webex/plugin-logger test:style`
4. `yarn workspace @webex/plugin-logger test:unit`

## Next steps

- [Architecture](architecture.md)
- [Module specification](../src/docs/README.md)
- [Specification registry](specs/README.md)
