<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-09T08:55:22Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-locus`, the plugin that wraps the Locus call
and meeting state service for the Webex JS SDK. This file orients agents. The monorepo root
`AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, request bodies, or sequence rules. Verify them from this
  package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (Locus plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` barrel.
It calls the Locus and Janus HTTP APIs but serves none, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn install` (workspace root) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/internal-plugin-locus test:unit` (Jest); `yarn workspace @webex/internal-plugin-locus test:browser` (karma) |
| Run linters            | `yarn workspace @webex/internal-plugin-locus test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-locus build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

The `package.json` script `test` chains `test:style`, `test:unit`, `test:integration`, and
`test:browser`. `test:integration` is not defined, so that aggregate script is not a verification
command. `test:browser` starts the karma integration runner, but this package has no integration
specs.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web SDK engineering assistant for `@webex/internal-plugin-locus`.

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
| Build tool       | `@webex/legacy-tools` over babel | `@babel/core` `^7.17.10` |
| Test framework   | Jest via `webex-legacy-tools` (`test:unit`); karma via `test:browser`; chai and `@webex/test-helper-mock-webex` | workspace versions |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: imports the Mercury plugin, registers internal plugin `locus`, and re-exports
  `Locus`, `eventKeys`, and seven sequence constants.
- `src/locus.js`: the `Locus` plugin. Spec: `src/docs/README.md`.
- `src/event-keys.js`: the list of Locus event names.
- `test/unit/spec/locus.js`: the only unit spec; it expands the JSON fixtures into test cases.
- `test/unit/lib/BasicSeqCmp.json` and `test/unit/lib/SeqCmp.json`: sequence fixtures.
- Build output from `build:src`: generated. Never edit by hand.
- `README.md`: retained product readme. It is not the behavioral authority.

### Critical Constraints

- The sequence comparison must keep every fixture result in `test/unit/lib`; callers decide whether
  to apply, ignore, or fetch a Locus from it.
- `compare` and `merge` are pure. Do not add plugin state.
- Request bodies carry the device URL and the caller's sequence as the module spec invariant
  `INV-007` lists; the device plugin is reached only through the Mercury import.
- `localSdp` is sent as a JSON string, not an object.
- Known defects, such as `merge` throwing on a delta without `participants`, are recorded in the
  module spec Pitfalls. Fix them only in a dedicated change with a test.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-locus test:unit`
2. `yarn workspace @webex/internal-plugin-locus test:style`

The browser run is recorded in `.sdd/manifest.json` as `commands.browser-test` (role `other`), not
under `tests`, because the SDD manifest `tests` schema allows only `unit`, `integration`, `e2e`, and
`qa`. No `integration` tier is recorded because `package.json` defines no integration command and
no integration specs exist.

Testing rules:

- Add or update unit cases for every behavior change.
- Add sequencing cases as fixture entries in `test/unit/lib`, not as hand-written assertions.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`.
- Prefer small functions over large procedural blocks.
- Keep REST wrappers thin: build the request, call `this.request`, resolve the body.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Resolve res.body or the documented field from a REST wrapper.
- Recover a 409 Conflict by returning the current Locus only where decline and leave already do.

Avoid:
- Returning the raw response, as sendDtmf does.
- Treating README.md as the method list.
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
- Risk and impact, including callers that apply Locus DTOs and internal-plugin-lyra.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies, including declaring the device plugin.
- Changing a sequence comparison branch, a constant value, or a request body.
- Changing an export, the plugin name, or `eventKeys`.
- Changing how a 409 Conflict is handled.

### Never

- Edit build output by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Copy template bodies or `template-map.json` into this package, or replace the
  `.sdd/templates/repo-standards` symlink with a real directory. It points at the repository-root
  `.sdd/templates/repo-standards` snapshot, which is the only template source.
