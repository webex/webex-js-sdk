<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T17:50:02Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/plugin-team-memberships`, the public `teamMemberships` plugin of
the SDK (it adds people to Webex teams and reads, lists, updates, and removes their team memberships).
This file orients agents. The monorepo root `AGENTS.md` governs workspace-wide setup.

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
- the module specification at [`src/docs/README.md`](src/docs/README.md) (Team Memberships plugin);
  and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes a public SDK surface, so its contract artifact is `package.json` plus the `src/index.js`
entry. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run `yarn` and
`yarn prebuild:modules` at the workspace root, and the package scripts below from this package
directory, `packages/@webex/plugin-team-memberships`, where `package.json` defines them. From the
workspace root, `yarn workspace @webex/plugin-team-memberships <script>` runs the same script.

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
define, and exits 1. `yarn test:browser` runs `test/integration/spec` through karma but verifies
nothing today; see [Getting started](docs/getting-started.md#tests) for its state.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/plugin-team-memberships`.

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

- `src/index.js`: registers public plugin `teamMemberships` and exports `TeamMemberships` (default
  only).
- `src/team-memberships.js`: `TeamMemberships` — `create`, `get`, `list`, `update`, and `remove` — and
  the `TeamMembershipObject` typedef.
- `test/integration/spec/team-memberships.js`: live-service cases that no script runs today.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only; its Usage example is not valid JavaScript; see
  [ADR-0001](docs/adr/0001-retain-product-readme.md).
- Spec for every file under `src/`: `src/docs/README.md`.

### Critical Constraints

- The plugin is `webex.teamMemberships`; `webex` and `webex-node` register it by import, and the
  `webex` integration spec checks the property (`MOD-001` in the module spec).
- Every request goes to service `hydra`, resource `team/memberships`, through `this.request`
  (`INV-001`).
- `get`, `update`, and `remove` take a membership object or its id (`INV-002`); `remove` resolves
  `undefined` on 204 (`INV-003`).
- The caller's object is sent unchanged and the service's answer returned unchanged (`INV-004`).

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
- Use `@webex/test-helper-mock-webex` with a sinon stub for `webex.request`, and assert with
  `@webex/test-helper-chai`.
- Use `assert.calledOnceWithExactly` for the request options, and parametrize when more than three
  cases are alike, such as the object-or-id argument of `get`, `update`, and `remove`.
- Cover failure paths and edge cases, not only happy paths, such as the 204 branch and a missing
  argument.
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
- Send requests with this.request({service: 'hydra', resource: 'team/memberships/...'}).
- Resolve the id with membership.id || membership in methods that take a membership or an id.
- Return a webex-core Page from list.

Avoid:
- Building full Hydra URLs by hand instead of naming the service.
- Rewriting or validating the caller's membership object without a change request.
- Copying the README usage example, which uses a name the plugin is not registered under.
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
- Risk and impact on applications that call `webex.teamMemberships`, and on the `webex` and
  `webex-node` bundles.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding or removing dependencies or peer dependencies.
- Renaming or removing a method or the registered plugin name.
- Changing a request path, the id rule, or the 204 handling.
- Fixing the recorded missing-argument throw or the string body of `update`, since callers may rely on
  the current behavior.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log person emails, person ids, or team ids through `webex.logger`.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
