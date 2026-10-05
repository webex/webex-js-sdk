<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rsarika@cisco.com
updated_at: 2026-10-04T00:00:00Z
validation_status: not-run
-->

# AI Agent Instructions

Instructions for AI coding assistants working in
`packages/@webex/storage-adapter-local-storage`. The repository root carries its own `AGENTS.md`
with monorepo-wide rules; this file governs only this package and does not replace it.

## Working Method

- Read the relevant repository files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, or behavior. Verify them from repository-local source.
- Test or validate before declaring done. In this package that is harder than it looks — read
  section 4 before trusting a green run.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries, interactions, and the
  contract index;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module registry;
- the affected module's manifest-routed spec — here, [`src/docs/README.md`](src/docs/README.md).

No ADRs exist for this package yet.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface whose ecosystem-native declaration is `package.json`; it exposes no HTTP
API, so there is no OpenAPI document. The manifest remains authoritative for canonical paths and
artifact decisions.

`README.md` at the package root is **reference-only and not authoritative**. It is registered in the
manifest as `reference-only` under a `keep-separate` source policy, and it contains at least one
statement the code contradicts (it describes `clear()` as namespace-scoped; it is not). Use
`src/docs/README.md` for behavior.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run them from
the repository root with Node 22.14 (`nvm use 22.14`).

| Task                   | Command             |
| ---------------------- | ------------------- |
| Install dependencies   | `yarn install` (repository root) |
| Start dev environment  | Not applicable — this is a library with no runnable entry point |
| Run tests              | `yarn workspace @webex/storage-adapter-local-storage test:unit` — but see section 4; it verifies nothing |
| Run linters            | `yarn workspace @webex/storage-adapter-local-storage test:style` |
| Build/release artifact | `yarn workspace @webex/storage-adapter-local-storage build:src` |
| Format code            | No package-local format script; Prettier is a devDependency and formatting is enforced through lint |

Do not run `yarn workspace @webex/storage-adapter-local-storage test`. It chains `test:integration`,
which this package does not define, so it exits 1 before reaching the browser suite.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the `@webex/web-client` engineering assistant for
`@webex/storage-adapter-local-storage`, assigned in `.github/CODEOWNERS`.

Primary outcomes:

- Deliver production-safe changes with passing tests.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests/lint/build checks pass locally — and you have confirmed that the tests you are
   relying on actually executed.
3. Updated docs/config cover new behavior, including `src/docs/README.md` when behavior changes.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling     | Version     |
| ---------------- | ----------- | ----------- |
| Language runtime | Node (build and test tooling only; the module itself targets browsers) | `engines.node >= 18` in `package.json`; repository `.nvmrc` pins `lts/jod`; verified working on `v22.14.0` |
| Package manager  | Yarn (workspaces) | `3.4.1` |
| Build tool       | `webex-legacy-tools` via `@webex/legacy-tools`, Babel through `@webex/babel-config-legacy` | `workspace:*` |
| Test framework   | Jest via `@webex/jest-config-legacy` (Node route); Karma + Mocha via `webex-legacy-tools` (browser route) | `workspace:*` |
| Lint/format      | ESLint `^8.24.0` with `@webex/eslint-config-legacy`; Prettier `^2.7.1` | as declared in `package.json` |

### Project Map

- `src/index.js`: the entire implementation — `StorageAdapterLocalStorage` and its inner `Bound` class.
- `src/docs/README.md`: the canonical module specification. Authoritative for behavior.
- `test/unit/spec/storage-adapter-local-storage.js`: the only test file; delegates to the shared
  abstract suite and skips it under Node.
- `docs/`: package-level standing documentation (index, architecture, getting started, spec registry).
- `.sdd/manifest.json`: SDD manifest — modules, contracts, layout, coverage state.
- `.sdd/templates/repo-standards/`: a local generated template cache, ignored by Git. In a fresh clone,
  regenerate it with the Repo Annotation plugin setup before running template-based SDD checks.
  Do not edit or generate its contents by hand.
- `process`: a one-line CommonJS file exporting `{browser: true}` for the browserify/envify transform.
- `README.md`: npm-facing reference. Reference-only, not authoritative.

### Critical Constraints

- **Browser-only.** The module uses the `localStorage` global with no feature detection
  (`src/index.js` lines 5 and 41). It is unreachable in Node builds by design: `@webex/webex` selects it only
  through the `browser` field substitution of `config-storage.shim.js`.
- **`clear()` is basekey-scoped, not namespace-scoped.** It removes the whole `localStorage` entry
  and therefore every namespace (`src/index.js` line 77). This differs from `MemoryStoreAdapter` and is
  the single most consequential behavior in the package. Do not "fix" it to be namespace-scoped
  without an explicit decision — the purge-on-logout path depends on the current scope.
- **The at-rest document is a compatibility surface.** `localStorage[basekey]` holds
  `{ "<namespace>": { "<key>": <value> } }` with no version field and no migration step
  (`src/index.js` lines 41–67). It has no version field and no migration step. Whether a newer release
  must still read an older document is an **unresolved owner decision** — do not assume either way,
  and do not add a statement that settles it without `@webex/web-client` saying so.
- **Presence is `typeof value !== 'undefined'`, never truthiness** (`src/index.js` line 107). Changing
  this corrupts legitimately stored `0`, `false`, `null`, and `''`.
- **Security:** in a browser bundle this adapter persists OAuth access and refresh tokens as
  plaintext JSON (`webex-core/src/lib/storage/decorators.js` lines 53 and 57). Never add logging of stored
  values, and never widen what is persisted without a security review.
- **Backward compatibility:** the published constructor signature and the `bind`/`get`/`put`/`del`/
  `clear` shape are breaking-change boundaries for `@webex/webex`,
  `@webex/recipe-private-web-client`, and the authorization-browser fixtures.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/storage-adapter-local-storage test:unit`
2. `yarn workspace @webex/storage-adapter-local-storage test:style`
3. `yarn workspace @webex/storage-adapter-local-storage test:browser`

**Read this before trusting any of those results.** Measured 2026-10-01 on Node v22.14.0, no
automated test executes this package in either route:

- `test:unit` exits 0 having **skipped all 21 cases**. `testEnvironment` is `node`
  (`packages/legacy/jest/static/index.js` line 4), `localStorage` does not exist there, and
  `test/unit/spec/storage-adapter-local-storage.js` line 9 wraps the suite in `skipInNode`.
- `test:browser` exits 0 having **completed 0 tests**. Both Firefox and Chrome Headless report
  `ReferenceError: beforeAll is not defined`, because `@webex/storage-adapter-spec/src/index.js` line 40
  uses a Jest global under Karma's Mocha runner, so the suite throws while being defined.

Both routes report success while verifying nothing. Check the reported test *count*, not the exit
code. If you change behavior in `src/index.js`, no existing check will catch a regression — verify
manually in a browser and say so explicitly in the PR.

Testing rules:

- Add or update tests for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Do not add a `test:unit` case that assumes `localStorage`; the Node environment cannot run it.
- Repairing the browser route means changing `@webex/storage-adapter-spec`, which is a different
  package with four consumers. Treat it as a cross-package change, not a local fix.

There is no coverage gate for this package: `collectCoverage` is `false`, no threshold is
configured, and the repository's `Test - Coverage` CI job runs `test:coverage`, which this package
does not define.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output.
- Prefer small, composable functions over large procedural blocks.
- Make error handling explicit at system boundaries.
- Keep public interfaces stable unless a breaking change is requested.
- Before adding a literal path, filename, command, workflow identifier, status, or other policy
  value, search the repository for exact and semantically equivalent uses. When repeated production
  values represent one shared contract, move them to the narrowest owning shared module or catalog
  as one canonical named constant, enum, or type and update consumers. Keep incidental similarities,
  one-off implementation details, and independent test fixtures local.
- Do not import a default, named, object, or namespace binding and immediately re-export it.
  Consumers should import from the owning module; package barrels should use direct named re-exports.
- Do not write inline runtime `typeof` checks outside descriptively named guard implementations.
  Import and reuse the owning guard instead; TypeScript type-position `typeof` queries remain
  allowed. **Exception, grandfathered:** `src/index.js` line 107 uses a bare `typeof value !== 'undefined'`
  to implement the presence rule. It is the rule itself, not an ad-hoc check; preserve it as written.

Package-local conventions, with evidence:

- Keep `basekey` captured in the constructor closure (`src/index.js` lines 21–25). Do not promote it to an
  instance property.
- Keep per-binding state in the module-level `WeakMap`s (`src/index.js` lines 9–10), not on the instance.
- Keep `/* eslint-env browser */` at the top of browser-only sources (`src/index.js` line 5).

Pattern example:

```text
Preferred:
- Validate external input close to the boundary (bind() rejects a falsy namespace or missing logger).
- Return typed/structured results (reject NotFoundError, not a bare Error, for an absent key).
- Include actionable error messages.

Avoid:
- Passing unvalidated payloads deep into the system.
- Swallowing exceptions or returning ambiguous null values.
- Truthiness tests for presence, which silently discard 0, false, null, and ''.
```

## 6. Git Workflow

- Branch naming: `[feature|fix|chore]/[short-description]`
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Keep commits focused and reversible.
- Rebase on the target branch before opening PR. The default branch for PRs is `next`.

PR checklist:

- What changed and why.
- Tests run and results — state explicitly whether any test actually executed.
- Risk/impact areas, naming the consumers affected by a surface change.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update `src/docs/README.md` in the same change as any behavior change, and
  `docs/architecture.md` when a boundary or contract moves.

### Ask First

- Adding new dependencies or external services.
- Large refactors or schema migrations — including any change to the at-rest document layout.
- Changing `clear()` scope, the presence rule, or the published constructor signature.
- Security-sensitive changes (auth, encryption, secrets handling). Note that this package already
  persists OAuth tokens in plaintext.
- Any destructive data or infrastructure operation.
- Modifying `@webex/storage-adapter-spec` to repair the browser test route; it has four consumers.

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
- Edit `README.md` to match the code without an explicit source-policy decision; it is registered as
  protected reference-only material.
- Hand-edit files under `.sdd/templates/repo-standards/`.
