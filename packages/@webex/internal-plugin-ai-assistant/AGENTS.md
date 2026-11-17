<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T09:49:19Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-ai-assistant`, the internal `aiassistant`
plugin of the SDK (it sends meeting-assistant requests to the assistant-api service and streams the
decrypted answers back as events over mercury). This file orients agents. The monorepo root
`AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, event names, or content types. Verify them from this
  package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (AI assistant plugin); and
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
| Run tests              | `yarn workspace @webex/internal-plugin-ai-assistant test:unit` (jest) |
| Run linters            | `yarn workspace @webex/internal-plugin-ai-assistant test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-ai-assistant build:src` (JavaScript and source maps to `dist/`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`yarn workspace @webex/internal-plugin-ai-assistant build` runs `yarn build:src` and produces the
same output; the package has no `tsconfig.json` and emits no type declarations.

Do not use the aggregate `test` script: it calls `test:integration`, which this package does not
define. `test:browser` finds no `test/integration` directory and verifies nothing.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/internal-plugin-ai-assistant`.

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

- `src/index.ts`: registers internal plugin `aiassistant` and default-exports `AIAssistant`.
- `src/ai-assistant.ts`: `AIAssistant`, where all behavior lives. Spec: `src/docs/README.md`.
- `src/utils.ts`: in-place decrypt helpers per response content type.
- `src/constants.ts`: event names, service name, error names and codes, enums.
- `src/types.ts`: option and response interfaces.
- `src/config.ts`: default `requestTimeout` (60000 ms).
- `test/unit/spec/ai-assistant.ts`: the unit spec (31 cases); it imports the package by name, which
  loads `dist/`.
- `test/unit/data/messages.ts`: recorded chunk and activity fixtures.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only and partly stale (it names the namespace
  `aiAssistant`); see [ADR-0001](docs/adr/0001-retain-product-readme.md).

### Critical Constraints

- The plugin is `webex.internal.aiassistant` (all lowercase), and its config is
  `webex.config.aiassistant`; keep the namespace `AIAssistant` so the config lookup still works.
- Requests stream only after `register()`: chunks arrive over mercury, not in the HTTP response.
- Every stream event carries `requestId` and `finished`; clients stop listening on `finished`.
- Message content is encrypted with the caller's key before sending; response content is decrypted
  by content name in `_decryptContent` and `src/utils.ts`.
- The timeout event `AI_ASSISTANT_TIMEOUT` / `9408` is generated by the plugin; keep its name and
  code.
- `@webex/internal-plugin-encryption` is used through `webex.internal.encryption` but is not a
  declared dependency.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-ai-assistant build:src`
2. `yarn workspace @webex/internal-plugin-ai-assistant test:unit`
3. `yarn workspace @webex/internal-plugin-ai-assistant test:style`

Step 1 is required before step 2: the unit spec imports `@webex/internal-plugin-ai-assistant`, which
resolves to `dist/index.js`, so a stale `dist/` tests old code. Run `yarn prebuild:modules` once on
a fresh checkout so the sibling packages' `dist/` exist.

Testing rules:

- Add or update unit cases for every behavior change, next to the matching `describe` block.
- Use the existing MockWebex setup with the stub mercury, `webex.request`, and
  `webex.internal.encryption`, and the fixtures in `test/unit/data/messages.ts`.
- Use `assert.calledOnceWithExactly` for request arguments and payloads, and parametrize when more
  than three cases are alike.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use `sinon.useFakeTimers()` for the inactivity timer.

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
- Add a response content name to RESPONSE_NAMES, a decrypt helper in src/utils.ts, and a case in
  _decryptContent.
- Build a new meeting helper on makeAiAssistantRequest with a CONTEXT_RESOURCE_TYPES context.
- Log as "AI assistant-><method>#ERROR, <reason>" without request or response content.

Avoid:
- Treating README.md as the namespace, event, or payload reference.
- Emitting on aiassistant:stream:<requestId> without requestId and finished.
- Reading this.config outside the AIAssistant namespace.
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
- Risk and impact on clients listening to `aiassistant:*` events.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies, including declaring `@webex/internal-plugin-encryption`.
- Renaming or removing an `aiassistant:*` event, an error name or code, or the registered plugin name.
- Changing the assistant-api request body, resource paths, or headers.
- Changing the stream event payload shape or the timeout semantics.
- Changing which fields are encrypted or decrypted.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, KMS key material, or credentials, including in test fixtures.
- Log questions, answers, citations, attendee emails, or any decrypted content.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
