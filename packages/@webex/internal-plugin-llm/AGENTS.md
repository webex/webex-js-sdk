<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-07T07:05:22Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-llm`, the plugin that manages the LLM
data-channel connections Webex meetings use. This file orients agents. The monorepo root
`AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, config keys, events, headers, or toggle names. Verify them
  from this package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (LLM channel plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.ts` barrel,
and its event contract is `src/llm.ts`. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn install` (workspace root) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/internal-plugin-llm test:unit` (jest); `yarn workspace @webex/internal-plugin-llm test:browser` (karma, see Testing Workflow) |
| Run linters            | `yarn workspace @webex/internal-plugin-llm test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-llm build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

The `package.json` script `test` chains `test:style`, `test:unit`, `test:integration`, and
`test:browser`. `test:integration` is not defined, so that aggregate script is not a verification
command.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web SDK engineering assistant for `@webex/internal-plugin-llm`.

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
| Language runtime | node; TypeScript sources | `>=18` (`package.json` engines) |
| Build tool       | `@webex/legacy-tools` over babel | `@babel/core` `^7.17.10` |
| Test framework   | jest via `webex-legacy-tools` (`test:unit`); karma via `test:browser`; chai, sinon, and `@webex/test-helper-mock-webex` | sinon `^9.2.4` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

The single spec file uses Mocha-style `describe` and `it` blocks plus Jest `expect` and `jest.fn`,
so it needs the Jest runner.

### Project Map

- `src/index.ts`: registers internal plugin `llm` and re-exports the default class, the token-type
  enum, the two session-id constants, and the timing type.
- `src/llm.ts`: `config` and the `LLMChannel` class (a Mercury subclass). Spec: `src/docs/README.md`.
- `src/llm.types.ts`: `DataChannelTokenType`, `RegisterAndConnectTiming`, `ILLMChannel`.
- `src/constants.ts`: namespace, session ids, toggle name, and query-parameter constants.
- `test/unit/spec/llm.js`: the only unit spec.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained product readme. It is not the behavioral authority.

### Critical Constraints

- `LLMChannel` extends Mercury from sibling package internal-plugin-mercury. Socket lifecycle, events,
  and reconnect policy come from there; change them in Mercury, not here.
- Ownership checks guard token, refresh-handler, and disconnect calls. Keep them in step with the
  invariant in the module spec and with the callers in plugin-meetings.
- Token values are secrets. Never log them or put them in a URL; they travel only in the registration
  request header.
- Session ids and token keys share values for the built-in sessions. Do not change one without the
  other.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-llm test:unit`
2. `yarn workspace @webex/internal-plugin-llm test:style`
3. `yarn workspace @webex/internal-plugin-llm test:browser` only when checking the karma setup. It
   passes `--integration` alone and the package has no `test/integration/`, so it currently collects
   no files.

The browser run is recorded in `.sdd/manifest.json` as `commands.browser-test` (role `other`), not
under `tests`, because the SDD manifest `tests` schema allows only `unit`, `integration`, `e2e`, and
`qa`. No `integration` tier is recorded because `package.json` defines no integration command.

Testing rules:

- Add or update unit cases for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Exercise `LLMChannel` itself, not a stand-in object.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`.
- Prefer small functions over large procedural blocks.
- Make error handling explicit; attach `timing` to `registerAndConnect` rejections as the code does.
- Keep public interfaces stable unless a breaking change is requested.
- Default session arguments to `LLM_DEFAULT_SESSION`.

Pattern example:

```text
Preferred:
- Check resolveSessionOwnership before a write a non-owner must not make.
- Prefix log lines with llm#<method> -->.
- Add a case next to the matching describe block in test/unit/spec/llm.js.

Avoid:
- Storing tokens inside the connections map.
- Treating README.md as the list of methods or config keys.
- Reimplementing socket handling that Mercury already provides.
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
- Risk and impact, including plugin-meetings callers and Mercury superclass changes.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Changing ownership rules, session ids, or token keys.
- Changing the registration header, the feature-toggle name, or the subchannel query parameter.
- Security-sensitive changes: token storage, token refresh, or log content.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log data-channel tokens.
- Create a package-level `.sdd/templates` directory, copy, or symlink. Use the repository-root
  `.sdd/templates/repo-standards` snapshot.
