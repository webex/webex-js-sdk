<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T13:37:51Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/plugin-presence`, the public `presence` plugin of the SDK,
written in TypeScript (it reads, subscribes to, and sets user presence on the presence service,
switches the presence feature toggle, and runs an optional worker that keeps shown users' presence
current). This file orients agents. The monorepo root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, types, event names, or resource paths. Verify them from
  this package's source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (Presence plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes a public SDK surface, so its contract artifact is `package.json` plus the `src/index.ts`
entry and the types in `src/interface.ts`. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; the deploy workflow runs the same command); on a fresh checkout run `yarn prebuild:modules` once, because `yarn` does not build `@webex/legacy-tools` or sibling `dist/` |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/plugin-presence test:unit` (after `build:src`; the specs import the package by name, so they test `dist/`) |
| Run linters            | `yarn workspace @webex/plugin-presence test:style` |
| Build/release artifact | `yarn workspace @webex/plugin-presence build:src` (JavaScript and source maps to `dist/`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`yarn workspace @webex/plugin-presence build` also runs `tsc` and writes the declarations under
`dist/types/` that `package.json` `types` names; run it whenever you change a type or a method
signature. `yarn workspace @webex/plugin-presence build:docs` regenerates the typedoc pages in the
workspace `docs/presence/` folder.

Do not use the aggregate `test` script: it calls `test:integration` and `test:browser`, which this
package does not define. The live-service spec in `test/integration/spec/presence.ts` is skipped and
no script runs it. See [Getting started](docs/getting-started.md#tests) for the current state of
`test:style` in a checkout with a broken package-local `node_modules`.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/plugin-presence`.

Primary outcomes:

- Deliver production-safe changes with build, unit tests, and lint passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs, types, and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Build, unit tests, and lint pass locally.
3. Updated docs cover new behavior, including the owning module spec.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | node; TypeScript sources | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=18`; the workspace root `package.json` `engines.node` reads `18.x` |
| Build tool       | yarn workspaces and `@webex/legacy-tools` over babel; `tsc` for declarations; typedoc for API pages | yarn `3.4.1` (root `packageManager`), `@babel/core` `7.17.10`, typedoc `0.23.26` |
| Test framework   | jest through `webex-legacy-tools` and `@webex/jest-config-legacy`, with sinon, `@webex/test-helper-chai`, and `@webex/test-helper-mock-webex` | sinon `9.2.4` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `8.24.0`, prettier `2.7.1` |

### Project Map

- `src/index.ts`: imports the device plugin, registers public plugin `presence` with its inbound
  transform and config, and default-exports `Presence`.
- `src/presence.ts`: `Presence`, with the feature toggle, the presence service requests, `emitEvent`,
  and the worker entry points. Spec: `src/docs/README.md`.
- `src/presence-batcher.ts`: `PresenceBatcher`, which batches `list` lookups.
- `src/presence-worker.ts`: `PresenceWorker`, the watch, fetch, subscribe, renew, and expiry upkeep.
- `src/interface.ts`: the TypeScript types and the typedoc entry.
- `src/constants.ts`: worker timings, event names, and envelope types.
- `src/config.ts`: `config.presence` batcher defaults.
- `test/unit/spec/presence.ts`, `test/unit/spec/presence-worker.ts`: unit cases, all running.
- `test/integration/spec/presence.ts`: live-service cases, skipped.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only; its Usage block is a placeholder; see
  [ADR-0001](docs/adr/0001-retain-product-readme.md).

### Critical Constraints

- The plugin is `webex.presence`; applications listen to its `updated` event and switch on the
  envelope `type` (`subscription`, `presence`, `delete`).
- `subscribe` must keep at most 50 subjects per request, and `setStatus` must leave out `label` only
  for `dnd`.
- The worker keeps times and counts only; presence objects belong to the client.
- The inbound transform runs on every SDK response; keep its predicate narrow.
- `src/interface.ts` is the published type surface; change it with the code it describes.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/plugin-presence build:src`
2. `yarn workspace @webex/plugin-presence test:unit`
3. `yarn workspace @webex/plugin-presence test:style`

Run `yarn prebuild:modules` once on a fresh checkout so `webex-legacy-tools` and the sibling packages'
`dist/` exist.

Testing rules:

- Add or update cases in `test/unit/spec/presence.ts` or `test/unit/spec/presence-worker.ts` for every
  behavior you change. `@webex/test-helper-mock-webex` mounts a child named `presence` at
  `webex.presence`, which is where these cases call it.
- Use sinon stubs for `webex.request`, `webex.internal.mercury`, and `webex.internal.feature`, and
  assert with `@webex/test-helper-chai`.
- Use `sinon.useFakeTimers()` for the worker's debounce and interval, `assert.calledOnceWithExactly`
  for call arguments, and parametrize when more than three cases are alike.
- Stub `presence.list` in any case that calls `enqueue`, or the real debounced fetch runs after the
  case ends.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets
  `root: true` and extends the legacy config.
- Prefer small functions over large procedural blocks.
- Make error handling explicit; keep argument failures as rejected promises.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Report a new worker change through emitEvent(PRESENCE_UPDATE, {type: ENVELOPE_TYPE.<type>, payload}).
- Put a new timing in src/constants.ts and reference it from the worker.
- Add a new method to IPresence in src/interface.ts in the same change.

Avoid:
- Storing presence objects in the worker.
- Starting another interval or Mercury listener without a way to stop it.
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
- Risk and impact on applications that call `webex.presence`, handle its `updated` event, or compile
  against its types.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies, including declaring `@webex/internal-plugin-feature`.
- Renaming or removing a method, a type, the `updated` event, an envelope type, a config default, or
  the registered plugin name.
- Changing a resource, a request body, the subscribe batch size, or a worker timing.
- Changing or widening the inbound transform.
- Changing behavior that `@webex/internal-plugin-presence` duplicates; say whether it must change too.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log presence data, statuses, or user ids.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
