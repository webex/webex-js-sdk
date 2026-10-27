<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-10-22T06:52:30Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-user`, the plugin that resolves users to uuids and
runs the SDK's account flows. This file orients agents. The monorepo root `AGENTS.md` governs
workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, config keys, service URLs, or request fields. Verify them
  from this package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (user plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Workspace-wide setup and conventions are in the monorepo root agent entry:
[`../../../AGENTS.md`](../../../AGENTS.md).

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` entry
point, and its outbound service calls are an internal contract sourced from `src/user.js`. It serves
no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; declared in the root `CONTRIBUTING.md`) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/internal-plugin-user test:unit` (jest) |
| Run linters            | `yarn workspace @webex/internal-plugin-user test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-user build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

The `package.json` script `test` chains `test:style`, `test:unit`, `test:integration`, and
`test:browser`. `test:integration` and `test:browser` are not defined (only `test:browser:broken`
is), so that aggregate script is not a verification command.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web SDK engineering assistant for `@webex/internal-plugin-user`.

Primary outcomes:

- Deliver production-safe changes with unit tests and lint passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests, lint, and build checks pass locally.
3. Updated docs cover new behavior, including the owning module spec.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | node; JavaScript sources | `>=18` (`package.json` engines) |
| Build tool       | `@webex/legacy-tools` over babel | `@babel/core` `^7.17.10` |
| Test framework   | jest via `webex-legacy-tools` (`test:unit`); chai, sinon, and `@webex/test-helper-mock-webex` | sinon `^9.2.4` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

The unit specs use Mocha-style `describe` and `it` blocks, so they need the Jest runner that
`test:unit` selects.

### Project Map

- `src/index.js`: imports the device plugin, registers internal plugin `user`, and re-exports the
  default class.
- `src/user.js`: the `User` plugin, the SCIM helpers, and `SCIM_SCHEMAS`. Spec: `src/docs/README.md`.
- `src/user-uuid-batcher.js`: `UserUUIDBatcher` with the `faker` and `creator` request batchers.
- `src/user-uuid-store.js`: `UserUUIDStore`, the in-memory id and email maps.
- `src/config.js`: `config.user` and `config.device.preDiscoveryServices` defaults.
- `test/unit/spec/user.js`, `test/unit/spec/user-uuid-batcher.js`: the unit specs.
- `test/integration/spec/user.js`: integration spec that needs live services; no supported command
  runs it.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained product readme. It is not the behavioral authority.

### Critical Constraints

- `User` extends `WebexPlugin` and its batchers extend `Batcher` from `webex-core`. Request
  pipeline, retries, token refresh, and storage come from there; change them in `webex-core`, not here.
- A lookup without `create` can resolve an id for an email with no account. Keep the `create` guard in
  `getUUID` and the `faker` and `creator` split together.
- Client credentials and tokens are secrets. Never log them, put them in a URL, or commit them,
  including in test fixtures.
- The uuid store has no removal method and the batcher settles items only from the response body. Do
  not rely on either to clean up; see the module spec Pitfalls and constraints.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-user test:unit`
2. `yarn workspace @webex/internal-plugin-user test:style`

The karma run `test:browser:broken` is recorded in `.sdd/manifest.json` as
`commands.browser-test-broken` (role `other`), not under `tests`, because the SDD manifest `tests`
schema allows only `unit`, `integration`, `e2e`, and `qa`. It is named broken and needs live services.
No `integration` tier is recorded because `package.json` defines no integration command.

Testing rules:

- Add or update unit cases for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Assert request shapes (method, URI, headers, body), not only argument guards.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`.
- Prefer small functions over large procedural blocks.
- Make error handling explicit; reject with an `Error` that names the offending argument, as the
  existing guards do.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Guard arguments first and return Promise.reject(new Error(...)) as the existing methods do.
- Add a case next to the matching describe block in test/unit/spec/user.js.
- Route new lookups through getUUID so they share the cache and the single flight.

Avoid:
- Treating README.md as the list of methods or config keys.
- Adding a second cache beside UserUUIDStore.
- Reimplementing request handling that webex-core already provides.
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
- Risk and impact, including the six consuming packages and `webex-core` base-class changes.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Changing the `create` semantics, the batch limits, or the cache lifetime.
- Changing which credential an account flow sends (client credentials, user token, or client token).
- Security-sensitive changes: token handling, one-time passwords, password changes, or log content.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log client secrets, tokens, passwords, or one-time passwords.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
