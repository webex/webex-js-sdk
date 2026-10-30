<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rsarika@cisco.com
updated_at: 2026-10-06T11:51:18Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Instructions for AI coding assistants working on `@webex/storage-adapter-local-forage`, the package
that persists Webex JS SDK storage in the browser's IndexedDB through `localforage`.

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
- [`docs/architecture.md`](docs/architecture.md) for package boundaries, the data location, the
  security view, and the contract index;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract
  registry;
- [`src/docs/README.md`](src/docs/README.md), the module specification and the document that matters
  most here. It owns the public surface, every requirement, the record layout, the caller-visible
  failure modes, the known hazards, and the test gaps; and
- [`docs/adr/index.md`](docs/adr/index.md) for durable decisions. None are registered yet; the
  design choices behind the current behavior are in the module spec's `Key design trade-off`.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes two contracts: `local-forage-storage-adapter`, an npm package surface whose native source
is the entry point declared in `package.json`, and `local-forage-indexeddb-store`, the on-device record
layout defined in `src/index.js`. There is no OpenAPI document because the package serves no HTTP. The
manifest remains authoritative for canonical paths and artifact decisions.

## 1. Commands (Run First)

Run every command from the Webex JS SDK workspace root. Use only documented commands; do not invent
alternatives when a command is missing.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn install` |
| Start dev environment  | N/A; the package is a library with no runnable entry point |
| Run tests              | None canonical. `yarn workspace @webex/storage-adapter-local-forage test:browser` is the only committed runner and does not execute the shared suite (see `src/docs/README.md` `Verification`) |
| Run linters            | `yarn workspace @webex/storage-adapter-local-forage test:style` |
| Build/release artifact | `yarn workspace @webex/storage-adapter-local-forage build` |
| Format code            | N/A; no package-local format command. Prettier configuration is owned at the workspace root |

Do not run the package's aggregate `test` script or a `test:unit` script. The package
defines no `test:unit` or `test:integration` script, and the aggregate `test` script chains both, so
it cannot succeed. If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web-client storage engineering assistant for `@webex/storage-adapter-local-forage`.

Primary outcomes:

- Deliver production-safe changes with passing tests.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. `test:style` and `build` pass locally, and any test you add actually executes.
3. Updated docs cover new behavior. A behavior change updates `src/docs/README.md` in the same
   commit.
4. PR summary includes risks and rollback notes, including the effect on records already stored in
   users' browsers.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | JavaScript (ES modules with decorators) running in a browser; Node.js only for tooling | Node `>=18` per `package.json` `engines` |
| Storage library  | `localforage` | `^1.7.3` (the workspace lockfile resolves 1.10.0) |
| Build tool       | `webex-legacy-tools` via `@webex/legacy-tools`, with `@webex/babel-config-legacy` | `workspace:*` |
| Test framework   | Shared conformance suite from `@webex/storage-adapter-spec`; Karma with Mocha via `test:browser`; Jest config via `@webex/jest-config-legacy` | `workspace:*` |
| Lint/format      | ESLint via `@webex/eslint-config-legacy`; Prettier | ESLint `^8.24.0`; Prettier `^2.7.1` (no local script) |

### Project Map

- `src/index.js`: the whole module, `StorageAdapterLocalForage` and its per-instance `Bound` binding
  class. There is no other source file.
- `src/docs/README.md`: the module specification. Update it in the same change that alters behavior.
- `test/unit/spec/storage-adapter-local-forage.js`: the only test file. It runs the shared
  conformance suite inside `skipInNode(describe)` and declares no case of its own.
- `docs/`: package-wide standing documentation (index, architecture, getting started, spec registry,
  ADR index).
- `.sdd/manifest.json`: SDD routing, coverage state, contracts, and artifact decisions. The Repo
  Standards template snapshot is shared from the workspace root's `.sdd/templates/repo-standards`
  and is not copied into this package.
- `process`: a one-line module exporting `{browser: true}`; nothing in this package or its build
  tooling references it.
- `jest.config.js`, `babel.config.js`, `.eslintrc.js`: thin files over shared workspace configuration.

### Critical Constraints

- **The stored record layout is a compatibility contract.** Records are keyed `${namespace}/${key}`
  in the default `localforage` database (`localforage` / `keyvaluepairs`). Changing the composition,
  the database, or the store name orphans data in every user's browser. Do it only with a migration.
- **`clear()` empties the whole default database, and the constructor argument is ignored.** Both
  are current behavior that the owner classified on 2026-10-06 as known hazards to fix separately.
  Do not rely on either as a contract, and do not change either silently. A fix is a behavior change
  for the logout path, which calls `clear()` on every cached binding.
- **`get` must keep a missing key distinct from a stored `null`.** The storage layer treats
  `NotFoundError` as "no data" and any other rejection as a failure.
- **Stored values are unencrypted and can include KMS key material.** Escalate any change to what is
  stored, logged, or cleared.
- **The package is browser-only.** In Node, `localforage` has no driver and every operation rejects.

## 4. Testing Workflow

Run checks in this order:

1. No unit tier executes today. Do not treat a green `test:browser` run as evidence of behavior.
2. `yarn workspace @webex/storage-adapter-local-forage test:style`
3. `yarn workspace @webex/storage-adapter-local-forage build`

Testing rules:

- Add or update tests for every behavior change, and confirm that the new test actually runs. The
  shared suite is skipped in Node and calls the Jest-only `beforeAll` under Karma with Mocha.
- Cover failure paths and edge cases, not only happy paths: missing namespace or logger, a missing
  key versus a stored `null`, and `put(key, undefined)`.
- Do not remove tests to make CI pass.
- Add a characterization baseline before any risky modification; this module has none.

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
- Log only through the binding's injected logger, with the `storage-adapter-local-forage:` prefix.
- Keep namespace and logger in the module-level WeakMaps; do not expose them as binding properties.
- Keep the `// eslint-disable-next-line require-jsdoc` comment above each `oneFlight`-decorated
  method.

Pattern example:

```text
Preferred:
- Validate bind() arguments before creating a binding and reject with a descriptive Error.
- Reject a missing key with NotFoundError from @webex/webex-core.
- Compose every stored key as `${namespace}/${key}`.

Avoid:
- Resolving undefined or null for a missing key.
- Writing to a different localforage instance or store without a data migration.
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

- Adding new dependencies or external services, including replacing or upgrading `localforage`.
- Large refactors or schema migrations, including any change to the record layout or `clear()` scope.
- Security-sensitive changes (auth, encryption, secrets handling), including what is stored or logged.
- Any destructive data or infrastructure operation.

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
