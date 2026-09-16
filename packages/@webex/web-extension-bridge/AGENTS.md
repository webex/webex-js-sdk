<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: cursor
approved_by: pending
updated_at: 2026-09-16T10:06:00Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/web-extension-bridge`. This file orients agents; it does not replace the standing docs.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, chrome permissions, envelope fields, or error codes. Verify them from this package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- `docs/index.md` for package documentation navigation;
- `docs/architecture.md` for package boundaries and interactions;
- `docs/specs/README.md` for the manifest-backed module and contract registry;
- the affected module's manifest-routed spec (`src/core/docs/README.md`, `src/web/docs/README.md`, or `src/extension/docs/README.md`); and
- `docs/adr/index.md` plus applicable concrete ADRs for durable decisions.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. Published SDK surfaces use `package.json` exports plus the owning TypeScript entry. Do not invent an OpenAPI document for this package.

Preserve existing `README.md` and `SECURITY.md` unless a change request explicitly updates product or disclosure text.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run them from the `webex-js-sdk` workspace root. Use Node **22.14** (`nvm use 22.14`) before these commands. `package.json` `engines.node` is `>=18` for the published package; that does not mean Node 18–21 is a supported local toolchain.

| Task                   | Command                                                      |
| ---------------------- | ------------------------------------------------------------ |
| Install dependencies   | `yarn`                                                       |
| Start dev environment  | `[NEEDS HUMAN INPUT] -- this package has no dedicated dev server script` |
| Run tests              | `yarn workspace @webex/web-extension-bridge test:unit`       |
| Run linters            | `yarn workspace @webex/web-extension-bridge test:style`      |
| Typecheck              | `yarn workspace @webex/web-extension-bridge typecheck`       |
| Build/release artifact | `yarn workspace @webex/web-extension-bridge build:src`       |
| Build local samples    | `yarn workspace @webex/web-extension-bridge build:samples`   |
| Format code            | `[NEEDS HUMAN INPUT] -- no standalone format script; eslint runs via test:style` |

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/web-extension-bridge`.

Primary outcomes:

- Deliver production-safe changes with passing tests.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.
- Stay inside this package. Do not document or modify plugin-meetings, mercury, auth, or other `@webex/*` runtime packages as part of this SDD foundation.

Definition of done:

1. Requested change is implemented.
2. Relevant tests/lint/build checks pass locally.
3. Updated docs/config cover new behavior.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

Document concrete versions so assistants choose compatible APIs.

| Area             | Tooling     | Version                          |
| ---------------- | ----------- | -------------------------------- |
| Language runtime | Node.js     | Published `>=18` (`package.json` engines); local workspace requires **22.14** (`nvm use 22.14`)  |
| Language         | TypeScript  | `^4.9.5`                         |
| Build tool       | tsc + `@webex/legacy-tools` | workspace scripts     |
| Test framework   | mocha + sinon + chai | `package.json` devDependencies |
| Lint/format      | eslint      | `test:style`                     |

### Project Map

- `src/core`: env-agnostic protocol, validation, correlation, rate limit, errors, logger
- `src/web`: `createWebBridge` and `window.postMessage` adapter
- `src/extension`: content relay, background bridge, UI client
- `src/content-script.ts`: published side-effect entry that calls `startContentRelay`
- `src/index.ts` / `src/types.ts`: page public surface
- `test/unit`: mocha specs for core, web, extension, security, and in-process integration
- `README.md` / `SECURITY.md`: product and disclosure docs (reuse, do not overwrite during SDD)

### Critical Constraints

- Public specifiers are only `.`, `./extension`, `./content-script`, and `./package`. Layout aliases `/web` and `/extension/{background,client,content}` were removed before first release.
- Test seams `create*With` / `createContentRelay` are unpublished.
- Origin allow-lists are exact `http(s)` origins. `'*'` and wildcards throw `INSECURE_CONFIG`.
- `postMessage` `targetOrigin` is always the document origin, never `'*'`.
- Worker `allowedOrigins` is required. `chrome.storage.session` requires the `storage` permission. The code uses `chrome.tabs` query/send without a `tabs` permission and does not use `externally_connectable`.
- Ids come from CSPRNG (`crypto.randomUUID` or `getRandomValues`); construction throws `CRYPTO_UNAVAILABLE` if neither exists.
- Zero runtime dependencies. No network I/O.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/web-extension-bridge test:unit`
2. `yarn workspace @webex/web-extension-bridge test:style`
3. `yarn workspace @webex/web-extension-bridge typecheck`

Testing rules:

- Add or update tests for every behavior change.
- Cover failure paths and edge cases, not only happy paths. Security cases live in `test/unit/spec/security/threats.ts`.
- Do not remove tests to make CI pass.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output, including `eslint-security-rules.js`.
- Prefer small, composable functions over large procedural blocks.
- Make error handling explicit at system boundaries. Cross-boundary errors are redacted `WireError` values from `toWireError`.
- Keep public interfaces stable unless a breaking change is requested.
- Before adding a literal path, filename, command, workflow identifier, status, or other policy value, search the package for exact and semantically equivalent uses.
- Do not import a default, named, object, or namespace binding and immediately re-export it. Consumers should import from the owning module; package barrels should use direct named re-exports.
- Do not write inline runtime `typeof` checks outside descriptively named guard implementations.

Pattern example:

```text
Preferred:
- Validate external input close to the boundary (validateEnvelope, isOriginAllowed, resolveWebConfig).
- Return typed/structured results and coded BridgeError values.
- Include actionable error messages that stay on this side of the trust boundary.

Avoid:
- Passing unvalidated payloads deep into the system.
- Swallowing exceptions or returning ambiguous null values.
- postMessage with a wildcard target origin.
```

## 6. Git Workflow

- Branch naming: follow the current JS SDK convention for the change (`feat:`, `fix:`, `docs:` prefixes in conventional commits)
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Keep commits focused and reversible.
- Rebase on the target branch before opening PR.

PR checklist:

- What changed and why.
- Tests run and results.
- Risk/impact areas.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.

### Ask First

- Adding new dependencies or external services.
- Large refactors or schema migrations.
- Security-sensitive changes (auth, encryption, secrets handling, origin checks, chrome permissions).
- Any destructive data or infrastructure operation.

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
- Invent chrome permissions, envelope fields, or BridgeError codes.
