<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-09-21T08:58:59Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Root agent entry for the `@webex/common` package. The monorepo root `AGENTS.md` (four levels up)
governs the wider Webex JS SDK workspace and stays authoritative for workspace-wide setup.

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
- the affected module's manifest-routed specification at [`src/docs/README.md`](src/docs/README.md); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs for durable decisions.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is the ecosystem-native package manifest plus the
`src/index.js` barrel; no OpenAPI applies. The manifest remains authoritative for canonical paths
and artifact decisions.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run from the
monorepo root.

| Task                   | Command             |
| ---------------------- | ------------------- |
| Install dependencies   | `yarn install` (workspace root) |
| Start dev environment  | N/A — library package with no runnable dev server |
| Run tests              | `yarn workspace @webex/common test:unit` |
| Run linters            | `yarn workspace @webex/common test:style` |
| Build/release artifact | `yarn workspace @webex/common build:src` |
| Format code            | N/A — no format script; `prettier` is a devDependency invoked through eslint |

Do not use the package's aggregate `test` script. It chains `test:integration` and `test:browser`,
neither of which is defined in `package.json`, so it always fails after the unit tier passes.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web SDK engineering assistant for `@webex/common`.

Primary outcomes:

- Deliver production-safe changes with passing tests.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests/lint/build checks pass locally.
3. Updated docs/config cover new behavior, including [`src/docs/README.md`](src/docs/README.md).
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling     | Version     |
| ---------------- | ----------- | ----------- |
| Language runtime | node        | `>=16` (`package.json` engines) |
| Build tool       | `@webex/legacy-tools` over babel | `@babel/core` `^7.17.10` |
| Test framework   | jest via `@webex/jest-config-legacy` | workspace |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/`: the module. Flat barrel of single-purpose helpers; `src/index.js` is the public surface.
- `src/in-browser/`: build-time browser/node boolean selected by the `package.json` browser field.
- `src/docs/README.md`: the canonical module specification.
- `test/unit/spec/`: jest unit specs, covering 8 of 25 source files.
- `dist/`: generated build output. Never edit by hand.
- `docs/`: repository standing documentation.

### Critical Constraints

- Never import `@webex/*` from `src/` at runtime. This package is the bottom of the workspace
  dependency graph; an import creates a cycle for its 33 dependent packages. No automated check
  enforces this.
- The barrel is the public surface. Every public symbol is re-exported from `src/index.js`.
  Removing or renaming one breaks up to 104 import sites across 33 packages; adding is safe.
- Two encodings are frozen and unversioned: the `ciscospark://` Hydra identifier format
  (`src/uuid-utils.js`) and the OAuth state encoding (`src/oauth-state.js`). Consumers persist both.
- The package runs in both Node and the browser. Runtime-specific code belongs in `src/in-browser/`.
- Most files have no tests. Pin current behavior with a characterization test before modifying an
  untested file.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/common test:unit`
2. `yarn workspace @webex/common test:style`
3. N/A — no integration or browser tier exists in this package.

Testing rules:

- Add or update tests for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets
  `root: true`, so config is not inherited from the monorepo above this package.
- Prefer small, composable functions over large procedural blocks.
- Make error handling explicit at system boundaries.
- Keep public interfaces stable unless a breaking change is requested.
- Before adding a literal path, filename, command, or other policy value, search for existing
  equivalents. Shared constants belong in `src/constants.js`; shared regexes in `src/patterns.js`.
- Do not import a binding and immediately re-export it from a non-barrel module. `src/index.js` is
  the one barrel and uses direct named re-exports.
- Do not write inline runtime `typeof` checks outside named guard implementations. Reuse
  `src/isBuffer.js` and `src/check-required.js` where they apply.

Pattern example:

```text
Preferred:
- Validate external input close to the boundary (see src/check-required.js).
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
- Risk/impact areas, including which of the 33 dependent packages a surface change reaches.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update [`src/docs/README.md`](src/docs/README.md) in the same change that alters observable
  behavior: the export surface, a failure mode, an encoding, or an invariant.

### Ask First

- Adding new dependencies or external services. This package deliberately has only seven runtime
  dependencies, none of them Webex-owned.
- Large refactors of the barrel, or any export removal or rename.
- Security-sensitive changes, especially `src/oauth-state.js`.
- Changing the Hydra or OAuth state encodings.

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
- Fix the known defects listed in [`src/docs/README.md`](src/docs/README.md) as a side effect of
  unrelated work. `createEventEnvelope` resolving `undefined` on failure is an observable contract;
  changing it needs its own change.
