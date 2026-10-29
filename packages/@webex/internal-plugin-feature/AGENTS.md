<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-10-28T08:54:44Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-feature`, the plugin that exposes feature toggles
as `webex.internal.feature`. This file orients agents. The monorepo root `AGENTS.md` governs
workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, config keys, events, or toggle names. Verify them from this
  package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (feature toggle plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` entry, and
its event contract is `src/feature.js`. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; the deploy workflow runs the same command) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/internal-plugin-feature test:unit` (jest) |
| Run linters            | `yarn workspace @webex/internal-plugin-feature test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-feature build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

The `package.json` script `test` chains `test:style`, `test:unit`, and `test:integration`.
`test:integration` is not defined, so that aggregate script is not a verification command.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web SDK engineering assistant for `@webex/internal-plugin-feature`.

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
| Language runtime | node; JavaScript sources | `>=18` (`package.json` engines) |
| Build tool       | `@webex/legacy-tools` over babel | `@babel/core` `^7.17.10` |
| Test framework   | jest via `webex-legacy-tools` (`test:unit`); chai, sinon, mocha helpers, and `@webex/test-helper-mock-webex` | sinon `^9.2.4`, mocha `^10.2.0` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: registers internal plugin `feature` and re-exports the `Feature` class.
- `src/feature.js`: the `Feature` plugin (`getFeature`, `setFeature`, `setBundledFeatures`,
  `updateFeature`, change-event wiring). Spec: `src/docs/README.md`.
- `src/config.js`: the empty `feature` config object.
- `test/unit/spec/feature.js`: the unit spec run by `test:unit`.
- `test/integration/spec/feature.js`: live-service spec that no script runs and that is partly stale.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained product readme. It is not the behavioral authority.

### Critical Constraints

- `Feature` holds no toggle data. Records live in the device plugin's `features` collections
  (`webex.internal.device.features`); write through them with `{merge: true}` and never add a local
  cache.
- Entitlements are read-only from this plugin. Do not make `setFeature`, `updateFeature`, or
  `setBundledFeatures` write the `entitlement` collection.
- Mercury calls `updateFeature` by name on `featureToggle_update`, and other plugins call
  `getFeature` and chain `.then`. Keep both names and the promise return.
- `setBundledFeatures` mutates its input array; keep or document any change to that.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-feature test:unit`
2. `yarn workspace @webex/internal-plugin-feature test:style`

`test:browser:broken` exists in `package.json` as a karma integration runner and is named broken; the
integration spec calls `listen` and `handleFeatureUpdate`, which `Feature` does not define. Do not cite
it as passing evidence.

Testing rules:

- Add or update unit cases for every behavior change. `setBundledFeatures` has no unit case today.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`.
- Prefer small functions over large procedural blocks.
- Make error handling explicit; reject with an `Error` for invalid key types as the code does.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Merge records into webex.internal.device.features[keyType] with {merge: true}.
- Return promises from public reads and writes.
- Add a case next to the matching describe block in test/unit/spec/feature.js.

Avoid:
- Keeping toggle data on the Feature instance.
- Treating README.md as the list of methods.
- Trusting the JSDoc return annotations over the code.
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
- Risk and impact, including Mercury, LLM, board, conversation, and presence callers.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Changing which key types can be read, written, or applied from a push.
- Changing the `feature` service resources or request bodies.
- Security-sensitive changes: anything touching authorization or what is sent to the service.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials, including in test fixtures.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
