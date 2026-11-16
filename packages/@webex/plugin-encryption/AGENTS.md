<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-16T07:57:20Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/plugin-encryption`, the public `cypher` plugin of the SDK (it
downloads and decrypts encrypted Webex files through `webex.internal.encryption` and registers the
device) and its small standalone `Webex` constructor. This file orients agents. The monorepo root
`AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, method names, option fields, or URL parameters. Verify them
  from this package's source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (Cypher plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes a public SDK surface, so its contract artifact is `package.json` plus the `src/webex.js` main
and the `src/index.ts` typed entry. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run `yarn` and
`yarn prebuild:modules` at the workspace root, and the package scripts below from this package
directory, `packages/@webex/plugin-encryption`, where `package.json` defines them. From the workspace
root, `yarn workspace @webex/plugin-encryption <script>` runs the same script.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root); on a fresh checkout run `yarn prebuild:modules` once |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn build:src`, then `yarn test:unit` (Jest enforces an 85% global coverage threshold) |
| Run linters            | `yarn test:style` |
| Build/release artifact | `yarn build:src` (JavaScript, source maps, and `dist/types` declarations) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`yarn build` emits only the declarations and is the last step of `build:src`. `yarn test:browser`
runs nothing because the package has no `test/integration` directory. `yarn build:docs` writes typedoc
output to the workspace `docs/` folder, outside this package. There is no aggregate `test` script and
no `test:integration` script.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/plugin-encryption`.

Primary outcomes:

- Deliver production-safe changes with build, lint, and unit tests (with coverage) passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Build, lint, and unit tests pass locally, and the coverage threshold is met.
3. Updated docs cover new behavior, including the owning module spec and the README sample code when
   the API changes.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | node; TypeScript sources plus two JavaScript files | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=16`; the workspace root `package.json` `engines.node` reads `18.x` |
| Build tool       | yarn workspaces, `@webex/legacy-tools` over babel, and `tsc` for declarations | yarn `3.4.1` (root `packageManager`), `@babel/core` `^7.22.11`, typescript `^4.9.5` |
| Test framework   | jest through `webex-legacy-tools`, with `@webex/test-helper-mock-webex` | `@webex/jest-config-legacy` (`workspace:*`) extended by the local `jest.config.js` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.ts`: registers public plugin `cypher`; exports the default `Cypher` and the types.
- `src/cypher/index.ts`: `Cypher` — `register`, `deregister`, `downloadAndDecryptFile`, `registered`.
- `src/cypher/types.ts`, `src/cypher/constants.ts`, `src/types.ts`: option and interface types,
  constants, the parent `webex` shape.
- `src/config.ts`: registered config `{cypher: {}}`.
- `src/webex.js`, `src/webex-config.ts`: the standalone `Webex` constructor (package `main`, and the
  workspace UMD `encryption` entry) and its intended defaults.
- `test/unit/spec/cypher/index.ts`: the unit cases.
- `dist/`: generated build output. Never edit by hand.
- `README.md`, `developer-quickstart.md`: retained product docs, context only; see
  [ADR-0001](docs/adr/0001-retain-product-docs.md).
- Spec for every file under `src/`: `src/docs/README.md`.

### Critical Constraints

- The plugin does no cryptography; keys, SCR decryption, and downloads go through
  `webex.internal.encryption` (module Design overview), and it never stores or logs the key URI,
  JWE, SCR, or file bytes (`INV-003`).
- The key URI and JWE come as one pair from the URL or from the options (`INV-001`).
- `register()` and `deregister()` change `registered` only after a successful device call
  (`INV-002`); the field is public and writable, so callers can also change it directly.
- `Webex.init` does not apply `src/webex-config.ts` today, and the published `types` disagree with
  `main` on the default export; both are among the module spec's known defects (Evidence register), not promises.

## 4. Testing Workflow

Run checks in this order, from the package directory:

1. `yarn build:src`
2. `yarn test:unit`
3. `yarn test:style`

Run `yarn` and `yarn prebuild:modules` first on a fresh or outdated checkout: the unit spec imports
`@webex/internal-plugin-encryption` and `@webex/test-helper-mock-webex` by name, which load their
`dist/`.

Testing rules:

- Add or update tests in `test/unit/spec/cypher/index.ts` for every behavior change; the URL-wins and
  one-value cases, the invalid URL, the error shapes, and the standalone constructor have no unit case
  today, so pin current behavior first.
- Use the file's existing style: `MockWebex` with `Cypher` and the internal encryption plugin as
  children, `jest.fn()` stubs for `decryptScr`, `download`, `device.register`, and `device.unregister`.
- Assert exact calls (`toHaveBeenCalledWith`) and exact error messages, and parametrize when more than
  three cases are alike.
- Use fake timers for any time-dependent behavior.
- Keep the 85% global coverage threshold in `jest.config.js` met; it measures only files the spec
  loads.
- Do not remove tests to make CI pass.

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
- Delegate to this.$webex.internal.encryption and this.$webex.internal.device; keep Cypher thin.
- Log with this.$webex.logger and a 'Cypher:' prefix; log error messages, not inputs.
- Reject with an Error whose message says what failed, and keep the original as cause.

Avoid:
- Fetching keys, decrypting, or downloading inside Cypher.
- Mixing a key URI from the URL with a JWE from the options.
- Logging key URIs, JWEs, SCRs, file bytes, or tokens.
```

## 6. Git Workflow

- Branch naming: no package convention is defined; follow the workspace `CONTRIBUTING.md`.
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), which
  the workspace `CONTRIBUTING.md` requires for pull requests.
- Keep commits focused and reversible.
- Rebase on the target branch before opening a pull request.

PR checklist:

- What changed and why.
- Tests run and results, including the coverage summary.
- Risk and impact on applications using `webex.cypher`, the UMD `encryption` bundle, and the `webex`
  and `webex-node` packages.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding or removing dependencies, including declaring `@webex/plugin-authorization`, `lodash`, or
  `@babel/polyfill`.
- Making `Webex.init` apply `src/webex-config.ts`, or changing those defaults.
- Changing `package.json` `main`, `exports`, or `types`.
- Changing the error messages or wrapping of `downloadAndDecryptFile`, or the `useFileService` default.
- Renaming or removing a method, an option field, the `keyUri` or `JWE` query names, or the registered
  plugin name.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, credentials, or private keys, including in test fixtures.
- Log key URIs, JWEs, SCRs, file bytes, or bearer tokens through `webex.logger`.
- Lower the coverage threshold to make CI pass.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
