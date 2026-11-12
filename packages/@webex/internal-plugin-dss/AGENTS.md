<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T10:21:50Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-dss`, the internal `dss` plugin of the SDK (it
looks up and searches people, devices, rooms, and places in the Directory Search Service, sending
each query over HTTP and collecting the results that arrive over mercury). This file orients agents.
The monorepo root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, event names, or resource paths. Verify them from this
  package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (DSS plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an internal SDK surface, so its contract artifact is `package.json` plus the `src/index.ts`
entry. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; the deploy workflow runs the same command); on a fresh checkout run `yarn prebuild:modules` once, because `yarn` does not build `@webex/legacy-tools` or sibling `dist/` |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/internal-plugin-dss test:unit` (jest) |
| Run linters            | `yarn workspace @webex/internal-plugin-dss test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-dss build:src` (JavaScript and source maps to `dist/`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`yarn workspace @webex/internal-plugin-dss build` runs `yarn build:src` and produces the same output;
the package has no `tsconfig.json` and emits no type declarations.

Do not use the aggregate `test` script: it calls `test:integration`, which this package does not
define. `test:browser` runs the mock-based spec in `test/integration/spec/dss.js` through karma; see
[Getting started](docs/getting-started.md#tests) for its state.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/internal-plugin-dss`.

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
| Language runtime | node; TypeScript sources | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=16`; the workspace root `package.json` `engines.node` still reads `18.x`, which conflicts with the other pins |
| Build tool       | yarn workspaces and `@webex/legacy-tools` over babel | yarn `3.4.1` (root `packageManager`), `@babel/core` `^7.17.10` |
| Test framework   | jest via `webex-legacy-tools` (`test:unit`); chai, chai-as-promised, sinon, `@webex/test-helper-mock-webex` | sinon `^9.2.4` |
| Lint/format      | eslint via `@webex/eslint-config-legacy` (TypeScript override), prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.ts`: registers internal plugin `dss` and default-exports `DSS`.
- `src/dss.ts`: `DSS`, where registration, every query method, and result assembly live. Spec:
  `src/docs/README.md`.
- `src/dss-batcher.ts`: `DssBatcher`, the webex-core `Batcher` that combines `lookup` calls per
  resource.
- `src/dss-errors.ts`: `DssTimeoutError`.
- `src/constants.ts`: event names, service name, result paths, and `SEARCH_TYPES`.
- `src/types.ts`: option and result interfaces and the `EntityProviderType` and `SearchType` enums.
- `src/config.ts`: defaults for `requestTimeout` (6000 ms) and the three batcher limits.
- `test/unit/spec/dss.ts`, `test/unit/spec/dss-batcher.ts`: the unit specs (61 cases, 1 skipped);
  `dss.ts` imports the package by name, which loads `dist/`.
- `test/integration/spec/dss.js`: a MockWebex spec run only by `test:browser`.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only and partly stale (it shows `lookup({ids})` and
  `lookupByEmail({emails})`); see [ADR-0001](docs/adr/0001-retain-product-readme.md).

### Critical Constraints

- The plugin is `webex.internal.dss`, and its config is `webex.config.dss`; keep the namespace `DSS`
  so the config lookup still works.
- Results arrive only after `register()`: the HTTP response is ignored, and every result page comes
  over mercury as `event:directory.lookup` or `event:directory.search`.
- A query completes only when pages `0..n` have all arrived and page `n` carries `finished`; keep
  the `requestId`, `sequence`, and `finished` handling in `_request` intact.
- `requestTimeout` is an inactivity timeout reset by each page; the rejection is `DssTimeoutError`.
- `lookup` is batched by default through one `DssBatcher` per resource; `lookupDetail`,
  `lookupByEmail`, `lookupByPhoneNumbers`, `search`, and `searchPlaces` are never batched.
- `lookupByPhoneNumbers` rejects more than 5 numbers; keep the limit and its message.
- Every resource path embeds `webex.internal.device.orgId`.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-dss build:src`
2. `yarn workspace @webex/internal-plugin-dss test:unit`
3. `yarn workspace @webex/internal-plugin-dss test:style`

Step 1 is required before step 2: `test/unit/spec/dss.ts` imports `@webex/internal-plugin-dss`,
which resolves to `dist/index.js`, so a stale `dist/` tests old code. Run `yarn prebuild:modules`
once on a fresh checkout so the sibling packages' `dist/` exist.

Testing rules:

- Add or update unit cases for every behavior change, next to the matching `describe` block.
- Use the existing MockWebex setup with the stub mercury, `webex.request`, the `uuid.v4` stub, and the
  `createData`, `testMakeRequest`, and `testMakeBatchedRequests` helpers in `test/unit/spec/dss.ts`.
- Use `assert.calledOnceWithExactly` for request arguments, and parametrize when more than three
  cases are alike.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use `sinon.useFakeTimers()` for the batcher debounce and the request timeout.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets
  `root: true`; `.ts` files get the shared TypeScript and prettier override.
- Prefer small functions over large procedural blocks.
- Make error handling explicit; keep the existing error messages, which the unit tests match on.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Add a query method that builds /<verb>/orgid/<orgId>/<path> and calls _request with a dataPath
  constant from src/constants.ts.
- Route single-value lookups that should coalesce through _batchedLookup.
- Log as "DSS-><method>#ERROR, <reason>" without the looked-up ids, emails, or numbers.

Avoid:
- Treating README.md as the signature reference for lookup or lookupByEmail.
- Reading the webex.request response; results come only from mercury.
- Reading this.config outside the DSS namespace.
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
- Risk and impact on first-party clients that call `webex.internal.dss`; inside this workspace the
  only consumer is the `webex` bundle, which loads the plugin through `require` in
  `packages/webex/src/webex.js` and calls none of its methods.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Renaming or removing a `dss:*` event, a method, or the registered plugin name.
- Changing a DSS resource path, request body field, or result path.
- Changing the result resolve shape of any method, the timeout semantics, or the batcher defaults.
- Changing the phone-number limit.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log looked-up ids, emails, phone numbers, query strings, or returned entities.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
