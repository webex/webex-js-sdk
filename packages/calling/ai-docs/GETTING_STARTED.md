# Getting Started — @webex/calling

> Root [`AGENTS.md`](../AGENTS.md) · router [`SPEC_INDEX.md`](SPEC_INDEX.md) · system [`ARCHITECTURE.md`](ARCHITECTURE.md).

## Prerequisites

- Node.js 22.14 for this repository and Yarn workspace tooling.
- Access required by the parent `webex-js-sdk` repository for workspace dependencies and integration/E2E credentials; never commit credentials.

## Clone & Install

```bash
git clone https://github.com/webex/webex-js-sdk.git
cd webex-js-sdk
nvm install 22.14
nvm use 22.14
yarn install
```

## Build / Run / Test

| Task | Command |
|---|---|
| Build | `yarn workspace @webex/calling build:src` |
| Unit test | `yarn workspace @webex/calling test:unit` |
| Lint | `yarn workspace @webex/calling test:style` |
| E2E | `yarn workspace @webex/calling test:e2e` |
| TypeDoc | `yarn workspace @webex/calling build:docs` |

## First-Run Verification

- Run the build, one targeted unit test, and lint. A successful `dist/` build plus green Jest/ESLint output verifies the package loop.

## Configuration & Secrets

- Unit tests use mocks/fixtures. Playwright journeys require approved runtime accounts/tokens and environment configuration; obtain them through the team mechanism and never store them in source or logs.

## Dev Environment

- The package runs inside the parent Yarn workspace; use workspace commands from the repository root. Browser journeys use `packages/calling/playwright.config.ts`.

## Where to Go Next

- Agent entry: `../AGENTS.md` · Architecture: `ARCHITECTURE.md` · Routing: `SPEC_INDEX.md` · Rules: `RULES.md`.
