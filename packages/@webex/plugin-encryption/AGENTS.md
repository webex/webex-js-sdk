<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-11-05T16:10:55Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/plugin-encryption`, the `webex.cypher` plugin that downloads and
decrypts encrypted Webex attachments and registers the device. This file orients agents. The monorepo
root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, config keys, events, or storage keys. Verify them from this
  package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (Cypher encryption plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

For sibling packages this package depends on, read their specification first when one exists, and fall
back to their code otherwise: `@webex/webex-core` (`../webex-core/src/docs/README.md`) and
`@webex/internal-plugin-device` (`../internal-plugin-device/src/docs/README.md`) have specifications;
`@webex/internal-plugin-encryption` has none, so read `../internal-plugin-encryption/src/`.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus `src/index.ts`,
`src/webex.js`, `src/cypher/index.ts`, and `src/cypher/types.ts`. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root) |
| Start dev environment  | N/A — library package with no start script in `package.json`; the sample app runs from the workspace root with `yarn samples:build && yarn samples:serve` |
| Run tests              | `yarn workspace @webex/plugin-encryption test:unit` |
| Run linters            | `yarn workspace @webex/plugin-encryption test:style` |
| Build/release artifact | `yarn workspace @webex/plugin-encryption build:src` (writes `dist/`, then runs `build` for `dist/types`) |
| Format code            | N/A — no format script; `prettier` is a devDependency |

`test:browser` collects `test/integration/spec`, which does not exist, so it is not a verification
command. If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/plugin-encryption`.

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
| Language runtime | node; TypeScript sources (`src/webex.js` is CommonJS) | `>=16` (`package.json` engines); TypeScript `^4.9.5` |
| Build tool       | `@webex/legacy-tools` over babel, then `tsc` for declarations | `@babel/core` `^7.22.11` |
| Test framework   | jest via `webex-legacy-tools` (`test:unit`), with `@webex/test-helper-mock-webex` | jest config in `jest.config.js` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.ts`: registers public plugin `cypher` with `config`; exports the class and two types.
- `src/cypher/index.ts`: the `Cypher` plugin. Spec: `src/docs/README.md`.
- `src/cypher/types.ts`: `FileDownloadOptions` and `IEncryption`.
- `src/cypher/constants.ts`: the `CYPHER` namespace; the `DECRYPTION*` constants are unused.
- `src/types.ts`: structural typing of the `webex` instance used by the plugin.
- `src/webex.js`, `src/webex-config.ts`: the `main` bundle entry (`Webex.init`) and its defaults, which
  currently land under `config.default` instead of the top level.
- `test/unit/spec/cypher/index.ts`: the unit spec run by `test:unit`.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`, `developer-quickstart.md`: retained consumer docs. They are not the behavioral
  authority; see [ADR-0001](docs/adr/0001-migrate-readme-and-quickstart.md).

### Critical Constraints

- `downloadAndDecryptFile` uses the `keyUri` and `JWE` from the URL only when both are present;
  otherwise it uses both from `options`. Keep the `keyUri` and `JWE` query-parameter names exact and
  case-sensitive.
- Only `useFileService` is forwarded to the internal `download`, and it defaults to `false` here. Do not
  silently forward other options without updating the module spec.
- A `decryptScr` failure is wrapped with a `cause`; a `download` failure is returned raw because the
  `try` block returns the promise without `await`. Changing either changes the caller-visible contract.
- `register()` and `deregister()` are not serialized; do not assume overlapping calls are safe.
- Never log or persist `keyUri`, `JWE`, the SCR, or decrypted bytes.
- Do not "fix" the `src/webex-config.ts` nesting in `src/webex.js` without a decision: it would start applying
  `ephemeral` devices, memory storage, and `hydra` defaults to every bundle user.
- The `main` export (`dist/webex.js`, `Webex`) and the `types` entry (`Cypher`) disagree; do not change
  one without checking the other.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/plugin-encryption build:src`
2. `yarn workspace @webex/plugin-encryption test:unit`
3. `yarn workspace @webex/plugin-encryption test:style`

Testing rules:

- Add or update unit cases for every behavior change. Known gaps today: an invalid `fileUri`, a one-parameter URL,
  the wrapped and raw error shapes, the registered flag after success, overlapping `register()` calls, and
  `src/webex.js` have no unit case.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Follow the workspace test guidelines in the root `AGENTS.md` (sinon, `assert` from
  `@webex/test-helper-chai`); the existing spec uses jest mocks, so match the file you are editing.

`jest.config.js` enforces an 85% global coverage threshold.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`.
- Prefer small functions over large procedural blocks.
- Make error handling explicit and keep error message text stable; callers may match it.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Log through this.$webex.logger with a "Cypher:" prefix.
- Add a case in the matching describe block of test/unit/spec/cypher/index.ts.

Avoid:
- Reaching into internal-plugin-encryption beyond decryptScr and download.
- Treating README.md as the list of methods or errors.
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
- Risk and impact on consumers that download and decrypt attachments.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies, including declaring the undeclared ones `src/webex.js` requires.
- Changing error messages, the `keyUri`/`JWE` precedence rule, or the `useFileService` default.
- Changing the `main`, `types`, or `exports` entries in `package.json`.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, `JWE` values, or real attachment URLs, including in test fixtures.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
