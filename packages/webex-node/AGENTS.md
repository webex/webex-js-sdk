<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-15T23:00:24Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `webex-node`, the Node.js build of the Webex JS SDK. This file orients
agents. The monorepo root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, configuration keys, or plugin names. Verify them from this
  package's source and tests, or from the plugin package that owns them.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (webex-node SDK entry); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` entry.
It serves no HTTP API, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root. The workspace name is `webex-node`, with no `@webex/` scope.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn install` (workspace root) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace webex-node test:unit` (Jest) |
| Run linters            | `yarn workspace webex-node test:style` |
| Build/release artifact | `yarn workspace webex-node build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

The `package.json` script `test` chains `test:style` and `test:unit`; run those two commands
separately instead. No integration or browser test script exists.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web SDK engineering assistant for `webex-node`.

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
| Language runtime | node | 22.14 for development (workspace root `AGENTS.md`; the root `.nvmrc` selects the Node 22 LTS line; the root `package.json` `engines.node` still declares `18.x`); `>=18` for consumers (`package.json` engines) |
| Build tool       | `@webex/legacy-tools` over babel | `@babel/core` `^7.22.11` |
| Test framework   | Jest via `webex-legacy-tools` (`test:unit`) | workspace versions |
| Lint/format      | eslint with the workspace root `.eslintrc.js` (which applies prettier through its prettier plugin) | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: package entry; conditional `@babel/polyfill` load and CommonJS re-export.
- `src/webex-node.js`: plugin load list, `WebexNode` class, and `init`. Spec: `src/docs/README.md`.
- `src/config.js` and `src/config-storage.js`: the package configuration object.
- `test/unit/spec/webex-node.test.js`: the only unit spec (5 tests).
- Build output from `build:src`: generated. Never edit by hand.
- `README.md`: retained product readme. It is not the behavioral authority.

### Critical Constraints

- `require('webex-node')` must keep returning the `WebexNode` class itself.
- Plugins are loaded only by side-effect `require` calls placed before `WebexCore.extend`.
- Defined caller configuration passed to `init` wins over package values, with lodash `merge`
  semantics (module spec `INV-001`).
- The values in `src/config.js` are not applied today (module spec `MOD-007`). Fixing this changes
  runtime defaults for every consumer; do it only in a dedicated change with a test.
- Other known defects are recorded in the module spec Pitfalls.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace webex-node test:unit`
2. `yarn workspace webex-node test:style`

Only a `unit` tier is recorded in `.sdd/manifest.json` `tests`; the SDD manifest `tests` schema
allows `unit`, `integration`, `e2e`, and `qa`, and this package defines no other test command.

Testing rules:

- Add or update unit cases for every behavior change.
- Assert top-level configuration values when changing `init` or `src/config.js`.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. Lint uses the workspace root
  `.eslintrc.js`.
- Prefer small functions over large procedural blocks.
- Keep `WebexNode` thin: behavior belongs to webex-core or a plugin.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Add a plugin with a side-effect require before WebexCore.extend and a package.json dependency.
- Pass overrides through init({config}) so they win over package values (see INV-001).

Avoid:
- Adding methods or state to WebexNode.
- Treating README.md as the package API.
```

## 6. Git Workflow

- Branch naming: no convention is defined in this package or in the workspace `CONTRIBUTING.md`.
- Commit format: Conventional Commits, which the workspace `CONTRIBUTING.md` requires for pull
  requests (it names no type list).
- Keep commits focused and reversible.

PR checklist:

- What changed and why.
- Tests run and results.
- Risk and impact, including Node.js applications that rely on the plugin set and `init`.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the module spec in the same change that alters observable behavior.

### Ask First

- Adding or removing a plugin, or changing the load order.
- Changing `init`, the merge order, or `src/config.js` values.
- Adding or removing dependencies.
- Changing the package entry, `exports`, or the CommonJS export.

### Never

- Edit build output by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Copy template bodies or `template-map.json` into this package, or commit anything under
  `.sdd/templates/`. The repository-root `.sdd/templates/repo-standards` snapshot is the only
  template source. The Repo Annotation checkers and validator expect a temporary, uncommitted
  local symlink to it at `.sdd/templates/repo-standards`, which is removed before a PR.
