<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-09-28T05:34:36Z
validation_status: pass
-->

# AI Agent Instructions

Instructions for AI coding assistants working on `@webex/common-timers`, the package that owns the
Webex JS SDK's timer primitives.

## Working Method

- Read the relevant repository files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, or behavior. Verify them from repository-local source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries, dependencies, and the
  contract index;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract
  registry;
- [`src/docs/README.md`](src/docs/README.md) — the module specification, and the document that
  matters most here: it owns the public surface, the `Timer` state machine, every caller-visible
  failure mode, and the known test gaps; and
- [`docs/adr/index.md`](docs/adr/index.md) for durable decisions. None are registered yet; the
  design decisions behind the current shape live in the module spec's `Key design trade-off`.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes one contract, `common-timers-sdk`, an npm package surface whose native source is the entry
point declared in `package.json`; there is no OpenAPI document because the package serves no HTTP.
The manifest remains authoritative for canonical paths and artifact decisions.

## 1. Commands (Run First)

Run every command from the Webex JS SDK workspace root. Use only documented commands; do not invent
alternatives when a command is missing.

| Task                   | Command                                             |
| ---------------------- | --------------------------------------------------- |
| Install dependencies   | `yarn install`                                      |
| Start dev environment  | N/A — the package is a library with no runnable entry point |
| Run tests              | `yarn workspace @webex/common-timers test:unit`     |
| Run linters            | `yarn workspace @webex/common-timers test:style`    |
| Build/release artifact | `yarn workspace @webex/common-timers build:src`     |
| Format code            | N/A — no package-local format command; Prettier configuration is owned at the workspace root |

Do not run `yarn workspace @webex/common-timers test`. The aggregate `test` script chains
`test:integration` and `test:browser`, and this package declares neither, so the command cannot
succeed. If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the SDK foundation-utilities engineering assistant for `@webex/common-timers`.

Primary outcomes:

- Deliver production-safe changes with passing tests.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. `test:unit` and `test:style` pass locally.
3. Updated docs cover new behavior — a behavior change updates `src/docs/README.md` in the same
   commit.
4. PR summary includes risks and rollback notes, naming every dependent package the change could
   affect.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling                                             | Version                                    |
| ---------------- | --------------------------------------------------- | ------------------------------------------ |
| Language runtime | Node.js                                             | `>=18` per `package.json` `engines`        |
| Language         | TypeScript source, transpiled by Babel              | No local `tsconfig.json` and no TypeScript dependency; declarations are emitted by the `-ts` flag of the build command |
| Build tool       | `webex-legacy-tools` via `@webex/legacy-tools`      | `workspace:*`                              |
| Test framework   | jest via `@webex/jest-config-legacy`, with sinon fake timers | `workspace:*`                     |
| Lint             | eslint via `@webex/eslint-config-legacy`            | eslint `^8.24.0`                           |
| Format           | prettier                                            | `^2.7.1` (declared, no local script)       |

### Project Map

- `src/index.ts`: the entire module — `safeSetTimeout`, `safeSetInterval`, and `Timer`. There is no
  other source file.
- `src/docs/README.md`: the module specification. Update it in the same change that alters behavior.
- `test/unit/spec/index.ts`: intended-behaviour tests mirroring `src/`. 13 jest cases, and the only
  test file in the package. This module has no characterization baseline.
- `docs/`: package-wide standing documentation (index, architecture, getting started, spec registry,
  ADR index).
- `.sdd/`: the SDD manifest and the hidden Repo Standards template snapshot. Never publish templates
  from here into `docs/`.
- `process`: a one-line browser shim resolved by the browserify transform when bundling for a browser.
- `jest.config.js`, `babel.config.js`, `.eslintrc.js`: two-line files that re-export shared workspace
  configuration. There is no package-local knob — changing build, lint, or test behavior means
  changing the shared config.

### Critical Constraints

- **Every timer created through this package is unref-ed where the platform supports it.** That is
  the package's entire reason to exist. Never add a code path that returns a handle without the
  capability check, and never add an opt-out without treating it as a breaking change.
- **`unref` is feature-detected on the handle, never inferred from the platform.** One module and one
  build serve both Node and the browser. Do not introduce a platform branch, a conditional export, a
  `browser` field, or a polyfill.
- **The exported surface is consumed by eleven workspace packages plus external npm consumers.** Any
  change to `safeSetTimeout`, `safeSetInterval`, or `Timer` — including the `number | NodeJS.Timeout`
  return union — is a breaking change until proven otherwise.
- **Do not size that blast radius from `package.json` files alone.** The declared and importing sets
  differ in both directions: `@webex/internal-plugin-scheduler` declares the dependency but never
  imports it, and `@webex/plugin-meetings` imports both wrappers in `src/meeting/index.ts` without
  declaring the dependency at all. Grep the source for `@webex/common-timers` as well as reading
  manifests, or you will miss a real consumer. Do not "fix" the missing `plugin-meetings`
  declaration as a side effect of work in this package — raise it with that package's owners.
- **`Timer` throws on every invalid transition, and `done` is terminal.** Do not soften a throw into
  a no-op; consumers rely on the failure being loud. The thrown message wording is asserted by
  regular expression in the unit suite and is part of the contract.
- **`reset()` restores the full timeout, not the remaining time.** It is an idle deadline. Do not
  "fix" it into a pause/resume.
- **The package has zero runtime dependencies.** Adding one changes the package's architectural
  character and must be escalated, not assumed.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/common-timers test:unit`
2. `yarn workspace @webex/common-timers test:style`
3. N/A — the package declares no integration or end-to-end tier.

Testing rules:

- Add or update tests for every behavior change.
- Cover failure paths and edge cases, not only happy paths. Every rejected `Timer` transition already
  has a test; keep it that way.
- Use `sinon.useFakeTimers()` to control time, as the existing suite does. Do not introduce real
  waits. If you add `unref` assertions, note that sinon's fake handles expose `unref()` but no
  observable ref state, so such a test must restore the clock and assert `hasRef()` on a real handle.
- **The `unref` contract is not covered by any test.** Removing the `unref()` call from
  `src/index.ts` leaves the suite green, so a green run does not prove the package still does the one
  thing it exists for. Verify that behaviour by reading `src/index.ts` until assertions exist.
- **Rebuild before trusting a green run.** The suite imports the package by name, which resolves
  through `main` to `dist/`. It validates the built artifact, so run
  `yarn workspace @webex/common-timers build:src` after a source change or you will be testing the
  previous build.
- Do not remove tests to make CI pass.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output.
- Prefer small, composable functions over large procedural blocks.
- Make error handling explicit at system boundaries.
- Keep public interfaces stable unless a breaking change is requested.
- Before adding a literal path, filename, command, workflow identifier, status, or other policy
  value, search the repository for exact and semantically equivalent uses. When repeated production
  values represent one shared contract, move them to the narrowest owning shared module or catalog as
  one canonical named constant, enum, or type and update consumers. Keep incidental similarities,
  one-off implementation details, and independent test fixtures local.
- Do not import a default, named, object, or namespace binding and immediately re-export it.
  Consumers should import from the owning module; package barrels should use direct named re-exports.
- Do not write inline runtime `typeof` checks outside descriptively named guard implementations.
  Import and reuse the owning guard instead; TypeScript type-position `typeof` queries remain
  allowed. The existing `if (timer.unref)` capability check is a deliberate exception: it tests for a
  platform method on a returned handle, not a type.

Pattern example:

```text
Preferred:
- Feature-detect a platform capability on the value you were handed.
- Return the platform handle unchanged so callers keep using clearTimeout/clearInterval.
- Throw with a message that names the operation and the rejecting state.

Avoid:
- Branching on the platform instead of the capability.
- Wrapping or normalizing the handle into a new type.
- Turning an invalid lifecycle call into a silent no-op.
```

## 6. Git Workflow

- Branch naming: `[feature|fix|chore]/[short-description]`
- Commit format: conventional commits scoped to the package, for example
  `fix(common-timers): ...` or `docs(common-timers): ...`. The workspace enforces the format with
  commitlint.
- Keep commits focused and reversible.
- Rebase on the target branch before opening a PR.

PR checklist:

- What changed and why.
- Tests run and results.
- Risk/impact areas — name the dependent packages a surface change reaches.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update `src/docs/README.md` in the same change as a behavior change.

### Ask First

- Adding any runtime dependency — the package currently has none.
- Changing the exported surface, the return type union, or a thrown message.
- Adding a platform branch, conditional export, or polyfill.
- Making `unref` optional or conditional on anything other than the handle's own capability.
- Large refactors of the `Timer` lifecycle.
- Adding validation to the `Timer` constructor. There is a known, already-triaged follow-up here:
  the constructor accepts `undefined`, `null`, `0`, negative numbers and `NaN`, all of which
  produce a timer that fires immediately. It was triaged on 2026-09-24 as fix-separately because
  rejecting those values is breaking for any caller relying on the coercion. If you are picking
  that work up, it needs its own requirement, its own error-mode rows, and tests covering the
  rejected durations — see the module spec's Pitfalls and constraints. No test currently pins the
  present behaviour, so changing it will not turn the suite red on its own.

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
- Publish a Repo Standards template out of `.sdd/templates/` into `docs/`.
