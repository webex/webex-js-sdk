<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: "@riag"
updated_at: 2026-09-23T14:03:22Z
validation_status: pass
-->

# AI Agent Instructions

This is an internal Cisco Webex plugin. As such, it does not strictly adhere to semantic versioning. Use at your own risk. If you're not working on one of our first party clients, please look at our developer api and stick to our public plugins.

Internal Webex JS SDK plugin for retrieving AI-generated call summaries, notes, action items, and transcript URLs from the Pragya and AI Bridge services.

## Scope of this file

This file covers **only** `@webex/internal-plugin-call-ai-summary`. The repository-root
`AGENTS.md` owns monorepo-wide rules — Node toolchain, workspace command forms, cross-plugin
search and refactoring guidance — and stays authoritative for them. Read the root file first; this
file adds package-specific facts and records the two places where this package differs from the
repository-wide generalization.

Package-level agent entries are the established convention here: `packages/calling/AGENTS.md` and
`packages/@webex/contact-center/AGENTS.md` sit at the same position.

## Working Method

- Read the relevant repository files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, or behavior. Verify them from repository-local source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- `docs/index.md` for repository documentation navigation;
- `docs/architecture.md` for repository boundaries and interactions;
- `docs/specs/README.md` for the manifest-backed module and contract registry;
- the affected module's manifest-routed `src/docs/README.md`; and
- `docs/adr/index.md` plus applicable concrete ADRs for durable decisions.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
owns no HTTP API: it consumes the externally owned Pragya and AI Bridge surfaces and publishes an
SDK surface, so contracts stay on ecosystem-native artifacts and no OpenAPI document is selected.
The manifest remains authoritative for canonical paths and artifact decisions.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing.

Command forms follow the root `AGENTS.md` workspace convention.

| Task                   | Command             |
| ---------------------- | ------------------- |
| Install dependencies   | `yarn install` (from the monorepo root) |
| Start dev environment  | Not applicable — this is a library, not a runnable app |
| Run tests              | `yarn workspace @webex/internal-plugin-call-ai-summary test:unit` |
| Run linters            | `yarn workspace @webex/internal-plugin-call-ai-summary test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-call-ai-summary build:src` |
| Format code            | `prettier` via the repository configuration |

Running `yarn build`, `yarn test:style` or `yarn test:unit` from inside the package directory is
equivalent.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/internal-plugin-call-ai-summary`.

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

The plugin resolves a **Pragya container** by ID, then fetches and decrypts AI-generated summaries,
notes, action items, and transcripts from the URLs that container supplies. All AI-generated content is **JWE-encrypted** and decrypted via the KMS (Key Management Service) using `@webex/internal-plugin-encryption`.

The plugin registers itself as `aisummary` on the internal namespace, so importing the package is
what makes `webex.internal.aisummary` available.

**Note:** The Pragya API returns summary URLs nested under `summaryData.data`. The `getContainer()` method normalizes this automatically, flattening those URLs onto `summaryData` so consumers can read `summaryData.summaryUrl` directly.

### Tech Stack

| Area             | Tooling     | Version     |
| ---------------- | ----------- | ----------- |
| Language runtime | Node.js     | Develop on **22.14** per the root `AGENTS.md` and `.nvmrc`. `package.json` declares `engines.node >=16`, which is the consumer floor, not the development version. |
| Build tool       | `webex-legacy-tools` | workspace |
| Test framework   | Jest via `@webex/jest-config-legacy` | workspace |
| Lint/format      | ESLint `^8.24.0`, Prettier `^2.7.1` | see `package.json` |

### Project Map

- `src/index.ts`: Entry point. Registers the plugin via `registerInternalPlugin('aisummary', ...)`.
- `src/ai-summary.ts`: Main plugin class extending `WebexPlugin`. Contains all public and private methods.
- `src/types.ts`: TypeScript interfaces for request/response DTOs.
- `src/constants.ts`: Service name, resource path, and error message constants.
- `src/config.ts`: Plugin configuration (currently empty).
- `src/manual-*.js`: Manual verification scripts requiring a live token.
- `src/docs/README.md`: The canonical module specification.

### Critical Constraints

- `@webex/webex-core` provides the base plugin class, request handling, and auth interceptor; `@webex/internal-plugin-encryption` provides KMS decryption. Both are workspace dependencies.
- The plugin is fully self-contained: it must not modify `UserSession`, the `packages/webex` bundle, or the encryption plugin.
- Content URLs come from Pragya and are already region-correct; do not add service discovery for them.
- Never log decrypted AI-generated call content.

## 4. Testing Workflow

Run checks in this order:

1. `yarn test:unit`
2. `yarn test:style`
3. No integration or e2e tier exists; `src/manual-integration-test.js` is a manual script requiring a live token.

Testing rules:

- Add or update tests for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.

**Current state.** `test/unit/spec/ai-summary.ts` holds 38 unit tests covering plugin registration, all six public
methods, the `summaryData.data` flattening transform, the `keyUrl` precedence rule, every validation
branch, and each normalized error mapping. Upstream wire fixtures are in
`test/unit/fixture/responses.ts`. Note that Jest collects any `test/unit/**` subdirectory that is not
named `lib` or `fixture`, so put new fixtures under `fixture/`, never `data/`.

Do not construct a live `WebexCore` in a unit test. It boots the service catalog and fires
asynchronous U2C requests that outlive the test, so Jest reports "Cannot log after tests are done"
and the runner exits nonzero even when every assertion passes. Use `MockWebex` for behaviour, and
the internal-core plugin registry for registration assertions.

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

- Branch naming: `[feature|fix|chore]/[short-description]`
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
- Security-sensitive changes (auth, encryption, secrets handling).
- Any destructive data or infrastructure operation.

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
