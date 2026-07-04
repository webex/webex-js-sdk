# Getting Started — @webex/calling

## Prerequisites

- Node.js 18, Yarn 3.4.1, repository access, and credentials only for tests that call configured environments.

## Clone & Install

From the webex-js-sdk root, run `yarn install`. Do not install dependencies separately inside `packages/calling`.

## Build / Run / Test

- Build: `yarn workspace @webex/calling build`
- Unit tests: `yarn workspace @webex/calling test:unit`
- Style: `yarn workspace @webex/calling test:style`
- TypeDoc: `yarn workspace @webex/calling build:docs`
- E2E: `yarn workspace @webex/calling test:e2e`

## First-Run Verification

Run build, unit tests, and style checks. For a focused change, run the owning `*.test.ts` first and the package suite before handoff.

## Configuration & Secrets

Runtime consumers supply an initialized Webex SDK. Never commit tokens, test credentials, phone data, or environment secrets. Playwright credentials/configuration must use the repository's approved secret mechanism.

## Multi-Repo Workspace Layout

This package lives at `packages/calling` in the webex-js-sdk Yarn workspace and depends on other workspace packages. Use root workspace commands so dependency builds and resolutions remain consistent.

## Dev Environment

Source and tests are co-located under `src`; Jest config, TypeScript config, ESLint/Prettier configuration, and Playwright configuration live in the package/root repository.

## Where to Go Next

Read `AGENTS.md`, `ai-docs/SPEC_INDEX.md`, the owning module spec, then `ai-docs/RULES.md` and relevant patterns.
