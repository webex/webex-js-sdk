<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-10-28T14:58:37Z
validation_status: pass
-->

# AI Agent Instructions

Instructions for AI coding assistants working in `@webex/internal-plugin-wdm`, a package of the Webex JS SDK
monorepo. The package is a deprecated alias that re-exports `@webex/internal-plugin-device`. The monorepo root has
its own `AGENTS.md`; this file adds the package-specific rules and does not replace it.

## Working Method

- Read the relevant repository files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, or behavior. Verify them from repository-local source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for repository documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for repository boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the affected module's manifest-routed spec, [`src/docs/README.md`](src/docs/README.md); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs for durable decisions.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package owns no
HTTP API: its published surface is the npm package declared in `package.json`. Behavior behind the re-exports is
specified by the device package (the module specification in the device package's own `src/docs/README.md`, outside this package).
The manifest remains authoritative for canonical paths and artifact decisions.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run them from the monorepo root.
Use Node.js 22.14 for repository work (`nvm use 22.14`, from the monorepo root `AGENTS.md`).

| Task                   | Command                                                                       |
| ---------------------- | ----------------------------------------------------------------------------- |
| Install dependencies   | Not defined in this package; installed by the monorepo root workspace         |
| Start dev environment  | Not applicable: a library with no process to start                            |
| Run tests              | `yarn workspace @webex/internal-plugin-wdm test:unit`                         |
| Run linters            | `yarn workspace @webex/internal-plugin-wdm test:style`                        |
| Build/release artifact | `yarn workspace @webex/internal-plugin-wdm build:src`                         |
| Format code            | Not defined in this package (Prettier is a dev dependency without a script)   |

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/internal-plugin-wdm`.

Primary outcomes:

- Deliver production-safe changes with passing tests.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests/lint/build checks pass locally.
3. Updated docs/config cover new behavior, including the module spec when a requirement or the export list changes.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling                                             | Version                                              |
| ---------------- | --------------------------------------------------- | ---------------------------------------------------- |
| Language runtime | Node.js, browser                                    | `>=16` (`engines` in `package.json`)                 |
| Build tool       | `@webex/legacy-tools` (`webex-legacy-tools build`)  | Workspace-pinned                                     |
| Test framework   | Jest (unit), Mocha through Karma (integration), Chai | Jest and Chai workspace-supplied; see `package.json` |
| Lint/format      | ESLint, Prettier                                    | `^8.24.0`, `^2.7.1`                                  |

### Project Map

- `src/index.js`: the only source file; re-exports the device plugin
- `src/docs/README.md`: the canonical module specification
- `test/unit/spec/` and `test/integration/spec/`: a placeholder unit test and an integration test
- `docs/`: package architecture, getting started, registry, and ADRs
- `.sdd/manifest.json`: machine-readable SDD manifest; `.repo-context.json`: operational context for agents
- `README.md`: the package's own deprecation notice and usage text (kept separate from the generated docs)

### Critical Constraints

- This package is a deprecated alias. Put behavior changes in `@webex/internal-plugin-device`; do not add logic,
  state, or a `registerInternalPlugin` call here.
- Importing this package must keep loading the device plugin so `webex.internal.device` exists; the package
  defines no `webex.internal.wdm`.
- Keep the re-export list in `src/index.js` in step with the module spec (`MOD-002`, `MOD-003`); the device package
  also exports `CatalogDetails` and `DeviceRegistrationOptions`, which the alias does not.
- `src/index.js` imports bindings and then re-exports them; do not copy that pattern into new code.
- The package is an internal plugin: semantic versioning is not strictly followed, but dependents can still break.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-wdm test:unit` (the only unit test asserts `true`; it proves nothing about the alias)
2. `yarn workspace @webex/internal-plugin-wdm test:style`
3. `yarn workspace @webex/internal-plugin-wdm test:browser` when integration behavior changes (needs provisioned Webex test users)

The `test` script in `package.json` chains `test:integration`, which is not defined, so run the scripts above individually.

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

- Branch naming: follow the monorepo root conventions; this package defines none of its own.
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), as enforced by the monorepo root commit lint configuration.
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
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and `.sdd/manifest.json` refers to them.
