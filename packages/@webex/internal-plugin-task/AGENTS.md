<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-09T14:40:25Z
validation_status: pending
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-task`, the plugin that wraps the Raindrop task
service for the Webex JS SDK. This file orients agents. The monorepo root `AGENTS.md` governs
workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, request shapes, or event names. Verify them from this
  package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (Task plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` barrel.
It calls the Raindrop task HTTP API but serves none, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn install` (workspace root) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/internal-plugin-task test:unit` (Jest); `yarn workspace @webex/internal-plugin-task test:integration` (mocha); `yarn workspace @webex/internal-plugin-task test:browser` (karma) |
| Run linters            | `yarn workspace @webex/internal-plugin-task test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-task build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

Use the individual scripts rather than the aggregate `test` script, and run the first-run build
before `test:unit`; both are explained in [`docs/getting-started.md`](docs/getting-started.md).

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web SDK engineering assistant for `@webex/internal-plugin-task`.

Primary outcomes:

- Deliver production-safe changes with unit tests and lint passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests, lint, and build checks pass locally.
3. Updated docs cover new behavior, including the module spec.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | node | 22.14 for development (workspace root `AGENTS.md`); `>=18` for consumers (`package.json` engines) |
| Package manager  | Yarn through Corepack | Pinned by the workspace root `packageManager` field |
| Build tool       | `@webex/legacy-tools` over babel | `@babel/core` `^7.17.10` |
| Test framework   | Jest via `webex-legacy-tools` (`test:unit`); mocha (`test:integration`); karma (`test:browser`) | workspace versions; `sinon` `^9.2.4` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: imports the device, encryption, and conversation plugins, registers internal
  plugin `task`, and re-exports `Task` as default.
- `src/task.js`: the `Task` plugin. Spec: `src/docs/README.md`.
- `src/helpers/`: title and notes encryption and decryption.
- `src/constants.js`: the two plugin event names. `src/config.js`: the empty plugin config.
- `test/unit/spec/`: Jest specs for the plugin and helpers.
- `test/integration/spec/task.js`: a mocha spec over its own mock; it does not import the plugin.
- Build output from `build:src`: generated. Never edit by hand.
- `README.md`: retained product readme. It is not the behavioral authority.

### Critical Constraints

- Task `title` and `notes` must be encrypted before any request that carries them, as the module
  spec invariants `INV-001` and `INV-002` define, and decrypted in every task-bearing response
  (`INV-003`).
- REST methods resolve the whole response (`INV-004`); do not switch one to the body alone.
- Requests stay on catalog service `raindrop` (`INV-006`).
- Known defects, such as `createTask` and `updateTask` changing the caller's object and the empty
  event hooks, are recorded in the module spec Pitfalls. Fix them only in a dedicated change with a
  test.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-task build:src`
2. `yarn workspace @webex/internal-plugin-task test:unit`
3. `yarn workspace @webex/internal-plugin-task test:style`

Rebuild before the unit run after any `src/` change; [`docs/getting-started.md`](docs/getting-started.md)
under Tests explains why.

The browser run is recorded in `.sdd/manifest.json` as `commands.browser-test` (role `other`), not
under `tests`, because the SDD manifest `tests` schema allows only `unit`, `integration`, `e2e`, and
`qa`. Tier details are in [`docs/getting-started.md`](docs/getting-started.md) under Tests.

Testing rules:

- Add or update unit cases for every behavior change.
- Assert encrypted request bodies against a copy of the input, because the helpers change the
  object they receive.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`.
- Prefer small, composable functions over large procedural blocks.
- Make error handling explicit at system boundaries.
- Keep public interfaces stable unless a breaking change is requested.
- Before adding a literal path, command, status, or other policy value, search the package for
  existing uses; event names already live in `src/constants.js`.
- Do not import a binding and immediately re-export it; the barrel should use direct re-exports.
- Do not write inline runtime `typeof` checks outside descriptively named guard implementations.

Pattern example:

```text
Preferred:
- Build a new REST method as encryptTaskRequest, then this.request, then the decrypt helper,
  then resolve the response.

Avoid:
- Resolving response.body instead of the response.
- Logging title or notes.
```

## 6. Git Workflow

- Branch naming: no convention is defined in this package or in the workspace `CONTRIBUTING.md`.
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), which
  the workspace `CONTRIBUTING.md` requires for pull requests.
- Keep commits focused and reversible.
- Rebase on the target branch before opening a pull request.

PR checklist:

- What changed and why.
- Tests run and results.
- Risk and impact, including encrypted-field handling and the sibling package webex, which loads
  this plugin.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies or external services, including declaring the Mercury plugin.
- Large refactors or schema migrations.
- Security-sensitive changes (auth, encryption, secrets handling), including which fields are
  encrypted or how the key is chosen.
- Any destructive data or infrastructure operation.
- Changing an export, the plugin name, or an event name.
- Implementing the task event hooks.

### Never

- Edit build output by hand.
- Commit secrets, tokens, keys, or credentials, including in test fixtures.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
- Copy template bodies or `template-map.json` into this package, or replace the
  `.sdd/templates/repo-standards` symlink with a real directory. It points at the repository-root
  `.sdd/templates/repo-standards` snapshot, which is the only template source.
