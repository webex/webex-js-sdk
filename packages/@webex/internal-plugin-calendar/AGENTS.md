<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T08:24:55Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-calendar`, the internal calendar plugin of the
SDK (`webex.internal.calendar`: meeting sync and the Mercury-updated meeting collection, notes,
participants, scheduler data, encrypted calendar event writes, and free-busy lookups). This file
orients agents. The monorepo root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, or config keys. Verify them from this package's source and
  tests, and check sibling plugin specifications before relying on their behavior.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (calendar plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` entry. It
serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; the deploy workflow runs the same command); on a fresh checkout run `yarn prebuild:modules` once, because `yarn` does not build `@webex/legacy-tools` or sibling `dist/` |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/internal-plugin-calendar test:unit` (jest) after `build:src` |
| Run linters            | `yarn workspace @webex/internal-plugin-calendar test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-calendar build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`test:browser` runs the unit and integration specs through karma against live Webex services and
needs test-user credentials; it is not a routine verification command. There is no
`test:integration` script, so the aggregate `test` script fails at that step.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/internal-plugin-calendar`.

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
| Language runtime | node; JavaScript sources | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=18`; the workspace root `package.json` `engines.node` still reads `18.x` |
| Build tool       | yarn workspaces and `@webex/legacy-tools` over babel | yarn `3.4.1` (root `packageManager`), `@babel/core` `^7.17.10` |
| Test framework   | jest via `webex-legacy-tools` (`test:unit`); chai, sinon, and `@webex/test-helper-mock-webex` | sinon `^9.2.4` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: imports the device, encryption, and conversation plugins, registers internal plugin
  `calendar` with its config and inbound payload transformer, and re-exports `Calendar` as default.
- `src/calendar.js`: the `Calendar` plugin (register, sync, reads, writes, scheduler data, free-busy).
- `src/collection.js`, `src/util.js`: the module-level meeting collection and the `endTime` helper.
- `src/calendar.encrypt.helper.js`, `src/calendar.decrypt.helper.js`: payload encryption with a
  cached KMS key, and scheduler-data and free-busy decryption.
- `src/config.js`, `src/constants.js`: `webex.config.calendar` defaults and the `calendar:*` event
  names.
- `src/docs/README.md`: the module specification.
- `test/unit/spec/`: four unit specs (28 cases); `calendar.js` imports the package by name, which
  loads `dist/`.
- `test/integration/spec/calendar.js`: live-service spec run only by `test:browser`; it is skipped.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only; see
  [ADR-0001](docs/adr/0001-retain-product-readme.md).

### Critical Constraints

- Meeting subjects, notes, `webexOptions`, attendee fields, and free-busy emails must leave the client
  encrypted with the plugin's `encryptionKeyUrl`. Attendee encryption is currently not awaited; do not
  rely on it.
- A free-busy request carries `encryptionKeyUrl` only together with `emails`; the service answers 400
  otherwise.
- The three meeting predicates must keep skipping `GET schedulerData`, which `getSchedulerData`
  decrypts itself.
- The meeting collection and `rpcEventRequests` are shared by every SDK instance in the process.
- `unregister()` removes every listener on the six calendar Mercury events and disconnects Mercury and
  the device for the whole SDK instance.
- `webex.internal.mercury` and `@webex/common` are used but not declared in `package.json`.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-calendar build:src`
2. `yarn workspace @webex/internal-plugin-calendar test:unit`
3. `yarn workspace @webex/internal-plugin-calendar test:style`

Step 1 matters: `test/unit/spec/calendar.js` imports `@webex/internal-plugin-calendar` by name, which
resolves `main` (`dist/index.js`), so a stale `dist/` makes results meaningless.

Testing rules:

- Add or update unit cases for every behavior change. The payload transformer, `getFreeBusy` and the
  free-busy event, `getByType`, `processMeetingEvent`, the participants fetch in `list`, and attendee
  encryption have no unit case today.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use `sinon.useFakeTimers()` when a case depends on time, including the `src/config.js` date window.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets
  `root: true`; `test:style` currently reports only `require-jsdoc` warnings.
- Prefer small functions over large procedural blocks.
- Make error handling explicit; request failures reject.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Read the date window from this.config (the calendar namespace).
- Reach device, mercury, and encryption through this.webex.internal at call time.
- Emit plugin events with the names in src/constants.js, after the collection changes.
- Add a case next to the matching describe block in test/unit/spec/calendar.js or a helper spec.

Avoid:
- Sending unencrypted meeting content or free-busy emails to the calendar service.
- Treating README.md as the method, event, or error reference.
- Trusting the event names in the src/calendar.js JSDoc over src/constants.js.
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
- Risk and impact on meeting sync, calendar events, encrypted writes, scheduler data, and free-busy.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Changing the encrypted field set, the free-busy payload, or the event names.
- Changing the payload transformer predicates or transforms.
- Changing what `unregister()` tears down.
- Making the meeting collection or `rpcEventRequests` per instance.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, KMS keys, or credentials, including in test fixtures.
- Log decrypted meeting content, emails, or keys.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
