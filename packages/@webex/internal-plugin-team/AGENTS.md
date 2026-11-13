<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T14:15:30Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-team`, the internal `team` plugin of the SDK (it
creates, reads, and changes teams on the conversation service and registers the transforms that keep
team names and summaries encrypted). This file orients agents. The monorepo root `AGENTS.md` governs
workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, transform names, or resource paths. Verify them from this
  package's source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (Team plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an internal SDK surface, so its contract artifact is `package.json` plus the `src/index.js`
entry. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; the deploy workflow runs the same command); on a fresh checkout run `yarn prebuild:modules` once, because `yarn` does not build `@webex/legacy-tools` or sibling `dist/` |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/internal-plugin-team test:unit` (after `build:src`; the spec imports the package by name, so it tests `dist/`) |
| Run linters            | `yarn workspace @webex/internal-plugin-team test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-team build:src` (JavaScript and source maps to `dist/`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`yarn workspace @webex/internal-plugin-team build` runs `yarn build:src` and produces the same output;
the package emits no type declarations.

Do not use the aggregate `test` script: it calls `test:integration`, which this package does not
define. `test:browser` runs the live-service specs in `test/integration/spec` through karma; see
[Getting started](docs/getting-started.md#tests) for its state.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/internal-plugin-team`.

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

- `src/index.js`: imports the conversation, user, and encryption plugins, registers internal plugin
  `team` with its payload transforms and config, and default-exports `Team`.
- `src/team.js`: `Team`, with every public method and the `_ensureGeneralConversation`,
  `_prepareTeam`, `_prepareTeamConversation`, and `_recordUUIDs` helpers. Spec: `src/docs/README.md`.
- `src/config.js`: the empty `config.team` block.
- `test/unit/spec/team.js`: unit cases run by `test:unit`.
- `test/integration/spec/`: live-service cases (`create.js`, `get.js`, `actions.js`, `mercury.js`)
  run only by `test:browser`.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only; its Usage block is a placeholder; see
  [ADR-0001](docs/adr/0001-retain-product-readme.md).

### Critical Constraints

- The plugin is `webex.internal.team`; `@webex/webex-server` and `@webex/recipe-private-web-client`
  register it.
- Team activities must target the general conversation, resolved by `_ensureGeneralConversation`.
- The transform names `decryptTeam`, `encryptTeam`, and `normalizeTeam` are reached by the
  conversation plugin's dispatch on `objectType: 'team'`; renaming one breaks team encryption.
- A team conversation's KMS message must keep the general conversation KRO in `userIds`.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-team build:src`
2. `yarn workspace @webex/internal-plugin-team test:unit`
3. `yarn workspace @webex/internal-plugin-team test:style`

Run `yarn prebuild:modules` once on a fresh checkout so `webex-legacy-tools` and the sibling packages'
`dist/` exist.

Testing rules:

- Add or update cases in `test/unit/spec/team.js` for every behavior you change.
- Use `@webex/test-helper-mock-webex` with sinon stubs for `webex.request` and the conversation and
  user plugins, and assert with `@webex/test-helper-chai`.
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
- Make error handling explicit; reject guard failures before any request.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Resolve the general conversation first, then let webex.internal.conversation prepare and submit.
- Keep field encryption in the transforms of src/index.js.

Avoid:
- Encrypting team fields inside Team methods.
- Posting team activities to the team URL.
- Treating README.md as a usage reference.
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
- Risk and impact on first-party clients that call `webex.internal.team` and on the conversation
  plugin's transform dispatch.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Renaming or removing a method, a transform, or the registered plugin name.
- Changing a resource path, a request body, a KMS message, or the activity target.
- Changing how participants are resolved or ordered.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log team names, summaries, member records, or tokens.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
