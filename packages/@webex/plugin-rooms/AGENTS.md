<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T17:06:43Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/plugin-rooms`, the public `rooms` plugin of the SDK (it creates,
reads, lists, updates, and deletes Webex rooms, reports their read status, and emits room events from
the Mercury socket). This file orients agents. The monorepo root `AGENTS.md` governs workspace-wide
setup.

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
- the module specification at [`src/docs/README.md`](src/docs/README.md) (Rooms plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes a public SDK surface, so its contract artifact is `package.json` plus the `src/index.js`
entry. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run `yarn` and
`yarn prebuild:modules` at the workspace root, and the package scripts below from this package
directory, `packages/@webex/plugin-rooms`, where `package.json` defines them. From the workspace root,
`yarn workspace @webex/plugin-rooms <script>` runs the same script.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; the deploy workflow runs the same command); on a fresh checkout run `yarn prebuild:modules` once, because `yarn` does not build `@webex/legacy-tools` or sibling `dist/` |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | N/A — the package has no unit tests and no `test:unit` script (see below) |
| Run linters            | `yarn test:style` |
| Build/release artifact | `yarn build:src` (JavaScript and source maps to `dist/`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`yarn build` runs `yarn build:src` and produces the same output; the package emits no type
declarations.

Do not use the aggregate `test` script: after lint it calls `test:unit`, which this package does not
define, and exits 1. `yarn test:browser:broken` runs `test/integration/spec` through karma but verifies
nothing today; see [Getting started](docs/getting-started.md#tests) for its state.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/plugin-rooms`.

Primary outcomes:

- Deliver production-safe changes with build and lint passing, and unit tests for what you change.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Build and lint pass locally, and any unit cases you added pass.
3. Updated docs cover new behavior, including the owning module spec.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | node; JavaScript sources | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=18`; the workspace root `package.json` `engines.node` reads `18.x` |
| Build tool       | yarn workspaces and `@webex/legacy-tools` over babel | yarn `3.4.1` (root `packageManager`), `@babel/core` `^7.17.10` |
| Test framework   | None runs: no unit spec; the integration spec uses mocha-style `describe` with sinon, `@webex/test-helper-chai`, and `@webex/test-helper-test-users` under karma | — |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: imports the conversation and Mercury internal plugins, registers public plugin
  `rooms`, and exports `Rooms` (default only).
- `src/rooms.js`: `Rooms` — `create`, `get`, `list`, `update`, `remove`, `listWithReadStatus`,
  `getWithReadStatus`, `listen`, the private event handlers, and the read-status helpers.
- `test/integration/spec/rooms.js`: live-service cases that no script runs today.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only; it shows only `get(id)` and the scopes `listen()`
  needs; see [ADR-0001](docs/adr/0001-retain-product-readme.md).
- Spec for every file under `src/`: `src/docs/README.md`.

### Critical Constraints

- The plugin is `webex.rooms`; `webex` and `webex-node` register it by import, and applications and
  the workspace samples call it.
- Importing the package must keep registering `webex.internal.conversation` and
  `webex.internal.mercury`, which the read-status methods and `listen()` use (`MOD-001` in the module
  spec).
- Events are `created` and `updated`, built from a deep clone of the stored envelope, and only for the
  verbs `create`, `update`, `lock`, and `unlock` (`INV-004`, `INV-005`).
- Read-status and event ids must stay Hydra ids built with the conversation's cluster (`INV-003`).
- `getRoomEvent` must keep catching every error; a throw would reach Mercury's listener chain.

## 4. Testing Workflow

Run checks in this order, from the package directory:

1. `yarn build:src`
2. `yarn test:style`

Run `yarn prebuild:modules` once on a fresh checkout so `webex-legacy-tools` and the sibling packages'
`dist/` exist.

Testing rules:

- The package has no unit tests. When you change behavior, add a `test/unit/spec` file and the
  matching `test:unit` script (`webex-legacy-tools test --unit --runner jest`, as sibling legacy
  packages define it) in the same change; the integration spec does not run, so it does not count as
  coverage.
- Use `@webex/test-helper-mock-webex` with sinon stubs for `webex.request`,
  `webex.internal.conversation`, `webex.internal.services`, and `webex.internal.mercury`, and assert
  with `@webex/test-helper-chai`; use `sinon.useFakeTimers()` for the 14-day `sinceDate`.
- Use `assert.calledOnceWithExactly` for call arguments, and parametrize when more than three cases are
  alike, such as the activity verbs.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets
  `root: true` and extends the legacy config.
- Prefer small functions over large procedural blocks.
- Make error handling explicit; reject argument errors before any request.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Send room requests with this.request({service: 'hydra', resource: 'rooms/...'}).
- Build ids with the @webex/common Hydra helpers and getHydraClusterString.
- Clone this.eventEnvelope before filling an event; return null from getRoomEvent on error.

Avoid:
- Building Hydra ids by hand or with a fixed cluster.
- Throwing from the Mercury event handlers.
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
- Risk and impact on applications that call `webex.rooms` or listen for its events, and on the
  `webex` and `webex-node` bundles.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding or removing dependencies or peer dependencies.
- Renaming or removing a method, an event, or the registered plugin name.
- Changing a request path, the read-status fields, the event fields, or the `maxRecent` rules.
- Fixing the recorded `maxRecent`, `title`, or repeated-`listen()` behavior, since callers may rely on
  it.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log room titles, room ids, or person ids through `webex.logger`.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
