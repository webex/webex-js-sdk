<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-09-30T05:28:59Z
validation_status: pass
-->

# AI Agent Instructions

Agent entry for the `@webex/media-helpers` package inside the `webex-js-sdk` monorepo. Commands in
this file are run from the monorepo root unless stated otherwise.

## Working Method

- Read the relevant repository files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, or behavior. Verify them from repository-local source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- `docs/index.md` for repository documentation navigation;
- `docs/architecture.md` for repository boundaries and interactions;
- `docs/specs/README.md` for the manifest-backed module and contract registry;
- the affected module's manifest-routed `docs/README.md`; and
- `docs/adr/index.md` plus applicable concrete ADRs for durable decisions.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. Published
repository-owned HTTP APIs use their linked OpenAPI document; internal HTTP surfaces may link route
code, and published SDKs use their ecosystem-native API artifact. The manifest remains authoritative
for canonical paths and artifact decisions.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing.

| Task                   | Command                                             |
| ---------------------- | --------------------------------------------------- |
| Install dependencies   | `yarn install` (monorepo root)                      |
| Start dev environment  | Not applicable — this package is a library with no runnable dev server |
| Run tests              | `yarn workspace @webex/media-helpers test:unit`     |
| Run linters            | `yarn workspace @webex/media-helpers test:style`    |
| Build/release artifact | `yarn workspace @webex/media-helpers build:src`     |
| Format code            | No dedicated command; `test:style` runs `eslint --fix`, which rewrites sources |

There is no runnable full build-with-tests command. `test:broken` in `package.json` chains
`yarn test:integration`, which this package does not define, and no `test/integration` directory
exists. `.sdd/manifest.json` records `commands.build` as `[NEEDS HUMAN INPUT]` for this reason. Do
not treat `test:broken` as a working gate and do not substitute another command for it.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web media engineering assistant for `@webex/media-helpers`.

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

| Area             | Tooling                        | Version                                              |
| ---------------- | ------------------------------ | ---------------------------------------------------- |
| Language runtime | Node.js                        | `>=18` per `package.json` engines; the monorepo `AGENTS.md` instructs contributors to use 22.14 |
| Language         | TypeScript                     | Inherited from the monorepo root `tsconfig.json`     |
| Build tool       | `webex-legacy-tools` plus `tsc` | `@webex/legacy-tools` at `workspace:*`               |
| Test framework   | Jest via `@webex/jest-config-legacy` | `workspace:*`                                   |
| Lint/format      | ESLint via `@webex/eslint-config-legacy`; Prettier | `eslint ^8.24.0`, `prettier ^2.7.1`|

### Project Map

- `src/index.ts`: the published entry point; a barrel that re-exports the stream surface, the
  media-effects surface from `@webex/web-media-effects`, and the constants.
- `src/webrtc-core.ts`: the substantive module; subclasses the `internal-media-core` local stream
  classes to add server-mute authority and unmute gating, and wraps the stream factory functions.
- `src/constants.ts`: `FacingMode`, `DisplaySurface`, and the `PresetCameraConstraints` resolution
  presets.
- `test/unit/spec/webrtc-core.js`: the only test suite; it pins the mute state machine and the
  argument shape every factory function forwards.
- `docs/`: the canonical SDD documentation tree for this package.

### Critical Constraints

- `setUnmuteAllowed` and `setServerMuted` are marked `@internal` and the monorepo root
  `tsconfig.json` sets `stripInternal: true`, so they are absent from the published declarations
  while `@webex/plugin-meetings` calls them in-repo. Changing either signature is an in-repo
  breaking change that the published type surface will not warn you about.
- `setUserMuted(false)` throws when unmute is not allowed. Callers must gate on `isUnmuteAllowed()`.
  Do not soften this into a silent no-op.
- `_LocalMicrophoneStream` and `_LocalCameraStream` hold deliberately duplicated logic. Changing one
  without the other silently diverges audio and video mute behavior.
- The package re-exports upstream effects rather than implementing them. Version changes to
  `@webex/internal-media-core` or `@webex/web-media-effects` are exact pins and move the public
  surface.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/media-helpers test:unit`
2. `yarn workspace @webex/media-helpers test:style`
3. Not applicable — this package has no integration or end-to-end suite.

Testing rules:

- Add or update tests for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- `test/unit/spec/webrtc-core.js` is the characterization baseline recorded in `.sdd/manifest.json`.
  Treat a change in its assertions as a behavior change that needs a spec update.

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
- Security-sensitive changes (auth, encryption, secrets handling).
- Any destructive data or infrastructure operation.
- Changing the `@internal` mute API, which crosses into `@webex/plugin-meetings`.
- Moving the exact pinned versions of `@webex/internal-media-core` or `@webex/web-media-effects`.

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
