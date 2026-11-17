<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T16:20:06Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/plugin-people`, the public `people` plugin of the SDK (it reads
Webex person records by id, for the current user, or by filter, batching lookups by id into one
request). This file orients agents. The monorepo root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, method names, or request paths. Verify them from this
  package's source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (People plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes a public SDK surface, so its contract artifact is `package.json` plus the `src/index.js`
entry. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run `yarn` and
`yarn prebuild:modules` at the workspace root, and the package scripts below from this package
directory, `packages/@webex/plugin-people`, where `package.json` defines them. From the workspace root, `yarn workspace @webex/plugin-people <script>` runs the same script.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; the deploy workflow runs the same command); on a fresh checkout run `yarn prebuild:modules` once, because `yarn` does not build `@webex/legacy-tools` or sibling `dist/` |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn test:unit` (after `build:src`; the specs import the package by name, so they test `dist/`) |
| Run linters            | `yarn test:style` |
| Build/release artifact | `yarn build:src` (JavaScript and source maps to `dist/`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`yarn build` runs `yarn build:src` and produces the same output; the package emits no type
declarations.

Do not use the aggregate `test` script: after lint and unit tests it calls `test:integration`, which
this package does not define, and exits 1. `yarn test:browser:broken` runs `test/integration/spec`
through karma but verifies nothing today; see [Getting started](docs/getting-started.md#tests) for its
state.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/plugin-people`.

Primary outcomes:

- Deliver production-safe changes with build, unit tests, and lint passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Build, unit tests, and lint pass locally.
3. Updated docs cover new behavior, including the owning module spec.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | node; JavaScript sources | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=18`; the workspace root `package.json` `engines.node` reads `18.x` |
| Build tool       | yarn workspaces and `@webex/legacy-tools` over babel | yarn `3.4.1` (root `packageManager`), `@babel/core` `^7.17.10` |
| Test framework   | jest through `webex-legacy-tools` and `@webex/jest-config-legacy`, with sinon, `@webex/test-helper-chai`, and `@webex/test-helper-mock-webex` | — |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: registers public plugin `people` with its config, and exports `People` (default
  only).
- `src/people.js`: `People` — `get`, `list`, `inferPersonIdFromUuid`, the `oneFlight` `_getMe`, and
  the `batcher` child.
- `src/people-batcher.js`: `PersonUUIDRequestBatcher` — groups lookups by id into one
  `GET people/?id=` and maps the response back to each caller.
- `src/config.js`: the `people` config (batcher timings and `showAllTypes`).
- `test/unit/spec/`: unit cases (`people.js`, `people-batcher.js`) run by `test:unit`.
- `test/integration/spec/people.js`: live-service cases that no script runs today.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only; it shows only `get(id)`; see
  [ADR-0001](docs/adr/0001-retain-product-readme.md).
- Spec for every file under `src/`: `src/docs/README.md`.

### Critical Constraints

- The plugin is `webex.people`; `webex`, `webex-node`, and `@webex/recipe-private-web-client` register
  it by import, and `@webex/common`, `@webex/plugin-meetings`, and `@webex/calling` call it.
- Every lookup by id goes through the batcher, so a burst of `get` calls sends one request per flush
  (`INV-001` in the module spec).
- A uuid and its hydra id must stay one lookup key; the batcher matches responses by hydra id
  (`INV-002`).
- `list` with an array resolves a plain array; `list` with a query object resolves a `Page` whose
  `items` consumers read.
- The batcher calls `webex.people.inferPersonIdFromUuid`, so the plugin must stay mounted as `people`.

## 4. Testing Workflow

Run checks in this order, from the package directory:

1. `yarn build:src`
2. `yarn test:unit`
3. `yarn test:style`

Run `yarn prebuild:modules` once on a fresh checkout so `webex-legacy-tools` and the sibling packages'
`dist/` exist.

Testing rules:

- Add or update cases in `test/unit/spec/people.js` or `test/unit/spec/people-batcher.js` for every
  behavior you change; the integration spec does not run, so it does not count as coverage.
- Use `@webex/test-helper-mock-webex` with sinon stubs for `webex.request`, and assert with
  `@webex/test-helper-chai`; use `sinon.useFakeTimers()` to drive batcher flushes.
- Use `assert.calledOnceWithExactly` for call arguments, and parametrize when more than three cases are
  alike.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets
  `root: true` and extends the legacy config.
- Prefer small functions over large procedural blocks.
- Make error handling explicit; reject guard failures before touching the batcher or the network.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Look up ids through this.batcher.request so duplicates collapse and bursts batch.
- Normalize ids with inferPersonIdFromUuid so request and response fingerprints match.
- Guard arguments with Promise.reject(new Error('...')) before any request.

Avoid:
- Calling webex.request for people/?id= directly.
- Changing the ciscospark://us/PEOPLE/ prefix or the fingerprint functions independently.
- Treating README.md as the full usage reference.
```

## 6. Git Workflow

- Branch naming: no package convention is defined; follow the workspace `CONTRIBUTING.md`.
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), which
  the workspace `CONTRIBUTING.md` requires for pull requests.
- Keep commits focused and reversible.
- Rebase on the target branch before opening a pull request.

PR checklist:

- What changed and why.
- Tests run and results.
- Risk and impact on applications that call `webex.people` and on `@webex/common`,
  `@webex/plugin-meetings`, and `@webex/calling`.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies, or removing a declared one (including the unused `@webex/internal-plugin-mercury`).
- Renaming or removing a method, the `batcher` child, or the registered plugin name.
- Changing a request path or query, the id format, the fingerprints, the batcher timings, or
  `showAllTypes`.
- Changing what `get` or `list` resolves or how a not-found id is reported.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log person ids, emails, or display names.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
