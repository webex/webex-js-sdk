<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T06:44:53Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-ediscovery`, the internal `ediscovery` plugin of
the SDK (compliance report calls, report content and container reads, and the payload transforms that
encrypt report requests and decrypt reports, activities, and containers). This file orients agents. The
monorepo root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, or config keys. Verify them from this package's source and
  tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (eDiscovery plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` entry. It
serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; the deploy workflow runs the same command); on a fresh checkout run `yarn prebuild:modules` once, because `yarn` does not build `@webex/legacy-tools` or sibling `dist/` |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/internal-plugin-ediscovery test:unit` (jest) after `build:src` |
| Run linters            | `yarn workspace @webex/internal-plugin-ediscovery test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-ediscovery build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

No package script runs `test/integration/spec/ediscovery.js`; it needs a compliance test user and the
live eDiscovery service. `test:browser:broken` runs karma over the same live-service spec and is named
broken; it is not a routine verification command. The aggregate `test` chains `test:integration` and
`test:browser`, which this package does not define, so it fails after the unit run.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/internal-plugin-ediscovery`.

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
| Language runtime | node; JavaScript sources | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=18`; the workspace root `package.json` `engines.node` reads `18.x` |
| Build tool       | yarn workspaces and `@webex/legacy-tools` over babel | yarn `3.4.1` (root `packageManager`), `@babel/core` `^7.17.10` |
| Test framework   | jest via `webex-legacy-tools` (`test:unit`); chai, sinon, and `@webex/test-helper-mock-webex` | sinon `^9.2.4` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: imports the encryption and conversation plugins, registers internal plugin
  `ediscovery` with its config and seven payload predicates and transforms, and re-exports the public
  bindings.
- `src/ediscovery.js`: the `EDiscovery` plugin and its container cache. Spec: `src/docs/README.md`.
- `src/transforms.js`: report-request encryption and report, activity, and container decryption.
- `src/retry.js`: the retry helper used by every decryption call.
- `src/report-request.js`, `src/ediscovery-error.js`, `src/config.js`: `ReportRequest`, the error
  classes, and the default options.
- `test/unit/spec/report.js`, `test/unit/spec/content.js`, `test/unit/spec/transforms.js`: unit specs
  run by `test:unit` (122 cases); they import the package by name, which loads `dist/`.
- `test/integration/spec/ediscovery.js`: live-service cases with no package script.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page, context only. It is not the behavioral authority; see
  [ADR-0001](docs/adr/0001-retain-product-readme.md).

### Critical Constraints

- The payload predicates in `src/index.js` match by field name on every request and response of the
  webex instance. A new predicate on a generic field transforms other plugins' payloads too.
- Decryption failures must stay on the payload as `error` or `warning`; the consuming downloader relies
  on them, and the response must still resolve.
- Activity decryption looks containers up through `getContentContainerByContainerId`, which reads the
  container cache first; keep that path.
- Content is decrypted on behalf of the container's `onBehalfOfUser`; `encryptedTextKeyValues` is not.
- `createReport` must keep mapping service error code 14400001 to `InvalidEmailAddressError`.
- Every paging option must stay in the `oneFlight` keys of the content methods.
- `reportId` may be a UUID or a report URL on the three content methods; keep both forms.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-ediscovery build:src`
2. `yarn workspace @webex/internal-plugin-ediscovery test:unit`
3. `yarn workspace @webex/internal-plugin-ediscovery test:style`

Step 1 matters: the unit specs import `@webex/internal-plugin-ediscovery` by name, which resolves `main`
(`dist/index.js`), so a stale `dist/` makes results meaningless.

Step 3 does not lint `src/ediscovery.js`: the shared `@webex/eslint-config-legacy` ignore list names
every `ediscovery.js` (its "Files with decorator" entries), and `src/index.js` disables every rule at its
top. Review both files by hand.

Testing rules:

- Add or update unit cases for every behavior change. Registration, the array transforms, container
  decryption, and `requestWithRetries` have no unit case today.
- Return or await every promise in a case; the `postAuditLog` cases do not, so their assertions never
  run.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use `sinon.useFakeTimers()` when a case depends on time, such as retry delays.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`.
- Prefer small functions over large procedural blocks.
- Make error handling explicit: request methods reject; transforms annotate the payload and resolve.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Wrap a new decryption in requestWithRetries with {onBehalfOf: container.onBehalfOfUser}.
- On a decryption failure, log with ctx.webex.logger and set activity.error (or warning for data loss).
- Add a case next to the matching describe block in test/unit/spec/transforms.js or content.js.

Avoid:
- Rejecting an inbound transform because one field failed.
- Adding a predicate on a field name other plugins also use.
- Treating README.md as the method list or as the way to run tests.
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
- Risk and impact on report creation, content download, decryption annotations, and the container cache.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Adding, removing, or renaming a payload predicate or transform.
- Changing which report-request fields are encrypted, or sending another field in plaintext.
- Changing the retry statuses, counts, or delays.
- Bounding or changing the lifetime of the container cache.
- Changing the registered plugin name or the decorator order.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, KMS keys, or decrypted compliance content, including in test fixtures.
- Log decrypted content, report search terms, or tokens.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
