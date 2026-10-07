---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-llm.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-07T07:05:22Z
validation_status: pass-with-warnings
-->

# Getting started

Onboarding for **@webex/internal-plugin-llm**. Commands run from the webex-js-sdk workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js | `>=18`, declared in `package.json` `engines` |
| Yarn | Workspaces are used, so install from the workspace root rather than this directory |
| Browser for `test:browser` | Only to exercise the karma runner that `test:browser` starts through `@webex/legacy-tools` |

## Install

The repository is already cloned when you are reading this file. Dependencies are resolved for the
whole workspace:

```bash
yarn install
```

## Build

```bash
yarn workspace @webex/internal-plugin-llm build
```

`scripts.build` runs `build:src`, which uses the `@webex/legacy-tools` builder to compile `.js` and
`.ts` files from `src/` into `dist/` with source maps. The manifest records `build:src` as the
compile role and `build` as the package role.

## Run

N/A — library package with no start script. Import the package from a consumer; plugin-meetings
imports it so that `webex.internal.llm` exists.

## Tests

```bash
yarn workspace @webex/internal-plugin-llm test:unit
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/internal-plugin-llm test:unit` | `test/unit/spec` | jest, chai, sinon, `@webex/test-helper-mock-webex` | None |
| Browser (karma) | `yarn workspace @webex/internal-plugin-llm test:browser` | integration files only; none exist | karma | A browser |
| Lint | `yarn workspace @webex/internal-plugin-llm test:style` | `src/` | eslint | None |

- The browser run is manifest `commands.browser-test` with role `other`, because the SDD manifest
  `tests` schema allows only `unit`, `integration`, `e2e`, and `qa`.
- `test:browser` passes only `--integration`. The legacy-tools runner then collects files from
  `test/integration/spec`, which does not exist, so the run executes no tests. It does not run the
  unit spec.
- No standalone integration tier exists: `package.json` does not define `test:integration`.
- Do not use the `package.json` script `test` as a verification command; it chains the undefined
  `test:integration`.
- Coverage or quality gate: N/A — no coverage threshold.
- Enforcement source: none. `jest.config.js` re-exports `@webex/jest-config-legacy`, which sets
  `collectCoverage: false` and no `coverageThreshold`, and `package.json` has no coverage script.
- Test environment or QA dependencies: none.

## Configuration and secrets

- Required configuration: none to build or unit-test. At runtime, `config.llm` defaults come from
  `src/llm.ts`, and the environment variables `MERCURY_PING_INTERVAL`, `MERCURY_PONG_TIMEOUT`,
  `MERCURY_BACKOFF_TIME_MAX`, `MERCURY_BACKOFF_TIME_RESET`, and `MERCURY_FORCE_CLOSE_DELAY` override
  them. The JWT data-channel flow follows the developer feature toggle described in the module spec.
- Secret source: data-channel tokens come from the calling meeting at runtime; this package reads no
  secret from files or the environment.
- Package or artifact access: N/A — workspace dependencies only.
- Required neighboring repositories or workspace layout: the webex-js-sdk workspace, because
  internal-plugin-mercury is a `workspace:*` dependency.
- Platform, simulator, device, or SDK setup: N/A.
- Never commit credentials or copy production secrets into a local config.

## First-run verification

1. Run `yarn install` from the workspace root.
2. Run `yarn workspace @webex/internal-plugin-llm build` and check that `dist/index.js` exists.
3. Run `yarn workspace @webex/internal-plugin-llm test:unit`.

Expected result: jest reports the `plugin-llm` suite passing with no failures.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
- [LLM channel plugin specification](../src/docs/README.md)
