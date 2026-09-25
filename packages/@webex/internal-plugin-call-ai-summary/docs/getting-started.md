---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/internal-plugin-call-ai-summary.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: "@riag"
updated_at: 2026-09-23T14:03:22Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/internal-plugin-call-ai-summary**.

## Prerequisites

| Tool or access                         | Version or requirement |
| -------------------------------------- | ---------------------- |
| Node.js                                | `>=16` per `package.json` |
| Yarn (berry, workspace protocol)       | As pinned by the monorepo |
| An authenticated Webex SDK instance with a registered device | Required |
| `@webex/internal-plugin-encryption` (pulled in automatically as a dependency) | Workspace dependency |
| A valid Pragya container ID (obtained from Janus call history `extensionPayload.callingContainerIds`) | Required for any live call |

## Install

This plugin is part of the Webex JS SDK monorepo. It self-registers when imported — no changes to `packages/webex` are needed.

```bash
yarn install   # From the SDK monorepo root
```

To use in a consuming application:

```js
// Importing the plugin auto-registers it on webex.internal.aisummary
import '@webex/internal-plugin-call-ai-summary';
```

## Build

```bash
cd packages/@webex/internal-plugin-call-ai-summary
yarn build
```

## Run

This package is a library, not a runnable application. It becomes active when a consuming
application imports it, exposing `webex.internal.aisummary`. To exercise it directly, use the manual
scripts in the Tests section below.

## Tests

```bash
yarn test:unit
```

Use the table as the repository-level test router. List only tiers that
actually exist; behavioral intent belongs in the owning module specifications and exact
cases remain in the repository's native test sources.

| Tier         | Command              | Test location | Framework   | External dependencies               |
| ------------ | -------------------- | ------------- | ----------- | ----------------------------------- |
| Unit         | `yarn test:unit`     | `test/unit/spec/` | Jest via `@webex/jest-config-legacy` | None |
| Manual       | `node src/manual-pragya-api-test.js` | `src/manual-pragya-api-test.js` | Plain Node script | Live Webex token |
| Manual       | `node src/manual-integration-test.js` | `src/manual-integration-test.js` | Plain Node script | Live Webex token and container ID |

- Coverage or quality gate: none. The repository owner verified on 2026-09-23 that no coverage gate applies to this package; no threshold exists in this package, in `@webex/jest-config-legacy`, or in any repository-level Sonar configuration.
- Enforcement source: none found.
- Test environment or QA dependencies: the manual scripts require live Pragya and AI Bridge access.

The unit tier runs 38 tests from `test/unit/spec/ai-summary.ts`, with upstream wire fixtures in
`test/unit/fixture/responses.ts`. Jest collects `test/unit/**` excluding `lib` and `fixture`, so new
fixture files belong under `fixture/`.

The suite needs only `engines.node >=16`; it is verified on Node 24.10 as well as the monorepo's
pinned 22.14, so `nvm` is not required to run it.

### Manual verification scripts

Two manual test scripts are provided in `src/`. Both scripts require a valid Webex access token. Set `WEBEX_TOKEN` and optionally `CONTAINER_ID` as environment variables, or update the placeholders inside the scripts.

`manual-pragya-api-test.js` validates the Pragya container response structure (34 checks).

```bash
cd packages/@webex/internal-plugin-call-ai-summary
node src/manual-pragya-api-test.js
```

Provide the token as `WEBEX_TOKEN='<token>'` on the same line.

A manual integration test is provided for verifying against live APIs. `manual-integration-test.js` tests the full end-to-end flow using the SDK service catalog:

1. Device registration (WDM) to populate the service catalog
2. `getContainer` via plugin (resolves `service: 'pragya'` from the catalog)
3. `getSummary` via plugin (fetches + decrypts note, short note, and action items via KMS)
4. `getTranscriptUrl` via plugin
5. Transcript content fetch

```bash
cd packages/@webex/internal-plugin-call-ai-summary
node src/manual-integration-test.js
```

Provide a fresh token and container ID as `WEBEX_TOKEN='<token>' CONTAINER_ID='<id>'` on the same line.

This script registers a device (WDM), resolves the Pragya service via the SDK service catalog, fetches the container, decrypts summary content, and prints the results.

## Configuration and secrets

- Required configuration: none. `src/config.ts` declares an empty `aisummary` namespace.
- Secret source: a Webex access token supplied at runtime by the host application, or `WEBEX_TOKEN` for the manual scripts.
- Package or artifact access: the monorepo's configured npm registry.
- Required neighboring repositories or workspace layout: the `webex-js-sdk` monorepo, because dependencies use the `workspace:*` protocol.
- Platform, simulator, device, or SDK setup: a registered Webex device is required before any decryption can succeed.
- Never commit credentials or copy production secrets into a local config.

## Development

```bash
cd packages/@webex/internal-plugin-call-ai-summary
yarn build        # Build
yarn test:style   # Lint
yarn test:unit    # Unit tests
yarn test         # All checks
```

## First-run verification

1. Run `yarn build` from the package directory.
2. Check that `dist/index.js` and its type declarations are produced.
3. Run `yarn test:style`.

Expected result: the build emits `dist/` output and ESLint reports no errors.

## Next steps

- [Repository architecture](architecture.md)
- [Module specification](../src/docs/README.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
