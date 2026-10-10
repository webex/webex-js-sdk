<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rsarika@cisco.com
updated_at: 2026-10-07T13:20:21Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Instructions for AI coding assistants working on `@webex/webex-core`, the core library of the Webex JS
SDK: the plugin host, request interceptors, credentials, service discovery and storage layer.

## Working Method

- Read the relevant repository files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, or behavior. Verify them from repository-local source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries, dependencies and the contract index;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the affected module's manifest-routed specification:
  [`src`](src/docs/README.md), [`src/interceptors`](src/interceptors/docs/README.md),
  [`src/lib/credentials`](src/lib/credentials/docs/README.md),
  [`src/lib/services`](src/lib/services/docs/README.md),
  [`src/lib/services-v2`](src/lib/services-v2/docs/README.md),
  [`src/lib/storage`](src/lib/storage/docs/README.md); and
- [`docs/adr/index.md`](docs/adr/index.md) for durable decisions. None are registered yet.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. The package
publishes SDK contracts whose native source is the npm entry point declared in `package.json` and the
barrel `src/index.js`; there is no OpenAPI document because the package serves no HTTP. The manifest
remains authoritative for canonical paths and artifact decisions. Dependency packages that have their
own specifications (`@webex/http-core`, `@webex/common`, `@webex/common-timers`,
`@webex/storage-adapter-spec`) should be read through those specifications first.

## 1. Commands (Run First)

Run every command from the Webex JS SDK workspace root. Use only documented commands.

| Task | Command |
| --- | --- |
| Install dependencies | `yarn install` |
| Start dev environment | N/A — the package is a library with no runnable entry point |
| Run tests | `yarn workspace @webex/webex-core test:unit` |
| Run linters | `yarn workspace @webex/webex-core test:style` |
| Build/release artifact | `yarn workspace @webex/webex-core build:src` |
| Format code | N/A — no package-local format command; Prettier configuration is owned at the workspace root |
| Integration tests (mocha) | `yarn workspace @webex/webex-core test:integration` |
| Browser tests (karma) | `yarn workspace @webex/webex-core test:browser` |
| Run one unit file | `yarn workspace @webex/webex-core test:unit --targets <path relative to test/unit/spec>` |
| Publish | `yarn workspace @webex/webex-core deploy:npm` |

The repository requires Node 22.14 (`nvm install 22.14 && nvm use 22.14`); the package itself declares
`engines.node >=18`. The aggregate `test` script chains lint, unit, integration and browser tiers, so it
needs provisioned test users and live services. `build` delegates to `build:src`; no command builds and
tests together. If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the engineering assistant for `@webex/webex-core`, the package every other Webex SDK plugin
registers into and sends requests through.

Primary outcomes:

- Deliver production-safe changes with passing tests.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests/lint/build checks pass locally.
3. Updated docs/config cover new behavior.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area | Tooling | Version |
| --- | --- | --- |
| Language runtime | Node.js | `>=18` (`package.json` engines) |
| Language | JavaScript with TypeScript in `src/lib/services-v2` and `src/lib/domains.ts` | `package.json` |
| Build tool | `@webex/legacy-tools` (`webex-legacy-tools build`) | workspace |
| Test framework | Jest (unit), Mocha (integration), Karma (browser) | `jest.config.js`, `package.json` |
| Lint/format | ESLint via `@webex/eslint-config-legacy`; Prettier | `^8.24.0` / `^2.7.1` (`package.json`) |

### Project Map

- `src/index.js`: package entry point and export barrel; its import order is load-bearing.
- `src/webex-core.js`, `src/webex-internal-core.js`: the `WebexCore` class, plugin registration and interceptor-chain assembly.
- `src/config.js`, `src/credentials-config.js`: default configuration; several defaults read environment variables at import time.
- `src/interceptors/`: sixteen request/response interceptors. Has its own specification.
- `src/lib/credentials/`: OAuth token lifecycle. Has its own specification.
- `src/lib/services/` and `src/lib/interceptors/`: v1 service discovery and its interceptors. Has its own specification.
- `src/lib/services-v2/`: opt-in v2 service discovery in TypeScript. Has its own specification.
- `src/lib/storage/`: `@persist` decorators, store factories and the in-memory adapter. Has its own specification.
- `src/lib/batcher.js`, `src/lib/page.js`, `src/lib/webex-http-error.js`, `src/lib/webex-plugin.js`: shared helpers and plugin base classes.
- `test/unit/`: Jest unit tests; `test/integration/`: Mocha and Karma tests needing test users and live services.

### Critical Constraints

- **Import order in `src/index.js` is load-bearing.** Services and credentials are loaded inside core so they initialize before consumer plugins; do not move them into outside plugins or reorder the imports.
- **Plugin registration is process-global and first-wins.** A duplicate `registerPlugin` name is silently ignored unless `replace` is set; v2 services only activates through such a replace.
- **`config.interceptors` replaces the whole interceptor chain**, including interceptors registered by plugins.
- **Tokens are persisted as plaintext JSON.** Never log tokens or weaken the allow-list that decides which hosts receive a bearer token.
- **Exported names, event names and config keys are public.** 49 workspace packages declare a dependency on this package; removing or renaming one is a breaking change.
- **Dependent packages resolve this package through `dist`.** Rebuild with `build:src` before trusting a dependent package's tests.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/webex-core test:unit`
2. `yarn workspace @webex/webex-core test:style`
3. `yarn workspace @webex/webex-core test:integration` (requires provisioned test users and live services)

Testing rules:

- Add or update tests for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use sinon for stubs, `assert` from `@webex/test-helper-chai`, and fake timers for time-dependent code.

This package defines no coverage threshold; the repository owner confirmed there is no coverage gate
for it. Do not infer one from a platform or CI default.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output.
- Prefer small, composable functions over large procedural blocks.
- Make error handling explicit at system boundaries.
- Keep public interfaces stable unless a breaking change is requested.
- Before adding a literal path, filename, command, workflow identifier, status,
  or other policy value, search the repository for exact and semantically
  equivalent uses. When repeated production values represent one shared
  contract, move them to the narrowest owning shared module or catalog as one
  canonical named constant, enum, or type and update consumers. Keep incidental
  similarities, one-off implementation details, and independent test fixtures
  local.
- Do not import a default, named, object, or namespace binding and immediately
  re-export it. Consumers should import from the owning module; package barrels
  should use direct named re-exports.
- Do not write inline runtime `typeof` checks outside descriptively named guard
  implementations. Import and reuse the owning guard instead; TypeScript
  type-position `typeof` queries remain allowed.

Pattern example:

```text
Preferred:
- Validate external input close to the boundary.
- Return typed/structured results.
- Include actionable error messages.

Avoid:
- Passing unvalidated payloads deep into the system.
- Swallowing exceptions or returning ambiguous null values.
```

## 6. Git Workflow

- Branch naming: no repository-enforced rule was found; use a short descriptive prefix such as `feature/`, `fix/` or `chore/`
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Keep commits focused and reversible.
- Rebase on the target branch before opening PR.

PR checklist:

- What changed and why.
- Tests run and results.
- Risk/impact areas.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.

### Ask First

- Adding new dependencies or external services.
- Large refactors or schema migrations.
- Security-sensitive changes (auth, token handling, persistence, allowed-domain logic).
- Any change to exported names, event names, config keys or the interceptor order.
- Any destructive data or infrastructure operation.

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
- Edit `.sdd/templates/repo-standards` or `dist` by hand.
