<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: getting-started@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# GETTING STARTED — @webex/plugin-meetings

## Prerequisites

- Use Node.js `22.14` for this repository (`nvm use 22.14`) and the repository Yarn version.
- Install from the repository root with `yarn install`.
- Unit work is local/mocked. Browser or integration flows can require Webex test users, remote services, media permissions, and environment credentials; never commit these values.

## Clone & Install

From the repository root:

```bash
nvm use 22.14
yarn install
```

The retained `internal-README.md` contains historical branch, npm, sample, and Sauce Labs instructions. Current root configuration and package scripts take precedence where those instructions differ.

## Build / Run / Test

```bash
yarn workspace @webex/plugin-meetings build:src
yarn workspace @webex/plugin-meetings test:style
yarn workspace @webex/plugin-meetings test:unit
yarn workspace @webex/plugin-meetings test:unit --targets meeting/brbState.ts
yarn workspace @webex/plugin-meetings test:browser
```

`--targets` is relative to `test/unit/spec/` for unit tests. The package is a library, not a standalone service; sample applications elsewhere in the repository host it.

## First-Run Verification

1. Confirm `node --version` reports the repository-required runtime.
2. Build the package.
3. Run the smallest mirrored unit-test target for the module you will change.
4. Run lint on the package.
5. Before finishing, confirm no temporary Mocha `.only` remains.

## Configuration & Secrets

- Environment files and CI/test credentials are local/managed inputs. Never add credentials, Webex user secrets, Sauce Labs keys, or tokens to source control.
- npm/workspace resolution is controlled by repository configuration and `package.json`; do not replace workspace dependencies with ad-hoc source paths.
- Public consumption is through `@webex/plugin-meetings`; local development normally uses the workspace build rather than publishing.

## Multi-Repo Workspace Layout

This package lives at `packages/@webex/plugin-meetings/` inside the `webex-js-sdk` monorepo. Shared packages are resolved through Yarn workspaces. Run package-scoped commands from the repository root and avoid modifying neighboring packages unless the approved task requires their contract.

## Dev Environment

- Source is under `src/`; unit tests mirror it under `test/unit/spec/`.
- Browser/integration tests live under `test/integration/spec/` and use the package test runner.
- Build output is `dist/`; do not hand-edit generated output.
- Use Sinon for mocks/stubs and assertions from `@webex/test-helper-chai`. Prefer `calledOnceWithExactly`, fake timers for time, and parameterized tests for more than three similar cases.

## Where to Go Next

- Orientation and rules: `../AGENTS.md`
- Module routing: `SPEC_INDEX.md`
- Architecture: `ARCHITECTURE.md`
- Tests: `TEST_INDEX.md`
- Public/event boundaries: `CONTRACTS.md`
- Retained consumer examples: `../README.md` and `../UPGRADING.md`
