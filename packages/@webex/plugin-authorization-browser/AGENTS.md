<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-04T08:54:29Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/plugin-authorization-browser`, the browser `authorization` plugin
of the public SDK build (implicit and code login with a CSRF token, hash-token completion on startup,
JWT exchange, guest JWT creation, and logout). This file orients agents. The monorepo root `AGENTS.md`
governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, config keys, or storage keys. Verify them from this
  package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (browser authorization
  plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` entry. It
serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; the deploy workflow runs the same command) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/plugin-authorization-browser test:unit` (jest) after `build:src` |
| Run linters            | `yarn workspace @webex/plugin-authorization-browser test:style` |
| Build/release artifact | `yarn workspace @webex/plugin-authorization-browser build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

The `package.json` script `test` chains `test:style`, `test:unit`, `test:integration`, and
`test:browser`; neither `test:integration` nor `test:browser` is defined, so the aggregate is not a
verification command. `test:browser:broken` runs the integration spec through karma and needs live
services; it is not a verification command either.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/plugin-authorization-browser`.

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
| Language runtime | node; JavaScript sources for the browser | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=18` |
| Build tool       | yarn workspaces and `@webex/legacy-tools` over babel | yarn `3.4.1` (root `packageManager`), `@babel/core` `^7.17.10` |
| Test framework   | jest via `webex-legacy-tools` (`test:unit`); chai, sinon, and `@webex/test-helper-mock-webex` | sinon `^9.2.4` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: imports `@webex/internal-plugin-device`, registers public plugin `authorization`
  with proxies `isAuthorizing` and `isAuthenticating`, and re-exports the class and `config`.
- `src/authorization.js`: the `Authorization` plugin. Spec: `src/docs/README.md`.
- `src/config.js`: `credentials.clientType` (default `public`).
- `test/unit/spec/authorization.js`: the unit spec run by `test:unit`; it imports the package by name,
  which loads `dist/`.
- `test/integration/spec/authorization.js`: browser-only JWT exchange cases against live services.
- `test/automation/spec/`: skipped browser automation suites; no package script runs them.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md` and `BROWSER-OAUTH-FLOW-GUIDE.md`: retained documents, context only. They are not the
  behavioral authority; see [ADR-0001](docs/adr/0001-keep-existing-docs-separate.md).

### Critical Constraints

- The CSRF token (`oauth2-csrf-token`) is a single-use `sessionStorage` entry removed whenever a hash
  is parsed. Keep the key name; a login started by one page load is checked on the next.
- `initialize` must keep URL, storage, and CSRF work synchronous so a redirect error or CSRF failure
  throws during construction. The credentials hand-off stays on `process.nextTick`.
- After a hash token is accepted, `_cleanUrl` must keep removing the token fields and `csrf_token`
  from the URL.
- Only the URL hash is parsed. This package does not exchange authorization codes; do not document or
  rely on a code exchange here.
- `initiateLogin` adds the CSRF token; `initiateImplicitGrant` and `initiateAuthorizationCodeGrant`
  called directly do not.
- `requestAccessTokenFromJwt` is called by webex-core credentials in JWT mode; keep its name,
  argument shape, and `oneFlight` decorator.
- The logout redirect URL carries the `options.token` that `WebexCore#logout` supplies.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/plugin-authorization-browser build:src`
2. `yarn workspace @webex/plugin-authorization-browser test:unit`
3. `yarn workspace @webex/plugin-authorization-browser test:style`

Step 1 matters: the unit spec imports `@webex/plugin-authorization-browser` by name, which resolves
`main` (`dist/index.js`), so a stale `dist/` makes results meaningless.

Testing rules:

- Add or update unit cases for every behavior change. Registration, `requestAccessTokenFromJwt`,
  `createJwt`, `logout`, and a hash without `access_token` have no unit case today.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use `sinon.useFakeTimers()` when a case depends on time.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`;
  `src/authorization.js` disables the camelcase rule at file level.
- Prefer small functions over large procedural blocks.
- Make error handling explicit; redirect problems throw from `initialize`, and request failures reject.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Read and remove the stored CSRF token before comparing it.
- Hand tokens to webex.credentials.set({supertoken}); never store them yourself.
- Add a case next to the matching describe block in test/unit/spec/authorization.js.

Avoid:
- Storing secrets anywhere but the single-use sessionStorage key.
- Treating README.md or BROWSER-OAUTH-FLOW-GUIDE.md as the method, error, or refresh reference.
- Trusting JSDoc return annotations over the code (logout returns undefined).
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
- Risk and impact on browser login, JWT login, JWT-mode refresh, and logout.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Changing CSRF, URL-scrubbing, or client-type behavior.
- Changing the hydra `jwt/login` request, the guest JWT claims, or the hydra fallback URL.
- Changing the `sessionStorage` key name or the registered plugin name.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, guest issuer secrets, or credentials, including in test fixtures.
- Log tokens, JWTs, or CSRF values.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
