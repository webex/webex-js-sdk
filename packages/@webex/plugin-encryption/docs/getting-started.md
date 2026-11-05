---
type: Getting Started
title: Getting started
description: Local setup, build, run, and test routing for @webex/plugin-encryption.
tags: [onboarding]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-11-05T16:10:55Z
validation_status: pass
-->

# Getting started

Onboarding for **@webex/plugin-encryption**, a package inside the `webex-js-sdk` Yarn workspace. Run
every command from the workspace root.

## Prerequisites

| Tool or access | Version or requirement |
| -------------- | ---------------------- |
| Node.js        | `>=16` per this package's `engines`; the workspace root `AGENTS.md` asks for 22.14 (`nvm install 22.14 && nvm use 22.14`) |
| Yarn           | `yarn@3.4.1` (`packageManager` in the workspace root `package.json`) |
| Registry or account access | N/A for building and unit tests; the sample app needs a Webex access token with KMS access (`developer-quickstart.md` names scope `spark:kms`) |

## Install

```bash
yarn
```

## Build

```bash
yarn workspace @webex/plugin-encryption build:src
```

`build:src` writes `dist/` through `webex-legacy-tools` and then runs `build`, which writes
declarations to `dist/types`. `dist/` is ignored by Git.

## Run

N/A — this is a library with no start script. To try it in a browser, the workspace provides a sample
app at `docs/samples/plugin-encryption`: run `yarn build:local`, then `yarn samples:build` and
`yarn samples:serve` from the workspace root, as described in
[`developer-quickstart.md`](../developer-quickstart.md). In your own code, import
`@webex/plugin-encryption`, call `Webex.init({credentials: {access_token}})`, wait for `ready`, and use
`webex.cypher`.

## Tests

```bash
yarn workspace @webex/plugin-encryption test:unit
yarn workspace @webex/plugin-encryption test:style
```

| Tier | Command | Test location | Framework | External dependencies |
| ---- | ------- | ------------- | --------- | --------------------- |
| Unit | `yarn workspace @webex/plugin-encryption test:unit` | `test/unit/spec` | jest through `webex-legacy-tools`, with `@webex/test-helper-mock-webex` | None; `@webex/internal-plugin-encryption` is imported by the spec |
| Browser | `yarn workspace @webex/plugin-encryption test:browser` | `test/integration/spec` | karma through `webex-legacy-tools` | None runnable: `test/integration/spec` does not exist |

- Coverage or quality gate: `jest.config.js` sets `collectCoverage: true` and a global 85% threshold
- Enforcement source: `jest.config.js`
- Test environment or QA dependencies: none for unit tests

## Configuration and secrets

- Required configuration: `credentials.access_token` (or another credential accepted by `Webex.init`);
  for KMS certificate validation, `config.encryption.shouldValidateKMSCertificate` (default `false`) and
  optional `caroots`, described in `README.md` and the internal plugin
- Secret source: N/A for unit tests, which use mocks
- Package or artifact access: N/A
- Required neighboring packages: `@webex/webex-core` and `@webex/internal-plugin-encryption` resolve
  through the workspace
- Platform, simulator, device, or SDK setup: none for unit tests
- Never commit access tokens, `JWE` values, or real attachment URLs.

## First-run verification

1. Run `yarn workspace @webex/plugin-encryption build:src`.
2. Run `yarn workspace @webex/plugin-encryption test:unit` and check that the `Cypher` suite lists the
   `downloadAndDecryptFile`, `register`, and `deregister` cases.
3. Run `yarn workspace @webex/plugin-encryption test:style`.

Expected result: all three commands exit zero.

## Next steps

- [Package architecture](architecture.md)
- [Specification registry](specs/README.md)
- [Documentation index](index.md)
