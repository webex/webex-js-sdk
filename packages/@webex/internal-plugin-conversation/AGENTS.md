<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-10-16T01:43:45Z
validation_status: pass
-->

# AI Agent Instructions

Package-level agent entry for `@webex/internal-plugin-conversation`, the internal Webex JS SDK
plugin for the Conversation service. It is an internal Cisco Webex plugin, so it does not strictly
adhere to semantic versioning; external developers should use the public plugins instead.

## Scope of this file

This file covers **only** `packages/@webex/internal-plugin-conversation`. The repository-root
`AGENTS.md` owns monorepo-wide rules — the Node 22.14 toolchain, workspace command forms, test
`--targets` usage, test-writing guidelines, refactoring guidance, and the pattern-search procedure —
and stays authoritative for them. Read it first; this file adds package-specific facts.

The SDD templates for this package are the repository-root `.sdd/templates/repo-standards/`
snapshot; there is no package-level template copy. For local SDD validation, the package path
`.sdd/templates/repo-standards` is an untracked relative symlink to that shared snapshot so the
checkers resolve it when run with `--repo-root` set to this package. Recreate this local alias
when setting up a new checkout; its target is `../../../../../.sdd/templates/repo-standards`.
Keep the symlink out of commits and do not replace it with a package-level template copy.

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
- the affected module's manifest-routed `src/docs/README.md`; and
- `docs/adr/index.md` plus applicable concrete ADRs for durable decisions.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
owns no HTTP API: it consumes the externally owned conversation and files services and publishes an
SDK surface, so contracts stay on ecosystem-native artifacts and no OpenAPI document is selected.
The manifest remains authoritative for canonical paths and artifact decisions.

`src/activity-threading.md` is a retained, superseded design note. Use `src/docs/README.md` instead.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing.

| Task                   | Command             |
| ---------------------- | ------------------- |
| Install dependencies   | `yarn install` (from the monorepo root) |
| Start dev environment  | Not applicable — this is a library, not a runnable app |
| Run tests              | `yarn workspace @webex/internal-plugin-conversation test:unit` |
| Run linters            | `yarn workspace @webex/internal-plugin-conversation test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-conversation build:src` |
| Format code            | No package format script; Prettier ^2.7.1 runs through the repository configuration |

Run a single unit file with `--targets <path relative to test/unit/spec>`, for example
`yarn workspace @webex/internal-plugin-conversation test:unit --targets share-activity.js`.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/internal-plugin-conversation`.

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

Importing the package registers `webex.internal.conversation` and its payload transforms. Methods
build plaintext activities; encryption happens in the outbound payload transform and decryption in
the inbound one, through `@webex/internal-plugin-encryption` and KMS.

### Tech Stack

| Area             | Tooling     | Version     |
| ---------------- | ----------- | ----------- |
| Language runtime | Node.js     | Develop on 22.14 per the root `AGENTS.md`; `package.json` declares `engines.node >=18` |
| Build tool       | `webex-legacy-tools` (Babel via `@webex/babel-config-legacy`) | workspace |
| Test framework   | Jest via `@webex/jest-config-legacy`; integration specs via the workspace runner | workspace |
| Lint/format      | ESLint `^8.24.0`, Prettier `^2.7.1` | see `package.json` |

### Project Map

- `src/index.js`: registers the plugin and its payload-transformer predicates and normalize transforms; package exports.
- `src/conversation.js`: the `Conversation` plugin and every public method, including thread ordering.
- `src/encryption-transforms.js` / `src/decryption-transforms.js`: outbound and inbound crypto transforms.
- `src/share-activity.js`: `ShareActivity` file and GIF share builder.
- `src/activities.js`, `src/activity-thread-ordering.js`: thread-ordering helpers.
- `src/config.js`: configuration defaults under `webex.config.conversation`.
- `src/docs/README.md`: the canonical module specification.

### Critical Constraints

- Every new verb must go through `prepare` and `submit`; every new objectType or verb needs its
  named transform, because a missing transform name is silently skipped and the payload goes out
  unencrypted.
- Never log decrypted conversation content; existing warnings log only error reasons and URLs.
- Keep the reaction HMAC input order (`k`, `kid`, `kty`, parent id, display name) unchanged; other
  clients must compute the same value.
- Exports in `src/index.js` are consumed by many workspace packages; treat renames as breaking.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-conversation test:unit` (97 cases, all passing)
2. `yarn workspace @webex/internal-plugin-conversation test:style`
3. `yarn workspace @webex/internal-plugin-conversation test:browser` — integration specs under
   `test/integration/spec`; they need live Webex test users.

Testing rules:

- Add or update tests for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.

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

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
