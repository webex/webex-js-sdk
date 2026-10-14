<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-09-23T06:29:48Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Instructions for AI coding assistants working in `@webex/http-core`, the core HTTP client of the
Webex JS SDK.

## Working Method

- Read the relevant repository files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, or behavior. Verify them from repository-local source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.
- Derive rationale from code and tests. This package's commit history begins at the 2022 workspace
  migration while the code predates it, so commit messages are not a reliable source for why current
  behavior exists.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- `docs/index.md` for repository documentation navigation;
- `docs/architecture.md` for repository boundaries and interactions;
- `docs/specs/README.md` for the manifest-backed module and contract registry;
- the affected module's manifest-routed `<module-path>/docs/README.md`; and
- `docs/adr/index.md` plus applicable concrete ADRs for durable decisions.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. Published
repository-owned HTTP APIs use their linked OpenAPI document; internal HTTP surfaces may link route
code, and published SDKs use their ecosystem-native API artifact. The manifest remains authoritative
for canonical paths and artifact decisions.

This package publishes an SDK surface rather than serving HTTP routes, so its native contract source
is `package.json` and the export surface it declares. There is no OpenAPI document.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing.

| Task                   | Command                                             |
| ---------------------- | --------------------------------------------------- |
| Install dependencies   | `yarn install` (from the workspace root)            |
| Start dev environment  | Not applicable — this package is a library          |
| Run tests              | `yarn workspace @webex/http-core test:unit`         |
| Run linters            | `yarn workspace @webex/http-core test:style`        |
| Build/release artifact | `yarn workspace @webex/http-core build:src`         |
| Format code            | No format script is defined; `prettier` is available as a devDependency in `package.json` |

Additional verified commands from `package.json`:

| Task                          | Command                                              |
| ----------------------------- | ---------------------------------------------------- |
| Integration tests (mocha)     | `yarn workspace @webex/http-core test:integration`   |
| Browser tests (karma)         | `yarn workspace @webex/http-core test:browser`       |
| All tiers in sequence         | `yarn workspace @webex/http-core test`               |
| Publish                       | `yarn workspace @webex/http-core deploy:npm`         |

No command builds the package and runs its tests together. `build` delegates to `build:src` and
compiles only; `test` chains the test tiers without building. If you need both, run them separately.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the engineering assistant for `@webex/http-core`, the HTTP transport layer every other Webex
SDK plugin makes network calls through.

Primary outcomes:

- Deliver production-safe changes with passing tests.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests/lint/build checks pass locally.
3. Updated docs/config cover new behavior.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling                                   | Version                        |
| ---------------- | ----------------------------------------- | ------------------------------ |
| Language runtime | Node.js                                   | `>=18` (`package.json` engines) |
| Language         | JavaScript with one TypeScript source file | `src/request/utils.ts`         |
| Build tool       | `@webex/legacy-tools` (`webex-legacy-tools build`) | workspace                |
| Test framework   | Jest (unit), Mocha (integration), Karma (browser) | `jest.config.js`, `package.json` |
| Lint/format      | ESLint via `@webex/eslint-config-legacy`; Prettier | `^8.24.0` / `^2.7.1` (`package.json`) |

### Project Map

- `src/index.js`: package entry point; builds the curried `request`/`defaults` clients and re-exports the public surface.
- `src/request/`: the request pipeline and its two platform transports. Has its own specification.
- `src/interceptors/http-status.js`: turns 4xx/5xx responses into rejected typed errors.
- `src/lib/interceptor.js`: the `Interceptor` base class downstream plugins subclass.
- `src/lib/detect.js`: buffer/blob MIME detection used for request and response bodies.
- `src/lib/xhr.js`: vendored fork of `naugtur/xhr`, used only by the browser transport.
- `src/http-error.js`, `src/http-error-subtypes.js`: the `HttpError` base and its status-code subtype tree.
- `src/progress-event.js`: the `ProgressEvent` payload emitted for upload/download progress.
- `test/unit/`: Jest unit tests.
- `test/integration/`: Mocha integration tests that need a local fixture server and provisioned test users.

### Critical Constraints

- **Node and browser transports must stay behaviorally aligned.** `package.json` swaps
  `src/request/request.js` for `src/request/request.shim.js` in browser builds. A change to one
  transport that is not mirrored in the other silently diverges by platform.
- **`src/lib/xhr.js` is a vendored fork and is deliberately held close to upstream.** Its own header
  says so. Keep diffs minimal and do not reformat it; its `eslint-disable` is intentional.
- **Error subtype identity is a published contract.** Consumers branch on classes such as
  `NotFound` and `TooManyRequests` from `src/http-error-subtypes.js`. Renaming, removing, or
  reparenting a subtype is a breaking change.
- **A network failure resolves as a response with `statusCode: 0`; it does not reject.** Both
  transports do this so the interceptor chain can map it to `NetworkOrCORSError` uniformly.
- **`HttpStatusInterceptor` deliberately lets two 404 bodies through as successes** — the Locus and
  App API redirect codes in `src/interceptors/http-status.js`. Do not "fix" these into rejections.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/http-core test:unit`
2. `yarn workspace @webex/http-core test:style`
3. `yarn workspace @webex/http-core test:integration` (requires a local fixture server and provisioned test users)

Testing rules:

- Add or update tests for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Mirror a transport change in both Node and browser tests where the behavior is shared.

This package defines no coverage threshold; the repository owner confirmed there is no coverage gate
for it. Do not infer one from a platform or CI default.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output.
- Prefer small, composable functions over large procedural blocks.
- Make error handling explicit at system boundaries.
- Keep public interfaces stable unless a breaking change is requested.
- Before adding a literal path, filename, command, workflow identifier, status,
  or other policy value, search the repository for exact and semantically
  equivalent uses. When repeated production values represent one shared
  contract, move them to the narrowest owning shared module or catalog as one
  canonical named constant, enum, or type and update consumers. Keep incidental
  similarities, one-off implementation details, and independent test fixtures
  local.
- Do not import a default, named, object, or namespace binding and immediately
  re-export it. Consumers should import from the owning module; package barrels
  should use direct named re-exports.
- Do not write inline runtime `typeof` checks outside descriptively named guard
  implementations. Import and reuse the owning guard instead; TypeScript
  type-position `typeof` queries remain allowed.

Pattern example:

```text
Preferred:
- Validate external input close to the boundary.
- Return typed/structured results.
- Include actionable error messages.

Avoid:
- Passing unvalidated payloads deep into the system.
- Swallowing exceptions or returning ambiguous null values.
```

## 6. Git Workflow

- Branch naming: `[feature|fix|chore]/[short-description]`
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
- Security-sensitive changes (auth, encryption, secrets handling) — this package builds
  `Authorization` headers and controls cookie credentials.
- Any destructive data or infrastructure operation.
- Changing an `HttpError` subtype name or its position in the subtype tree.

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
