<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rsarika@cisco.com
updated_at: 2026-09-23T07:36:44Z
validation_status: not-run
-->

# AI Agent Instructions

Instructions for AI coding assistants working in `@webex/storage-adapter-spec`.

This package is the shared, executable conformance suite for Webex storage adapters. It holds no test
file of its own: it *is* the test suite, exported as a function that sibling workspace packages invoke
inside their own test runs. Changing anything here changes the contract every storage adapter must
satisfy.

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
| Install dependencies   | `yarn install` (run from the workspace root) |
| Start dev environment  | Not applicable — this package has no runnable process; it is a library consumed by other packages' test suites. |
| Run tests              | `yarn workspace @webex/webex-core test:unit --targets storage/storage-adapter.js` — runs this package's suite; verified 21/21 on 2026-09-23 |
| Run linters            | `yarn workspace @webex/storage-adapter-spec test:style` |
| Build/release artifact | `yarn workspace @webex/storage-adapter-spec build` |
| Format code            | Not applicable — no dedicated format script; `prettier` is a devDependency used through lint tooling. |

If a required command is unknown, stop and ask for the exact command.

Three commands must not be used to verify a change:

- `test` invokes `test:unit` and `test:integration`, neither of which this package defines. It fails
  after the lint step. This is a known stale aggregate script, not a missing dependency.
- `test:browser` is defined, but there is no test file in this package for a browser runner to
  collect.
- `yarn workspace @webex/storage-adapter-local-storage test:unit` **looks** like it verifies the suite
  and exits zero, but that consumer wraps its call in a Node skip: measured 2026-09-23, it reported 21
  tests and skipped all 21. The same is true of the local-forage and session-storage adapters. Do not
  treat a green run from any of them as evidence.

## 2. Agent Persona and Scope

You are the Webex JS SDK storage engineering assistant for `@webex/storage-adapter-spec`.

Primary outcomes:

- Deliver production-safe changes with passing tests.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests/lint/build checks pass locally.
3. Updated docs/config cover new behavior.
4. PR summary includes risks and rollback notes.

For this package, step 2 means running the sibling `@webex/webex-core` storage test, because this
package holds no test file of its own.

## 3. Repository Knowledge

### Tech Stack

Document concrete versions so assistants choose compatible APIs.

| Area             | Tooling     | Version     |
| ---------------- | ----------- | ----------- |
| Language runtime | Node.js     | `>=18` (declared in `package.json` `engines`) |
| Build tool       | `webex-legacy-tools build` via `@webex/legacy-tools`, configured by `babel.config.js` | `workspace:*` |
| Test framework   | None in this package. The suite is written against Jest globals (`describe`, `it`, `beforeAll`) and asserts through `@webex/test-helper-chai`. | `workspace:*` |
| Lint/format      | ESLint via `@webex/eslint-config-legacy`, with `prettier` | `eslint ^8.24.0`, `prettier ^2.7.1` |

### Project Map

- `src/index.js`: the entire module — the default-exported conformance suite. This is the contract.
- `package.json`: the published surface (`main`, `devMain`), commands, dependencies, and the browser
  build transform.
- `process`: declares `{browser: true}`, marking this package as browser-targeted.
- `.eslintrc.js`, `babel.config.js`, `jest.config.js`: package-local toolchain configuration; each is
  a thin re-export of a workspace configuration package.
- `dist/`: build output produced by `build:src`. Never edit it; it is git-ignored and regenerated.

### Critical Constraints

- **Every assertion in `src/index.js` is a contract clause.** Adding, removing, or loosening one
  changes what every Webex storage adapter must implement. Four sibling packages consume this suite,
  so a change here can break adapters that this package's own commands will never exercise.
- **Only one consumer verifies the contract under Node.** `@webex/webex-core` runs it; the three
  browser-backed adapters skip under Node and only exercise it in a browser runner.
- **The suite injects test declarations into the caller's runner.** It calls `describe`, `it`, and
  the Jest-specific `beforeAll` when invoked, rather than exporting assertions the caller composes.
  Consumers must therefore run it under a runner that provides those globals.
- **Backward compatibility of the default export.** `runAbstractStorageAdapterSpec(adapter)` is
  published to npm; its parameter shape and invocation style are a public API.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/storage-adapter-spec test:style` — the only verification command this
   package owns.
2. `yarn workspace @webex/storage-adapter-spec build` — confirms the source still transpiles.
3. `yarn workspace @webex/webex-core test:unit --targets storage/storage-adapter.js` — the only Node
   route that actually executes the suite. Confirm the output says 21 passed, not 21 skipped.

Testing rules:

- Add or update tests for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.

In this package, "add a test" means adding a case to the exported suite, which adds a requirement to
every adapter. Confirm that all consumers can satisfy a new case before adding it — and check the run
output, since three of the four consumers skip silently under Node.

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

State in the PR which consumer packages were run and how many cases actually executed, since this
package's own commands cannot execute the suite and three consumers skip under Node.

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
- Adding, removing, or weakening any assertion in `src/index.js`, because it changes the contract for
  every consuming adapter.

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
- Edit `dist/`; it is generated from `src/` and git-ignored.
