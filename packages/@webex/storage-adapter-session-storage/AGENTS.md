<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T06:13:09Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/storage-adapter-session-storage`, a webex-core storage adapter
that keeps every namespace of one basekey in a single browser `sessionStorage` JSON document. This
file orients agents. The monorepo root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, method names, or storage keys. Verify them from this
  package's source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (sessionStorage adapter); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` entry. It
serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run `yarn` and
`yarn prebuild:modules` at the workspace root, and the package scripts below from this package
directory, `packages/@webex/storage-adapter-session-storage`, where `package.json` defines them. From
the workspace root, `yarn workspace @webex/storage-adapter-session-storage <script>` runs the same
script.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; the deploy workflow runs the same command); on a fresh checkout run `yarn prebuild:modules` once, because `yarn` does not build `@webex/legacy-tools` or sibling `dist/` |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn test:unit` (currently skips all 21 cases; see below) |
| Run linters            | `yarn test:style` |
| Build/release artifact | `yarn build:src` (JavaScript and source map to `dist/`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`yarn build` runs `yarn build:src` and produces the same output; the package emits no type
declarations.

`yarn test:unit` exits 0 having skipped every case, and `yarn test:browser` exits 0 having completed
0 tests, so neither proves behavior today. Do not use the aggregate `test` script: after lint and unit
tests it calls `test:integration`, which this package does not define, and exits 1. See
[Getting started](docs/getting-started.md#tests).

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/storage-adapter-session-storage`.

Primary outcomes:

- Deliver production-safe changes with build, lint, and unit tests passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Build, lint, and unit tests pass locally, and the change is exercised by a test that actually runs.
3. Updated docs cover new behavior, including the owning module spec.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | node; JavaScript sources for the browser | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=16`; the workspace root `package.json` `engines.node` reads `18.x` |
| Build tool       | yarn workspaces and `@webex/legacy-tools` over babel | yarn `3.4.1` (root `packageManager`), `@babel/core` `^7.17.10` |
| Test framework   | jest through `webex-legacy-tools test --unit --runner jest`, running the shared suite from `@webex/storage-adapter-spec` | `@webex/jest-config-legacy` (`workspace:*`) |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: the whole module — `StorageAdapterSessionStorage`, its `bind`, and the inner
  `Bound` class with `get`, `put`, `del`, and `clear`.
- `test/unit/spec/storage-adapter-session-storage.js`: runs the shared adapter suite, skipped under
  Node; imports the package by name, so it loads `dist/`.
- `process`: package-root module exporting `{browser: true}` for the envify transform.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only; its description wrongly says localStorage; see
  [ADR-0001](docs/adr/0001-retain-product-readme.md).
- Spec for every file under `src/`: `src/docs/README.md`.

### Critical Constraints

- One sessionStorage entry, named by the constructor `basekey`, holds every namespace (`MOD-001` in
  the module spec).
- `clear()` removes the whole basekey entry, every namespace, and takes no parameter (`MOD-010`,
  `MOD-011`).
- `get` rejects `NotFoundError` for an absent key and resolves falsey values (`MOD-005`, `MOD-006`).
- `bind` rejects on a missing namespace or logger but throws synchronously on a logger without
  `info`; `clear` throws synchronously without the global (`MOD-015`).
- `Object.prototype` names as keys or namespaces misbehave, and namespace `__proto__` pollutes a
  built-in prototype (`MOD-016`).

## 4. Testing Workflow

Run checks in this order, from the package directory:

1. `yarn build:src`
2. `yarn test:unit`
3. `yarn test:style`

Run `yarn prebuild:modules` once on a fresh checkout so `webex-legacy-tools` and the sibling packages'
`dist/` exist.

Testing rules:

- Build before testing: the unit spec imports `@webex/storage-adapter-session-storage`, which
  resolves to `dist/index.js`.
- The jest environment is Node, so a new case must provide its own `sessionStorage` stand-in (a sinon
  stub or a small in-memory object assigned to the global and restored afterwards); otherwise it is
  skipped or fails.
- Use sinon for stubs and `assert` from `@webex/test-helper-chai`; use `assert.calledOnceWithExactly`
  for storage and logger calls, and parametrize when more than three cases are alike, such as the
  falsey values or the `Object.prototype` names.
- Cover failure paths: missing global, logger without `info`, corrupt and non-conforming documents,
  and non-JSON values.
- Do not remove tests to make CI pass.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets
  `root: true` and extends the legacy config.
- Prefer small functions over large procedural blocks.
- Make error handling explicit.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Test presence with typeof value !== 'undefined' so 0, false, null, and '' survive.
- Keep basekey in the constructor closure and per-binding state in the module-level WeakMaps.
- Reject absent keys with NotFoundError imported from @webex/webex-core.
- Log through the bound logger with the session-storage-store-adapter: prefix.

Avoid:
- Truthiness checks on stored values.
- Logging stored values.
- Adding a key parameter to clear() or scoping it to one namespace without a change request.
- Changing the {namespace: {key: value}} layout without handling documents already stored.
```

## 6. Git Workflow

- Branch naming: no package convention is defined; follow the workspace `CONTRIBUTING.md`.
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), which
  the workspace `CONTRIBUTING.md` requires for pull requests.
- Keep commits focused and reversible.
- Rebase on the target branch before opening a pull request.

PR checklist:

- What changed and why.
- Tests run and results, including how many cases actually ran.
- Risk and impact on applications that place this adapter in a webex-core storage slot.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding or removing dependencies, including moving the test-only packages out of `dependencies`.
- Changing the constructor signature, the method set, the error types or messages, or the log level
  and prefix.
- Changing what `clear()` removes, or the stored document layout or encoding.
- Hardening the `Object.prototype` and `__proto__` handling, which changes observable behavior.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log stored values through the bound logger.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
