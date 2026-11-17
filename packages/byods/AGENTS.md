<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T13:41:05Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/byods`, the Bring Your Own Data Source (BYoDS) Node.js SDK.
This file orients agents. The monorepo root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, configuration keys, or endpoints. Verify them from this
  package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries, security, and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (BYoDS SDK); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.ts` entry.
It serves no HTTP API; the Webex endpoints it calls are external contracts.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Package commands
run from `packages/byods`; `yarn workspace @webex/byods <script>` from the workspace root is
equivalent.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root), then `yarn prebuild:modules` (workspace root) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn test:unit` (Jest, with a coverage threshold) |
| Run linters            | `yarn test:style` |
| Build/release artifact | `yarn build:src` (also runs `yarn build` for declarations) |
| Format code            | `yarn fix:prettier` (rewrites `src/**/*.ts`) |

`yarn test` chains `test:style` and `test:unit`; run them separately to see each result. No
integration or browser test script exists.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web SDK engineering assistant for `@webex/byods`.

Primary outcomes:

- Deliver production-safe changes with unit tests and lint passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests, lint, and build checks pass locally, including the coverage threshold.
3. Updated docs cover new behavior, including the module spec.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | node | 22.14 for development (workspace root `AGENTS.md`; the root `.nvmrc` selects `lts/jod`; the root `package.json` `engines.node` still declares `18.x`); this package declares no `engines` field |
| Language         | TypeScript | version in `package.json` `devDependencies` |
| Build tool       | `@webex/legacy-tools` over Babel, plus `tsc` for declarations | workspace versions |
| Test framework   | Jest via `webex-legacy-tools` (`test:unit`) | version in `package.json` `devDependencies` |
| Lint/format      | eslint with the workspace root `.eslintrc.js`; prettier | versions in `package.json` `devDependencies` |

### Project Map

- `src/index.ts`: package entry; six value exports and three type exports.
- `src/byods/index.ts`: `BYODS` facade, environment selection, `verifyJWSToken`.
- `src/token-manager/index.ts`: Service App token lifecycle.
- `src/token-storage-adapter/`: `TokenStorageAdapter` contract and the in-memory default.
- `src/base-client/index.ts` and `src/http-utils/index.ts`: authenticated requests and transport.
- `src/data-source-client/`: `/dataSources` calls and JWS renewal.
- `src/Logger/`, `src/Errors/`: shared logger and error type names.
- `test/unit/spec/`: one Jest spec per component (7 suites, 83 tests).
- `dist/`: build output. Never edit by hand.
- `README.md`: retained npm page. It is not the behavioral authority.

### Critical Constraints

- Every data source request must carry the stored Service App token (module spec `INV-001`) and
  never an expired one (`INV-002`).
- The API URL and key-set URL must come from the same environment (`INV-004`).
- A failed JWS renewal tick ends the host process, and the default nonce generator always fails
  (`MOD-016`, `MOD-017`). Pin this with a characterization test before changing the timer.
- `package.json` `main` names a file the build does not write (`MOD-020`). Changing entry fields
  affects every consumer; do it only in a dedicated change.
- Never log token values or the client secret.

## 4. Testing Workflow

Run checks in this order:

1. `yarn test:unit`
2. `yarn test:style`
3. `yarn build:src` when exports, types, or build configuration change

Only a `unit` tier is recorded in `.sdd/manifest.json` `tests`; the SDD manifest `tests` schema
allows `unit`, `integration`, `e2e`, and `qa`, and this package defines no other test command.

Testing rules:

- Add or update unit cases for every behavior change, in the matching `test/unit/spec` component file.
- Stub `httpUtils` and jose at their module boundary, as the existing specs do; never call Webex.
- Cover failure paths and edge cases, not only happy paths.
- Use fake or stubbed timers for renewal tests, and restore spies so one test cannot leak into the
  next (module spec Pitfalls).
- Do not remove tests to make CI pass.

`jest.config.js` fails `test:unit` below 85% lines, functions, and statements or 75% branches.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. Lint uses the workspace root
  `.eslintrc.js` over `src/**/*.ts`.
- Prefer small functions over large procedural blocks.
- Keep `BYODS` a thin facade; token state belongs in the storage adapter.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Call the network through httpUtils and stub httpUtils in tests.
- Log with log.error(new ExtendedError(message, ERROR_TYPE.X), {file, method}) and rethrow.
- Pass a nonce generator to scheduleJWSTokenRefresh in examples and tests.

Avoid:
- Caching the token pair on TokenManager.
- Letting caller headers override the data source bearer token.
- Treating README.md as the package API.
```

## 6. Git Workflow

- Branch naming: no convention is defined in this package or in the workspace `CONTRIBUTING.md`.
- Commit format: Conventional Commits, which the workspace `CONTRIBUTING.md` requires for pull
  requests; `package.json` `commitlint` extends `@commitlint/config-conventional`.
- Keep commits focused and reversible.

PR checklist:

- What changed and why.
- Tests run and results, including coverage.
- Risk and impact, including data source providers relying on token storage and renewal.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the module spec in the same change that alters observable behavior.

### Ask First

- Changing token refresh, storage, or the `TokenStorageAdapter` contract.
- Changing the renewal timer, its failure handling, or its payload.
- Changing hosts, `BYODS_ENVIRONMENT` handling, or JWS verification options.
- Adding or removing dependencies.
- Changing exports or the `main`, `types`, or `files` fields.

### Never

- Edit build output by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package.templates_root_path`.
