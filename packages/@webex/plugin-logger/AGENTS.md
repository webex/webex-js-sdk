<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-06T10:57:01Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/plugin-logger`. This file orients agents. The monorepo root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, config keys, or log formats. Verify them from this package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` barrel. No OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn install` (workspace root) |
| Start dev environment  | N/A — library package with no start script |
| Run tests              | `yarn workspace @webex/plugin-logger test:unit` (jest); `yarn workspace @webex/plugin-logger test:browser` (karma) |
| Run linters            | `yarn workspace @webex/plugin-logger test:style` |
| Build/release artifact | `yarn workspace @webex/plugin-logger build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`package.json` `scripts.test` chains `test:style`, `test:unit`, `test:integration`, and `test:browser`. `test:integration` is not defined, so that aggregate script is not a verification command.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web SDK engineering assistant for `@webex/plugin-logger`.

Primary outcomes:

- Deliver production-safe changes with unit tests and lint passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests, lint, and build checks pass locally.
3. Updated docs cover new behavior, including [`src/docs/README.md`](src/docs/README.md).
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | node | `>=18` (`package.json` engines) |
| Build tool       | `@webex/legacy-tools` over babel | `@babel/core` `^7.17.10` |
| Test framework   | jest via `@webex/jest-config-legacy`; karma via `test:browser`; chai, sinon, and `@webex/test-helper-mock-webex` | sinon `^9.2.4` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: registers the plugin with `replace: true` and re-exports `default` and `levels`.
- `src/logger.js`: the `Logger` plugin, level methods, redaction, buffers, and `formatLogs`.
- `src/config.js`: default `logger.level` and `logger.historyLength`.
- `src/docs/README.md`: the canonical module specification.
- `test/unit/spec/logger.js`: the unit spec.
- `dist/`: generated build output. Never edit by hand.
- `docs/`: package standing documentation.
- `README.md`: retained product readme. It is not the behavioral authority.

### Critical Constraints

- Everything printed or buffered must pass through `Logger#filter` first. Do not add an output path that skips it.
- `formatLogs`, `updateLastSubmittedIndex`, and `resetBufferToLastSuccessfulUpload` are used by `@webex/internal-plugin-support` for log upload.
- The buffer entry layout `[indent, isoTimestamp, name, ...values]` is read by `formatLogs` and by the unit spec.
- `replace: true` in `src/index.js` is required to override the fallback logger in `@webex/webex-core`.
- Log methods must not throw to callers.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/plugin-logger test:unit`
2. `yarn workspace @webex/plugin-logger test:style`
3. `yarn workspace @webex/plugin-logger test:browser` when a karma browser is available. No integration tier is defined.

Testing rules:

- Add or update unit cases for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Several cases are `nodeOnly` or `browserOnly`. Check which runner executes a case before relying on it.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`.
- Prefer small functions over large procedural blocks.
- Add log levels through `levels` and `makeLoggerMethod` so the `client_` twin is generated.
- Keep public interfaces stable unless a breaking change is requested.
- Before adding a config key, check the keys already read in `src/logger.js`.

Pattern example:

```text
Preferred:
- Read this.config inside the generated method on each call.
- Redact a deep clone so the caller's object is untouched.
- Add a unit case next to the matching describe block in test/unit/spec/logger.js.

Avoid:
- Calling console directly from new code in this package.
- Changing the position of the timestamp in a buffer entry.
- Treating README.md as the list of supported levels or config keys.
```

## 6. Git Workflow

- Branch naming: `[feature|fix|chore]/[short-description]`
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Keep commits focused and reversible.
- Rebase on the target branch before opening a pull request.

PR checklist:

- What changed and why.
- Tests run and results.
- Risk and impact, including `@webex/internal-plugin-support` when buffer or format behavior changes.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update [`src/docs/README.md`](src/docs/README.md) in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Changing redaction rules, the buffer threshold default, or the default level.
- Changing the buffer entry layout or `formatLogs` output.
- Removing or renaming a level method, export, or config key.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log raw arguments without redaction.
- Create a package-level `.sdd/templates` directory, copy, or symlink. Use the repository-root `.sdd/templates/repo-standards` snapshot.
