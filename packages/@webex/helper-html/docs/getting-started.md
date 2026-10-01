---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/helper-html.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: cursor
approved_by: repository user
updated_at: 2026-10-01T11:15:00Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/helper-html**.

The unit spec lives in `test/unit/spec/html.js` and is skipped in Node. The command that launches it is the package `test:browser` script, which runs the unit tier under karma.

## Prerequisites

| Tool or access                         | Version or requirement |
| -------------------------------------- | ---------------------- |
| Node.js | `>=18`, declared in `package.json` `engines` |
| Yarn | Workspaces are used, so install from the workspace root rather than this directory |
| Browser for the unit spec | The karma runner used by `test:browser` |
| Container, registry, VPN, or account | N/A — no external account is required to build or lint this package |

## Install

Dependencies are resolved for the whole workspace, not per package:

```bash
yarn install
```

Run it from the workspace root.

## Build

Compile sources to `dist/`:

```bash
yarn workspace @webex/helper-html build:src
```

`package.json` `scripts.build` calls the same `build:src` script. The manifest records both the compile and build roles as that workspace command.

## Run

N/A — library package with no runnable dev server. There is no start script.

Import the package from a consumer. `@webex/internal-plugin-conversation` imports `filter` and `filterEscape`.

## Tests

| Tier | Command | What it covers |
| ---- | ------- | -------------- |
| Browser unit | `yarn workspace @webex/helper-html test:browser` | `test/unit/spec/html.js` under karma. The file uses Mocha, chai, and `skipInNode`. |
| Lint | `yarn workspace @webex/helper-html test:style` | eslint over `src/` |
| Integration | N/A — `package.json` does not define `test:integration` | — |
| Node unit | N/A — `package.json` does not define `test:unit`, and the spec skips itself in Node | — |

Do not use `package.json` `scripts.test` as a verification command. It chains `test:unit` and `test:integration`, which are not defined.

## Configuration and secrets

| Item | Where it lives |
| ---- | -------------- |
| Allowed tags, styles, and extra URL schemes | Caller arguments. Defaults for schemes are `DEFAULT_ALLOWED_URL_SCHEMES` in `src/html.shim.js` and the same array in `src/html.js`. |
| Browser versus Node implementation | `package.json` `browser` field |
| Secrets | N/A — this package reads no credentials, tokens, or API keys |

## First-run verification

1. `yarn install` from the workspace root.
2. `yarn workspace @webex/helper-html build:src`
3. `yarn workspace @webex/helper-html test:style`
4. `yarn workspace @webex/helper-html test:browser` when a karma browser is available.

## Next steps

- [Architecture](architecture.md)
- [Module specification](../src/docs/README.md)
- [Specification registry](specs/README.md)
