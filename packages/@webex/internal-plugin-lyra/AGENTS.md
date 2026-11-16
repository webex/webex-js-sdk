<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T15:15:46Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-lyra`, the internal `lyra` plugin of the SDK (it
finds Lyra spaces from ultrasound tokens, joins and leaves them, binds conversations to them, and
drives their room device's audio). This file orients agents. The monorepo root `AGENTS.md` governs
workspace-wide setup.

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
- the module specification at [`src/docs/README.md`](src/docs/README.md) (Lyra plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an internal SDK surface, so its contract artifact is `package.json` plus the `src/index.js`
entry. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run `yarn` and
`yarn prebuild:modules` at the workspace root, and the package scripts below from this package
directory, `packages/@webex/internal-plugin-lyra`, where `package.json` defines them. From the workspace root, `yarn workspace @webex/internal-plugin-lyra <script>` runs the same script.

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

Do not use the aggregate `test` script: it calls `test:integration`, which this package does not
define. `test:browser` runs the live-service specs in `test/integration/spec` through karma; see
[Getting started](docs/getting-started.md#tests) for its state.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/internal-plugin-lyra`.

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

- `src/index.js`: imports the mercury, encryption, conversation, and feature plugins, registers
  internal plugin `lyra` with its config, and exports `Lyra` (default) and `config`.
- `src/lyra.js`: `Lyra`, its `space` and `device` children, and `getAdvertisedEndpoint`.
- `src/space.js`: `Space` — `list`, `get`, `join`, `leave`, `verifyOccupant`, `getCurrentBindings`,
  `bindConversation`, `unbindConversation`, `deleteBinding`, and the `_bindConversation` stub.
- `src/device.js`: `Device` — audio state, mute, and volume.
- `src/config.js`: the empty `config.lyra` block.
- `test/unit/spec/`: unit cases (`lyra.js`, `space.js`, `device.js`) run by `test:unit`.
- `test/integration/spec/`: live-service cases (`space.js`, `device.js`) run only by `test:browser`.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only; its Usage block is a placeholder; see
  [ADR-0001](docs/adr/0001-retain-product-readme.md).
- Spec for every file under `src/`: `src/docs/README.md`.

### Critical Constraints

- The plugin is `webex.internal.lyra`, with children `space` and `device`;
  `@webex/plugin-device-manager` calls them and `@webex/recipe-private-web-client` registers them.
- `join`, `leave`, `bindConversation`, and `unbindConversation` need a `space.url` relative to the
  Lyra service (`/spaces/<id>`); the other space methods and every device method need the absolute
  URL (`INV-001` in the module spec).
- KMS messages sent in a query string must be wrapped with `kms.prepareRequest` first (`INV-003`).
- Which methods resolve the response body and which the whole response is part of the contract.

## 4. Testing Workflow

Run checks in this order, from the package directory:

1. `yarn build:src`
2. `yarn test:unit`
3. `yarn test:style`

Run `yarn prebuild:modules` once on a fresh checkout so `webex-legacy-tools` and the sibling packages'
`dist/` exist.

Testing rules:

- Add or update cases in `test/unit/spec/lyra.js`, `test/unit/spec/space.js`, or
  `test/unit/spec/device.js` for every behavior you change.
- Use `@webex/test-helper-mock-webex` with sinon stubs for `webex.request` and the encryption plugin,
  and assert with `@webex/test-helper-chai`.
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
- Guard required fields with Promise.reject(new Error('<field> is required')) before any request.
- Send one request per method through this.webex.request.
- Leave a body kmsMessage as an object for the encryption plugin's outbound transform.

Avoid:
- Deriving a space URL inside a method that takes space.url from the caller.
- Putting an unwrapped KMS message in a query string.
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
- Risk and impact on `@webex/plugin-device-manager` and first-party clients that call
  `webex.internal.lyra`.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies, or removing a declared one.
- Renaming or removing a method, a child, or the registered plugin name.
- Changing a request path, a query string, a body, a KMS message, or the `space.url` form a method
  expects.
- Changing whether a method resolves the body or the whole response.
- Enabling the capabilities call in `_bindConversation`.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log ultrasound tokens, proofs, device URLs, or KMS messages.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
