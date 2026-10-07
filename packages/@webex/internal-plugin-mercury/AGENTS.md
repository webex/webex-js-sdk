<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-07T00:34:58Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-mercury`, the plugin that keeps the Webex JS
SDK's Mercury WebSocket connections open. This file orients agents. The monorepo root `AGENTS.md`
governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, config keys, events, or close codes. Verify them from this
  package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specifications at [`src/docs/README.md`](src/docs/README.md) (Mercury plugin) and
  [`src/socket/docs/README.md`](src/socket/docs/README.md) (Socket wire protocol); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` barrel,
and its event contract is `src/mercury.js`. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn install` (workspace root) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/internal-plugin-mercury test:unit` (mocha); `yarn workspace @webex/internal-plugin-mercury test:browser` (karma) |
| Run linters            | `yarn workspace @webex/internal-plugin-mercury test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-mercury build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

The `package.json` script `test` chains `test:style`, `test:unit`, `test:integration`, and
`test:browser`. `test:integration` is not defined, so that aggregate script is not a verification
command.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web SDK engineering assistant for `@webex/internal-plugin-mercury`.

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
| Language runtime | node | `>=18` (`package.json` engines) |
| Build tool       | `@webex/legacy-tools` over babel | `@babel/core` `^7.17.10` |
| Test framework   | mocha via `webex-legacy-tools` (`test:unit`); karma via `test:browser`; chai, sinon, `@sinonjs/fake-timers`, and `@webex/test-helper-mock-webex` | sinon `^9.2.4`, fake-timers `^6.0.1` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

`jest.config.js` exists but `test:unit` passes `--runner mocha`, so the unit tier does not run on
Jest.

### Project Map

- `src/index.js`: registers internal plugin `mercury` and re-exports `Mercury`, `Socket`, `config`,
  and five error classes.
- `src/mercury.js`: the `Mercury` plugin. Spec: `src/docs/README.md`.
- `src/config.js`: default `mercury` config and environment overrides.
- `src/errors.js`: `ConnectionError` and its subclasses.
- `src/socket/`: the `Socket` class and its Node and browser constructor hooks. Spec:
  `src/socket/docs/README.md`.
- `test/unit/spec/`: unit specs `mercury.js`, `mercury-events.js`, and `socket.js`.
- `test/integration/spec/`: integration specs that need provisioned Webex test users; they run only
  inside `test:browser`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained product readme. It is not the behavioral authority.

### Critical Constraints

- Close-code policy decides whether a session reconnects. Change it only with the invariant in the
  module spec and the close-code table in `test/unit/spec/mercury-events.js`.
- Events for the default session keep unsuffixed names; other sessions add `:<sessionId>`. SDK
  plugins listen by these names.
- `LLMChannel` in internal-plugin-llm and `RealtimeChannel` in internal-plugin-board subclass
  `Mercury`. Method renames break them.
- `package.json` `browser` swaps `src/socket/socket.js` for `src/socket/socket.shim.js`. Keep both
  in step.
- The access token is sent over the network only in the authorization frame. Never put it in the URL
  or a log line.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-mercury test:unit`
2. `yarn workspace @webex/internal-plugin-mercury test:style`
3. `yarn workspace @webex/internal-plugin-mercury test:browser` when a karma browser and provisioned
   test users are available. It runs the unit and integration specs in a browser.

The browser run is recorded in `.sdd/manifest.json` as `commands.browser-test` (role `other`), not
under `tests`, because the SDD manifest `tests` schema allows only `unit`, `integration`, `e2e`, and
`qa`. No `integration` tier is recorded because `package.json` defines no integration command.

Testing rules:

- Add or update unit cases for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use fake timers for backoff, ping, and pong timing, as the existing specs do.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`.
- Prefer small functions over large procedural blocks.
- Make error handling explicit at the socket boundary; classify open failures in one place.
- Keep public interfaces stable unless a breaking change is requested.
- Emit through `_emit(sessionId, eventName, …)` so session suffixing stays consistent.

Pattern example:

```text
Preferred:
- Add server-pushed behavior as process<Name>Event on the owning plugin.
- Add a case next to the matching describe block in test/unit/spec/mercury.js.
- Prefix log lines with the namespace and session id.

Avoid:
- Reading socket.url to reconnect; use the stored resolved URL.
- Treating README.md as the list of config keys or events.
- Calling native WebSocket methods outside src/socket/.
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
- Risk and impact, including `LLMChannel`, `RealtimeChannel`, and event listeners in other plugins.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Changing close-code handling, reconnect reasons, or retry defaults.
- Changing event names, the session suffix rule, or the autowired handler naming.
- Security-sensitive changes: the authorization frame, token handling, or log content.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log the access token or the authorization frame.
- Create a package-level `.sdd/templates` directory, copy, or symlink. Use the repository-root
  `.sdd/templates/repo-standards` snapshot.
