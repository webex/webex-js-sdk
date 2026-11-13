<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T03:13:49Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/plugin-device-manager`, the public `devicemanager` plugin of the
SDK (it lists the user's room devices and Lyra spaces, pairs with one by PIN, binds a conversation to
it, and controls its audio). This file orients agents. The monorepo root `AGENTS.md` governs
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
- the module specification at [`src/docs/README.md`](src/docs/README.md) (Device Manager plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes a public SDK surface, so its contract artifact is `package.json` plus the `src/index.js`
entry. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run `yarn` and
`yarn prebuild:modules` at the workspace root, and the package scripts below from this package
directory, `packages/@webex/plugin-device-manager`, where `package.json` defines them. From the
workspace root, `yarn workspace @webex/plugin-device-manager <script>` runs the same script.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; the deploy workflow runs the same command); on a fresh checkout run `yarn prebuild:modules` once, because `yarn` does not build `@webex/legacy-tools` or sibling `dist/` |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn test:unit` |
| Run linters            | `yarn test:style` |
| Build/release artifact | `yarn build:src` (JavaScript and source maps to `dist/`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`yarn build` runs `yarn build:src` and produces the same output; the package emits no type
declarations.

Do not use the aggregate `test` script: after lint and unit tests it calls `test:integration`, which
this package does not define, and exits 1. `yarn test:browser` exits 0 without running anything,
because the package has no `test/integration` directory; see
[Getting started](docs/getting-started.md#tests).

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/plugin-device-manager`.

Primary outcomes:

- Deliver production-safe changes with build, lint, and unit tests passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Build, lint, and unit tests pass locally.
3. Updated docs cover new behavior, including the owning module spec.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | node; JavaScript sources | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=16`; the workspace root `package.json` `engines.node` reads `18.x` |
| Build tool       | yarn workspaces and `@webex/legacy-tools` over babel | yarn `3.4.1` (root `packageManager`), `@babel/core` `^7.17.10` |
| Test framework   | jest through `webex-legacy-tools test --unit --runner jest`, with sinon and `@webex/test-helper-chai` | `@webex/jest-config-legacy` (`workspace:*`) |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: imports the device plugin, registers public plugin `devicemanager` with config
  `{}`, and exports `DeviceManager` (default) and `config`.
- `src/device-manager.js`: `DeviceManager` — recent devices, search, PIN pairing, binding, audio, the
  `lyra.space_updated` handler, and name decryption.
- `src/collection.js`: `DeviceCollection`, the device list shared by every instance in the process.
- `src/constants.js`, `src/config.js`: constants and the empty plugin config.
- `test/unit/spec/index.js`: unit cases for `getPairedDevice` and the paired-method accessors.
- `webex.js`, `sample/`: a browser harness and page for manual trials; nothing builds or runs them.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only; its sample script and chained usage do not run; see
  [ADR-0001](docs/adr/0001-retain-product-readme.md).
- Spec for every file under `src/`: `src/docs/README.md`.

### Critical Constraints

- The plugin is `webex.devicemanager`; `webex` and `webex-node` register it by import (`MOD-001` in
  the module spec).
- `unpair`, the binding methods, and every audio method except `putAudioState` need a paired device
  and reject without one; `putAudioState` sends the caller's space with no guard (`INV-001`).
- Audio failures reject unlogged; `refresh` logs a failure and resolves `undefined` (`INV-006`).
- Only `upsert` sets the paired device, always from the pending PIN device (`INV-003`); `pair` relies
  on this.
- The device list is one object per loaded module, shared by every instance (`INV-004`).
- Lyra join, leave, and binding calls take relative `/spaces/<id>` URLs (`INV-005`).

## 4. Testing Workflow

Run checks in this order, from the package directory:

1. `yarn build:src`
2. `yarn test:unit`
3. `yarn test:style`

Run `yarn prebuild:modules` once on a fresh checkout so `webex-legacy-tools` and the sibling packages'
`dist/` exist.

Testing rules:

- Add or update tests in `test/unit/spec` for every behavior change; most methods have no unit case
  today, so pin current behavior first.
- Use sinon stubs for `webex.request`, `webex.internal.lyra`, `webex.internal.search`,
  `webex.internal.encryption`, and `webex.internal.services`, and a stub `internal.mercury.on`, as the
  existing spec does; assert with `@webex/test-helper-chai`.
- Use `assert.calledOnceWithExactly` for request and Lyra arguments, and parametrize when more than
  three cases are alike, such as the pairing guards of the six guarded audio methods.
- `DeviceCollection` is shared module state: restore or reset it between cases.
- Cover failure paths and edge cases, not only happy paths, such as a wrong PIN and a failed refresh.
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
- In the fifteen guarded methods (INV-006), guard at the top: this.logger.error('DeviceManager#mute: ...') and return Promise.reject(new Error(same message)).
- Build Lyra spaces as {url: `/spaces/${id}`, id} for join, leave, and bindings.
- Resolve ids with device.id || (device.identity && device.identity.id).

Avoid:
- Calling Lyra or WDM URLs directly instead of going through webex.internal.lyra or webex.request with api 'wdm'.
- Changing pairing state anywhere other than requestPin, upsert, bindSpace, unbindSpace, and the Mercury handler.
- Copying the README usage chain, which calls methods on getAll()'s array.
- Adding guards, log lines, or rejections to getAll, refresh, putAudioState, or the paired-device and paired-method accessors.
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
- Risk and impact on applications that call `webex.devicemanager`, and on the `webex` and
  `webex-node` bundles.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding or removing dependencies, including declaring the mercury and encryption plugins the code
  already uses.
- Renaming or removing a method, an option, or the registered plugin name.
- Changing the pairing transitions, including the recorded `upsert`, `unpair`, and Mercury-handler
  behavior, since callers may rely on it.
- Making the device list per instance, or changing what `refresh` stores or resolves.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log PINs, decrypted device names, KMS key URLs, ultrasound tokens, or search queries through
  `webex.logger`.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
