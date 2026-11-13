<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T09:22:36Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-voicea`, the internal `voicea` plugin of the SDK
(a factory for `VoiceaChannel`, which drives meeting captions, transcription, and manual captions
through Locus and talks to the voicea service over a caller-owned LLM data channel). This file orients
agents. The monorepo root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, event names, or relay types. Verify them from this
  package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (voicea caption and
  transcription channel); and
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
| Run tests              | `yarn workspace @webex/internal-plugin-voicea test:unit` (jest) |
| Run linters            | `yarn workspace @webex/internal-plugin-voicea test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-voicea build:src` (JavaScript to `dist/`, then declarations) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`yarn workspace @webex/internal-plugin-voicea build` runs `tsc` alone (type check and declarations
only, through the workspace `emitDeclarationOnly`); `build:src` runs it after writing `dist/`.

Do not use the aggregate `test` script: it calls `test:integration`, which this package does not
define. `test:browser` finds no `test/integration` directory and verifies nothing.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/internal-plugin-voicea`.

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
| Language runtime | node; TypeScript sources | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=18`; the workspace root `package.json` `engines.node` still reads `18.x`, which conflicts with the other pins |
| Build tool       | yarn workspaces, `@webex/legacy-tools` over babel, and `tsc` for declarations | yarn `3.4.1` (root `packageManager`), `@babel/core` `^7.17.10` |
| Test framework   | jest via `webex-legacy-tools` (`test:unit`); chai, sinon, `@webex/test-helper-mock-webex`, `@webex/test-helper-mock-web-socket` | sinon `^9.2.4` |
| Lint/format      | eslint via `@webex/eslint-config-legacy` (TypeScript override), prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.ts`: registers internal plugin `voicea` and re-exports `VoiceaPlugin` (default and named),
  `VoiceaChannel`, `EVENT_TRIGGERS`, `TURN_ON_CAPTION_STATUS`, and two payload types.
- `src/voicea-plugin.ts`: `VoiceaPlugin`, whose only method is `createChannel(llmChannel?)`.
- `src/voicea.ts`: `VoiceaChannel`, where all behavior lives. Spec: `src/docs/README.md`.
- `src/constants.ts`: event names, relay types, transcription types, status values.
- `src/voicea.types.ts`: payload types and the `IVoiceaChannel` interface.
- `src/utils.ts`: the `m:ss` timestamp formatter.
- `test/unit/spec/voicea.js`, `test/unit/spec/voicea-plugin.js`, `test/unit/spec/utils.js`: the unit
  specs (84 cases); they import `src` directly.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only and partly stale (it still documents
  `registerAndConnect`); see [ADR-0001](docs/adr/0001-retain-product-readme.md).

### Critical Constraints

- The LLM channel belongs to the caller. `VoiceaChannel` borrows it and must never connect,
  disconnect, or tear it down.
- Methods live on `VoiceaChannel`, not on `webex.internal.voicea`; the plugin only creates channels.
- plugin-meetings listens to `EVENT_TRIGGERS` values and reads `TURN_ON_CAPTION_STATUS` and
  `MeetingTranscriptPayload`. Treat their values and shapes as a contract.
- Every outbound data-channel frame uses the shared sequence number as `id` and advances it.
- `switchLLMChannel` is a reconciler; keep it idempotent so repeated or late calls converge.
- `deregisterEvents` keeps the LLM channel reference, so switching back to that same channel does not
  resubscribe to relay events.
- `toggleManualCaption` sets its status before checking for a channel; a missing channel leaves it
  stuck at `sending`.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-voicea build:src`
2. `yarn workspace @webex/internal-plugin-voicea test:unit`
3. `yarn workspace @webex/internal-plugin-voicea test:style`

Step 1 type-checks the sources through `tsc` and keeps `dist/` current for packages that depend on
this one. The specs import `src` directly, but they load `@webex/internal-plugin-mercury` and
`@webex/internal-plugin-llm` from those packages' `dist/`, so run `yarn prebuild:modules` once on a
fresh checkout.

Testing rules:

- Add or update unit cases for every behavior change, next to the matching `describe` block.
- Use the existing `createMockLLMChannel` helper and the stub request function instead of a real LLM
  channel.
- Use `assert.calledOnceWithExactly` for frames and payloads, and parametrize when more than three
  cases are alike.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use `sinon.useFakeTimers()` when a case depends on time.

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
- Add an event name to EVENT_TRIGGERS and a relay type to AIBRIDGE_RELAY_TYPES in src/constants.ts.
- Reach the LLM channel through requireLLMChannel() and check isLLMConnected() before sending.
- Keep per-meeting state in VoiceaChannel, never in VoiceaPlugin.

Avoid:
- Treating README.md as the method, event, or connection reference.
- Changing a status flag before the checks that can throw.
- Reading webex.config from VoiceaChannel; it holds only the request function and the LLM channel.
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
- Risk and impact on plugin-meetings captions, transcription, manual captions, and channel switching.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Renaming or removing an `EVENT_TRIGGERS` value, an exported constant, or an exported type.
- Changing a Locus `controls` body, a relay type, or a frame shape.
- Changing `switchLLMChannel` or `deregisterEvents` semantics.
- Changing the registered plugin name.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Log transcripts, highlights, speaker names, or manual-caption text.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
