<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T07:38:37Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-board`, the internal whiteboard plugin of the SDK
(`webex.internal.board`: board channels, encrypted board contents, image upload, transcoder
authorization, and live board activity over Mercury). This file orients agents. The monorepo root
`AGENTS.md` governs workspace-wide setup.

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
- the module specification at [`src/docs/README.md`](src/docs/README.md) (board plugin); and
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
| Run tests              | `yarn workspace @webex/internal-plugin-board test:unit` (jest) after `build:src` |
| Run linters            | `yarn workspace @webex/internal-plugin-board test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-board build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`test:browser` runs the unit and integration specs through karma against live Webex services and
needs test-user credentials; it is not a routine verification command. There is no
`test:integration` script, so the aggregate `test` script fails at that step.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/internal-plugin-board`.

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
| Language runtime | node; JavaScript sources | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=16`; the workspace root `package.json` `engines.node` still reads `18.x`, which conflicts with the other pins |
| Build tool       | yarn workspaces and `@webex/legacy-tools` over babel | yarn `3.4.1` (root `packageManager`), `@babel/core` `^7.17.10` |
| Test framework   | jest via `webex-legacy-tools` (`test:unit`); chai, sinon, `@webex/test-helper-mock-webex`, and `@webex/test-helper-mock-web-socket` | sinon `^9.2.4` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: imports the mercury, encryption, conversation, and feature plugins, registers
  internal plugin `board` with its config and payload transformer, and re-exports `Board`, `config`,
  and `RealtimeChannel`.
- `src/board.js`: the `Board` plugin (channels, contents, images, registration, transcoder).
- `src/realtime.js`: the `realtime` child (publish, own and shared sockets, activity routing).
- `src/realtime-channel.js`, `src/realtime-channel-collection.js`: one board's Mercury connection and
  the collection keyed by `channelId`.
- `src/config.js`: `webex.config.board` defaults.
- `src/docs/README.md`: the module specification.
- `test/unit/spec/`: three unit specs (58 cases); they import the package by name, which loads `dist/`.
- `test/integration/spec/`: live-service specs run only by `test:browser`; two of three are skipped.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only; see
  [ADR-0001](docs/adr/0001-retain-product-readme.md).

### Critical Constraints

- Every board content item leaves the client encrypted with `channel.defaultEncryptionKeyUrl`.
- `createChannel` and `getChannels` must use the board cluster that matches the conversation ACL
  cluster when one resolves; the home cluster answers with a 307 the browser cannot follow.
- `addContent` posts chunks one at a time; parallel chunks race.
- The `encryptChannel` transform must run before `encryptKmsMessage`; it fills the empty `keyUris`.
- `authorizeMediaInjector` and `unauthorizeMediaInjector` resolve errors as values on purpose.
- `RealtimeChannel` uses namespace `Board`, so board sockets read `webex.config.board`, not the
  Mercury config.
- `webex.internal.device` is used but not declared in `package.json`; it arrives through mercury.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-board build:src`
2. `yarn workspace @webex/internal-plugin-board test:unit`
3. `yarn workspace @webex/internal-plugin-board test:style`

Step 1 matters: the unit specs import `@webex/internal-plugin-board` by name, which resolves `main`
(`dist/index.js`), so a stale `dist/` makes results meaningless.

Testing rules:

- Add or update unit cases for every behavior change. The payload transformer, the media-injector
  methods, `processActivityEvent`, `unregisterFromSharedMercury`, and the shared-socket refresh have no
  unit case today.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use `sinon.useFakeTimers()` when a case depends on time.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets
  `root: true`; `test:style` currently reports only `require-jsdoc` warnings.
- Prefer small functions over large procedural blocks.
- Make error handling explicit; request failures reject unless a documented trade-off says otherwise.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Read page sizes, timers, and the binding prefix from this.config (the board namespace).
- Reach encryption, services, mercury, feature, and device through this.webex.internal at call time.
- Add a case next to the matching describe block in test/unit/spec/board.js, encryption.js, or realtime.js.

Avoid:
- Sending unencrypted content or decrypted payloads to the board service.
- Treating README.md as the method, event, or error reference.
- Trusting JSDoc return annotations over the code.
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
- Risk and impact on channel creation, content encryption, image upload, and live board activity.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Changing the encrypted content shape, the `publishRequest` frame, or the binding format.
- Changing the payload transformer predicates or transforms.
- Changing cluster routing for create and list.
- Making the media-injector methods reject.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, KMS keys, bearer tokens, or credentials, including in test fixtures.
- Log decrypted board content, keys, or transcoder bearer tokens.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
