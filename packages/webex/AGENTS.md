<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-15T15:50:41Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `webex`, the npm package that assembles Webex JS SDK constructors from
webex-core and the plugin packages. This file orients agents. The monorepo root `AGENTS.md` governs
workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, entry points, or config keys. Verify them from this
  package's source, `package.json`, and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (webex bundle entry points); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface (`package.json` with its `exports` map) and committed UMD bundles under
`umd/`. It serves no HTTP API, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn install` (workspace root) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace webex test:unit` (Jest); `yarn workspace webex test:integration` (Mocha, needs test users) |
| Run linters            | `yarn workspace webex test:style` (`src/`); `yarn workspace webex eslint ./env.js ./browser.js ./process` (package-root helpers `env.js`, `browser.js`, `process`) |
| Build/release artifact | `yarn workspace webex build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

The `package.json` script `test` chains `test:style`, `test:unit`, and `test:integration`. The
karma runner is `yarn workspace webex test:browser:broken`; its script name marks it broken, so it
is not a verification command. The UMD bundles in `umd/` are built by the workspace root webpack
configuration, not by a script of this package.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web SDK engineering assistant for `webex`.

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
| Build tool       | `@webex/legacy-tools` over babel | `@babel/core` `^7.22.11` |
| Test framework   | Jest via `webex-legacy-tools` (`test:unit`); Mocha via `test:integration`; chai and `@webex/test-helper-*` | workspace versions |
| Lint/format      | eslint with the workspace root configuration, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`, `src/webex.js`: main entry and the full `Webex` constructor. Spec: `src/docs/README.md`.
- `src/meetings.js`, `src/calling.js`: the `./meetings` and `./calling` exports.
- `src/encryption.js`, `src/webex-first-party.js`: variant entries with no `exports` entry.
- `src/config.js`, `src/config-storage.js`, `src/config-storage.shim.js`: package config and the
  per-platform storage choice.
- `src/_setup.js`: Mocha test helper kept in `src/`.
- `env.js`, `browser.js`, `process`: package-root helpers.
- `umd/`: committed UMD bundles. Generated. Never edit by hand.
- `test/unit/spec/webex.js`: the only unit spec. `test/integration/spec/`: four Mocha specs.
- Build output from `build:src`: generated. Never edit by hand.
- `README.md`: retained product readme. It is not the behavioral authority.

### Critical Constraints

- Plugins are added by side-effect `require`, and registration is shared by every entry that loads
  the same webex-core copy (module spec invariant `INV-002`). Changing an entry's requires changes what
  instances expose.
- Keep the config merge order of `INV-001` and the polyfill guard of `INV-003`.
- Runtime behavior of an instance belongs to webex-core and the plugin packages; do not add it here.
- Known defects, such as `src/config.js` values not reaching the instance, are recorded in the
  module spec Pitfalls. Fix them only in a dedicated change with a test.

## 4. Testing Workflow

Run checks in this order:

0. After any `src/` change, `yarn workspace webex build:src`. The specs import `webex`, which
   resolves to `dist/index.js`, and the test runner does not rebuild it, so a stale `dist/` can pass.
1. `yarn workspace webex test:unit`
2. `yarn workspace webex test:style` (and `yarn workspace webex eslint ./env.js ./browser.js ./process`
   for package-root helpers)
3. `yarn workspace webex test:integration` when a change touches loading or `init` of the main
   entry, passed the `--targets` option described in the workspace root `AGENTS.md`:
   `yarn workspace webex test:integration --targets commonjs.js` and
   `yarn workspace webex test:integration --targets init.js`. `request.js` is not required while `package.json` has no `version`:
   its user-agent case then expects `webex/undefined` (module spec Pitfalls). Run untargeted, it also runs
   `test/integration/spec/env.js`, which requires the unexported `webex/env` subpath and fails, so
   the whole tier fails (module spec Pitfalls). A change to the main entry's plugin set also needs an
   assertion for the namespace it adds or removes. No existing test loads `src/meetings.js`,
   `src/encryption.js`, `src/webex-first-party.js`, or `src/calling.js`; a change to one of them
   needs a new focused test that loads that entry.

The karma run is recorded in `.sdd/manifest.json` as `commands.browser-test` (role `other`), not
under `tests`, because the SDD manifest `tests` schema has no browser tier. The integration tier needs test-user credentials and network access; see
[Getting started](docs/getting-started.md).

Testing rules:

- Add or update tests for every behavior change; meetings, encryption, first-party, and `Calling`
  have none today.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The package has no eslint config of its
  own; the workspace root configuration applies.
- Keep entry files as CommonJS, except `src/calling.js`.
- Keep public interfaces stable unless a breaking change is requested.
- Declare every package that an entry file requires in `package.json` `dependencies`.

Pattern example:

```text
Preferred:
- Add a plugin by requiring its package in the entry file and declaring the dependency.
- Put runtime behavior in the owning plugin package.

Avoid:
- Reading an ES default export with require and merging the result.
- Treating README.md as the API list.
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
- Risk and impact, including which entry files and UMD bundles change.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the module spec in the same change that alters observable behavior.

### Ask First

- Adding or removing a plugin package from an entry file.
- Changing the `exports` map, the `browser` field, or a UMD library name.
- Changing config defaults or the merge order.
- Security-sensitive changes, including credential handling in `env.js`.

### Never

- Edit build output or `umd/` by hand.
- Commit secrets, tokens, or credentials, including in tests or `.env` files.
- Copy template bodies or `template-map.json` into this package, or commit anything under
  `.sdd/templates/`. This package tracks only `.sdd/manifest.json`. To run the Repo Annotation
  checkers, create a temporary local symlink `.sdd/templates/repo-standards` to the repository-root
  `.sdd/templates/repo-standards` snapshot (the only template source) and never stage it.
