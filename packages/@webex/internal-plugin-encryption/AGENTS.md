<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-16T05:59:53Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/internal-plugin-encryption`, the internal `encryption` plugin of
the SDK (it encrypts and decrypts content with KMS keys, caches keys, sends every KMS request over a
validated ECDH session, and ships Cisco's signed CA-roots bundle). This file orients agents. The
monorepo root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, method names, config fields, or KMS URIs. Verify them from
  this package's source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (Encryption plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an internal SDK surface, so its contract artifact is `package.json` plus the `src/index.js`
entry. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run every command
below from the workspace root. The package scripts run through
`yarn workspace @webex/internal-plugin-encryption <script>`; `package.json` in
`packages/@webex/internal-plugin-encryption` defines them.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; rerun it after lockfile changes, since this package pins `asn1js` and `pkijs` and needs the `@webex/kms-caroots` link). Fresh-checkout workspace setup (building `webex-legacy-tools` and sibling `dist/`) is owned by the workspace root; see [Prebuilding](../../../CONTRIBUTING.md#prebuilding) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/internal-plugin-encryption build:src`, then `yarn workspace @webex/internal-plugin-encryption test:unit` (the unit specs import `dist/`) |
| Run linters            | `yarn workspace @webex/internal-plugin-encryption test:style` |
| Build/release artifact | `yarn workspace @webex/internal-plugin-encryption build:src` (JavaScript, source maps, and `dist/assets`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`build` runs `build:src`. `test:integration` needs the CI test-user secrets; run it in
CI. `yarn workspace @webex/internal-plugin-encryption assets:refresh` is the only way to update the shipped bundle. Do not use the aggregate
`test` script as a quick check: it chains integration and karma runs that need secrets; see
[Getting started](docs/getting-started.md#tests).

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/internal-plugin-encryption`.

Primary outcomes:

- Deliver production-safe changes with build, lint, and unit tests passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Build, lint, and unit tests pass locally on a current install.
3. Updated docs cover new behavior, including the owning module spec, and the README certificate
   guide when that behavior changes.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version source |
| ---------------- | ------- | -------------- |
| Language runtime | node; JavaScript sources | Development version: `.nvmrc` and the workspace root `AGENTS.md`. Consumer floor: `engines.node` in `package.json`. The workspace root `package.json` `engines.node` differs from both. |
| Build tool       | yarn workspaces and `@webex/legacy-tools` over babel | `packageManager` in the workspace root `package.json`, `devDependencies.@babel/core` in `package.json` |
| Test framework   | jest for unit and mocha for integration, through `webex-legacy-tools`, with sinon and `@webex/test-helper-chai` | `@webex/jest-config-legacy` (`workspace:*`) |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | `devDependencies.eslint` and `devDependencies.prettier` in `package.json` |

### Project Map

- `src/index.js`: registers internal plugin `encryption`, the `kmsMessage` payload transforms, and
  the test-only interceptor; exports `Encryption` (default), `KMS`, `KmsError`, `DryError`.
- `src/encryption.js`: `Encryption` — JWE, SCR, binary, download, and the key cache (`getKey`).
- `src/kms.js`: `KMS` — KMS requests, retries, the ECDH context, Mercury responses, certificate policy,
  CA roots. Never linted (shared ignore list).
- `src/kms-batcher.js`, `src/kms-errors.js`, `src/kms-certificate-validation.js`: batching, error
  classes, certificate checks.
- `src/config.js`, `src/constants.js`: defaults, metric names, event name.
- `src/caroots-asset*.js`, `src/ensure-buffer*.js`: Node and browser variants chosen by the
  `package.json` browser field.
- `src/union-bundle.js`, `assets/ios_union-20261022.p7b`, `scripts/refresh-union-bundle.js`: the
  shipped bundle, its generated constants, and the refresh script.
- `test/unit/spec`, `test/integration/spec`, `test/fixtures`: tests and certificate fixtures.
- `dist/`: generated build output. Never edit by hand.
- `README.md`, `assets/README.md`: retained product docs, context only; see
  [ADR-0001](docs/adr/0001-retain-product-readme.md).
- Spec for every file under `src/`: `src/docs/README.md`.

### Critical Constraints

- Every KMS operation goes through `kms.request`; responses arrive over Mercury and are matched by
  request id (`INV-005` in the module spec).
- Mandatory KMS key checks always run; chain trust is opt-in and fails closed when on (`INV-001`,
  `INV-002`); report-only checks never reject (`INV-003`).
- `getKey` stores keys with private JWK material in unbounded storage, with no expiry (module Data,
  schema, and migration discipline).
- The default retry ladder makes 4 attempts and never renegotiates; some `kmsInitialTimeout` values
  retry forever (module Pitfalls and constraints).
- `src/union-bundle.js` is generated; refresh it only with `yarn workspace @webex/internal-plugin-encryption assets:refresh` (`INV-007`).

## 4. Testing Workflow

Run checks in this order, from the workspace root:

1. `yarn workspace @webex/internal-plugin-encryption build:src`
2. `yarn workspace @webex/internal-plugin-encryption test:unit`
3. `yarn workspace @webex/internal-plugin-encryption test:style`

Run `yarn` first on a fresh or outdated checkout so the pinned crypto packages and the
`@webex/kms-caroots` link are current.

Testing rules:

- Add or update tests in `test/unit/spec` for every behavior change; batching, retries, the payload
  transforms, Mercury handling, getKey caching, and the SCR methods have no unit case today, so pin
  current behavior first.
- Use sinon stubs for `webex.request`, `webex.internal.mercury`, `webex.internal.metrics`, and the
  KMS private helpers, as `test/unit/spec/kms.js` does; assert with `@webex/test-helper-chai`.
- Use `assert.calledOnceWithExactly` for request payloads and metric calls, and parametrize when
  more than three cases are alike, as the existing report-only and CA-roots cases do.
- Use `sinon.useFakeTimers()` for timeouts and context expiry.
- Cover failure paths: KMS errors, timeouts, certificate failures, asset failures.
- Do not remove tests to make CI pass.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets
  `root: true` and extends the legacy config; remember `src/kms.js` is not linted, so review it by
  hand.
- Prefer small functions over large procedural blocks.
- Make error handling explicit.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Send KMS operations as this.request({method, uri, ...fields}) and resolve the named response field.
- Report certificate and asset problems with this._submitMetric(NAME, {fields, tags: {..., validationMode}}).
- Log with this.logger and a 'kms:' or 'encryption:' prefix; log payloads only outside production.

Avoid:
- Calling the encryption service or KMS directly instead of through kms.request.
- Mutating the cached context for an onBehalfOf request.
- Editing src/union-bundle.js or renaming the asset by hand.
- Logging keys, JWKs, plaintext, or tokens.
```

## 6. Git Workflow

- Branch naming: no package convention is defined; follow the workspace `CONTRIBUTING.md`.
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), which
  the workspace `CONTRIBUTING.md` requires for pull requests.
- Keep commits focused and reversible.
- Rebase on the target branch before opening a pull request.

PR checklist:

- What changed and why.
- Tests run and results, including whether the CI integration job ran.
- Risk and impact on the plugins that call `webex.internal.encryption`.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding or removing dependencies, including declaring `@webex/internal-plugin-metrics` or dropping
  `@webex/test-helper-file`.
- Changing certificate-validation defaults, precedence, or fail-closed behavior.
- Changing the key cache format, what it stores, or adding expiry.
- Changing the retry ladder, timeouts, or batching config.
- Renaming or removing a method, config field, event, metric, or the registered plugin name.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, credentials, or private keys, including in test fixtures.
- Log keys, JWKs, plaintext, bearer tokens, or decrypted KMS bodies through `webex.logger`.
- Use unverified CA roots or bypass the rollback floor.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
