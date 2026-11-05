<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-11-05T12:32:04Z
validation_status: pass
-->

# AI Agent Instructions

Instructions for AI coding assistants working in `@webex/internal-plugin-encryption`, a package of the Webex JS SDK
monorepo. The package is the SDK's encryption and key management service (KMS) client plugin. The monorepo root has
its own `AGENTS.md`; this file adds the package-specific rules and does not replace it.

## Working Method

- Read the relevant repository files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, or behavior. Verify them from repository-local source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for repository documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for repository boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the affected module's manifest-routed spec, [`src/docs/README.md`](src/docs/README.md); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs for durable decisions.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package owns no
HTTP API: its published surface is the npm package declared in `package.json`. For dependency packages, read their
module specification when one exists (`src/docs/README.md` inside the dependency package) and fall back to their
source otherwise; among this package's dependencies only `@webex/kms-caroots` has no specification.
The manifest remains authoritative for canonical paths and artifact decisions. The monorepo root routing is in the
root [`docs/index.md`](../../../docs/index.md#sdd-package-routing).

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run them from the monorepo root.
Use Node.js 22.14 for repository work (`nvm use 22.14`, from the monorepo root `AGENTS.md`).

| Task                   | Command                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------ |
| Install dependencies   | Not defined in this package; installed by the monorepo root workspace                |
| Start dev environment  | Not applicable: a library with no process to start                                   |
| Run tests              | `yarn workspace @webex/internal-plugin-encryption test:unit`                         |
| Run linters            | `yarn workspace @webex/internal-plugin-encryption test:style`                        |
| Build/release artifact | `yarn workspace @webex/internal-plugin-encryption build:src`                         |
| Format code            | Not defined in this package (Prettier is a dev dependency without a script)          |

The unit suite `test/unit/spec/kms.js` imports from `dist/`, so run `build:src` before `test:unit`. If a required
command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/internal-plugin-encryption`.

Primary outcomes:

- Deliver production-safe changes with passing tests.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests/lint/build checks pass locally.
3. Updated docs/config cover new behavior, including the module spec when a requirement, export, config key, metric, or event changes.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling                                              | Version                                              |
| ---------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| Language runtime | Node.js, browser                                     | `>=18` (`engines` in `package.json`)                 |
| Build tool       | `@webex/legacy-tools` (`webex-legacy-tools build`)   | Workspace-pinned                                     |
| Test framework   | Jest (unit), Mocha through Karma (integration), Chai | Jest and Chai workspace-supplied; see `package.json` |
| Lint/format      | ESLint, Prettier                                     | `^8.24.0`, `^2.7.1`                                  |

### Project Map

- `src/index.js`: plugin registration, payload transformer, exports
- `src/encryption.js`: `Encryption` plugin (key retrieval and cache, text, binary, SCR crypto, download)
- `src/kms.js`, `src/kms-batcher.js`: KMS client, context negotiation, request batching
- `src/kms-certificate-validation.js`, `src/caroots-asset*.js`, `src/union-bundle.js`: KMS certificate and CA-root handling
- `src/kms-errors.js`, `src/constants.js`, `src/config.js`: errors, constants, defaults
- `assets/`, `scripts/`: shipped signed CA-root bundle and its refresh script
- `src/docs/README.md`: the canonical module specification
- `test/unit/spec/` and `test/integration/spec/`: unit and integration suites
- `docs/`: package architecture, getting started, registry, and ADRs
- `.sdd/manifest.json`: machine-readable SDD manifest; `.repo-context.json`: operational context for agents
- `README.md`: the package's own usage text (kept separate from the generated docs)

### Critical Constraints

- This package is security-sensitive. Never log, persist, or expose plaintext keys, tokens, or KMS payloads beyond the
  existing paths; keep payload logging behind `NODE_ENV !== 'production'`.
- Do not edit `src/union-bundle.js` or the shipped `assets/ios_union-*.p7b` by hand; run
  `yarn workspace @webex/internal-plugin-encryption assets:refresh`.
- Enforced certificate validation must fail closed, and report-only checks must never reject setup (`MOD-011`, `MOD-012`).
- Keep the Node and browser variants (`ensure-buffer`, `caroots-asset`) aligned and the `browser` field in `package.json` in step.
- `KmsDryErrorInterceptor` is registered only in test mode; do not register it elsewhere.
- Keep exports, config keys, metric names, and the key-revoke event in step with the module spec.
- The package is an internal plugin: semantic versioning is not strictly followed, but dependents can still break.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-encryption build:src` (the unit suite reads `dist/`)
2. `yarn workspace @webex/internal-plugin-encryption test:unit`
3. `yarn workspace @webex/internal-plugin-encryption test:style`
4. `yarn workspace @webex/internal-plugin-encryption test:integration` or `test:browser` when integration behavior changes (needs provisioned Webex test users and network access)

Testing rules:

- Add or update tests for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use sinon for mocks and stubs and `assert` from `@webex/test-helper-chai`, as the existing tests do.

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

- Branch naming: follow the monorepo root conventions; this package defines none of its own.
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), as enforced by the monorepo root commit lint configuration.
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
- Security-sensitive changes (auth, encryption, secrets handling); in this package that covers most of `src/`.
- Any destructive data or infrastructure operation.

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and `.sdd/manifest.json` refers to them.
