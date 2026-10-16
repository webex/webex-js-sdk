<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-15T14:22:13Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-flag`, the internal plugin registered as
`webex.internal.flag` in the Webex JS SDK. It flags conversation activities for the current user,
lists and changes those flags, and maps flags back to their activities. This file orients agents.
The monorepo root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, request shapes, or field names. Verify them from this
  package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (Flag plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` barrel.
It serves no HTTP API, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn install` (workspace root) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/internal-plugin-flag test:unit` (Jest); `yarn workspace @webex/internal-plugin-flag test:browser` (Mocha specs run by the karma runner, the integration tier). No `test:integration` script exists |
| Run linters            | `yarn workspace @webex/internal-plugin-flag test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-flag build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

Use the individual scripts rather than the aggregate `test` script, and complete the First-run
verification precondition and build before `test:unit`; both are explained in
[`docs/getting-started.md`](docs/getting-started.md). This package uses two of the manifest test
tiers: unit (Jest) and integration (Mocha specs run by the karma browser runner).

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web SDK engineering assistant for `@webex/internal-plugin-flag`.

Primary outcomes:

- Deliver production-safe changes with unit tests and lint passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests, lint, and build checks pass locally.
3. Updated docs cover new behavior, including the module spec.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | node | 22.14 for development (workspace root `AGENTS.md`); consumer floor: see [`docs/getting-started.md`](docs/getting-started.md) Prerequisites |
| Package manager  | Yarn through Corepack | 3.4.1, pinned by the workspace root `packageManager` field and run from the `.yarnrc.yml` `yarnPath` release |
| Build tool       | `@webex/legacy-tools` over babel | `@babel/core` `^7.17.10` |
| Test framework   | Jest via `webex-legacy-tools` (`test:unit`); Mocha with Chai assertions, run by the karma runner (`test:browser`) | workspace versions; `mocha` `^10.2.0` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: imports the conversation and device plugins, registers internal plugin `flag`
  with the config and an empty payload transformer, and re-exports `Flag` as default.
- `src/flag.js`: the `Flag` plugin and its six methods. Spec: `src/docs/README.md`.
- `src/config.js`: the empty `flag` config.
- `test/unit/spec/flag.js`: the only Jest spec.
- `test/integration/spec/flag.js`: live spec, collected by `test:browser` in this package.
- Build output from `build:src`: generated. Never edit by hand.
- `README.md`: retained product readme. It is not the behavioral authority.

### Critical Constraints

- Keep the activity host check in `mapToActivities` (`INV-003`) and its SECURITY unit cases.
- Keep the `url`-required guards (`INV-002`) ahead of every request built from caller data.
- Known defects, such as the ignored `options` argument and the unguarded `activity.target`, are
  recorded in the module spec Pitfalls and Caller-visible failure modes. Fix them only in a
  dedicated change with a test.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-flag build`
2. `yarn workspace @webex/internal-plugin-flag test:unit`
3. `yarn workspace @webex/internal-plugin-flag test:style`

The integration tier (`test:browser`) is not in this order; see
[`docs/getting-started.md`](docs/getting-started.md) Tests.

Testing rules:

- Add or update unit cases for every behavior change.
- Stub `webex.internal.services` the way the existing `mapToActivities` cases do when testing the
  host check.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`.
- Prefer small, composable functions over large procedural blocks.
- Make error handling explicit at system boundaries.
- Keep public interfaces stable unless a breaking change is requested.
- Before adding a literal path, state value, or service name, search the package for existing uses.
- Do not import a binding and immediately re-export it; the barrel uses a direct re-export.
- Do not write inline runtime `typeof` checks outside descriptively named guard implementations.

Pattern example:

```text
Preferred:
- Check the required url field and return a rejected promise before building the request.
- Keep the services-plugin host check before the bulk fetch in `mapToActivities` (`INV-003`).

Avoid:
- Sending the bulk fetch to a URL built from `flag-item` without the host check. (`archive`,
  `unflag`, and `delete` send to `flag.url` without one today; adding a check is a separate,
  tested behavior change.)
- Passing request settings through the options argument and expecting them to apply.
```

## 6. Git Workflow

- Branch naming: no convention is defined in this package or in the workspace `CONTRIBUTING.md`.
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), which
  the workspace `CONTRIBUTING.md` requires for pull requests.
- Keep commits focused and reversible.
- Rebase on the target branch before opening a pull request.

PR checklist:

- What changed and why.
- Tests run and results.
- Risk and impact, including effects on webex-server and recipe-private-web-client, which import
  this package.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies or external services.
- Large refactors or schema migrations.
- Security-sensitive changes (auth, encryption, secrets handling), including the activity host check
  in `mapToActivities` and any change to how `flag.url` requests are sent.
- Any destructive data or infrastructure operation.
- Changing an export, a method name, or the plugin name.

### Never

- Edit build output by hand.
- Commit secrets, tokens, keys, or credentials, including in test fixtures.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
- Copy template bodies or `template-map.json` into this package, or commit anything under
  `.sdd/templates/`. The repository-root `.sdd/templates/repo-standards` snapshot is the template
  source for this package. The Repo Annotation checkers and validator expect a temporary, uncommitted
  local symlink to it at `.sdd/templates/repo-standards`, which is removed before a PR.
