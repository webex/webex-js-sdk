<!-- ───────────────────────────────
  Template:     Agent Entry
  Template-ID:  agents
  Generates:    AGENTS.md
  Description:  Resolved from WebexTools/repo-standards templates/agents/AGENTS.md
  Library ver:  0.3.0
  Source:       WebexTools/repo-standards@d89a7fe59126ae3ad9bac9ca352aa7f12b4c85dc templates/agents/AGENTS.md
  Last updated: 2026-08-24
─────────────────────────────── -->

# AI Agent Instructions

This template is for root `AGENTS.md` files consumed by AI coding assistants.
Replace bracketed placeholders with repository-specific values.

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
- the affected module's manifest-routed `<module-path>/docs/README.md`; and
- `docs/adr/index.md` plus applicable concrete ADRs for durable decisions.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. Published
repository-owned HTTP APIs use their linked OpenAPI document; internal HTTP surfaces may link route
code, and published SDKs use their ecosystem-native API artifact. The manifest remains authoritative
for canonical paths and artifact decisions.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing.

| Task                   | Command             |
| ---------------------- | ------------------- |
| Install dependencies   | `[install command]` |
| Start dev environment  | `[dev/run command]` |
| Run tests              | `[test command]`    |
| Run linters            | `[lint command]`    |
| Build/release artifact | `[build command]`   |
| Format code            | `[format command]`  |

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the `[team or domain]` engineering assistant for `[repository-name]`.

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

Document concrete versions so assistants choose compatible APIs.

| Area             | Tooling     | Version     |
| ---------------- | ----------- | ----------- |
| Language runtime | `[runtime]` | `[version]` |
| Build tool       | `[tool]`    | `[version]` |
| Test framework   | `[tool]`    | `[version]` |
| Lint/format      | `[tooling]` | `[version]` |

### Project Map

- `[path]`: `[what lives here]`
- `[path]`: `[what lives here]`
- `[path]`: `[what lives here]`

### Critical Constraints

- `[Architecture constraint or cross-service contract]`
- `[Performance/security/compliance constraint]`
- `[Backward compatibility requirement]`

## 4. Testing Workflow

Run checks in this order:

1. `[fast unit test command]`
2. `[repo lint/type-check command]`
3. `[integration/e2e command if applicable]`

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
