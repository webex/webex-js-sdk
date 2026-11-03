<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-03T06:25:15Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/plugin-authorization-browser-first-party`, the first-party
browser `authorization` plugin (authorization code with PKCE and CSRF state, third-party login
callback, QR device login, and logout). This file orients agents. The monorepo root `AGENTS.md`
governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, config keys, events, or storage keys. Verify them from this
  package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (first-party browser
  authorization plugin); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` entry, and
its event contract is `src/authorization.js`. It serves no HTTP, so no OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; the deploy workflow runs the same command) |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | `yarn workspace @webex/plugin-authorization-browser-first-party test:unit` (jest) after `build:src` |
| Run linters            | `yarn workspace @webex/plugin-authorization-browser-first-party test:style` |
| Build/release artifact | `yarn workspace @webex/plugin-authorization-browser-first-party build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

The `package.json` script `test` chains `test:style`, `test:unit`, `test:integration`, and
`test:browser`. `test:integration` is not defined, and `test:browser` collects `test/integration/spec`,
which does not exist, so neither the aggregate nor `test:browser` is a verification command.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web client engineering assistant for `@webex/plugin-authorization-browser-first-party`.

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
| Language runtime | node; JavaScript sources for the browser | `>=8` (`package.json` engines) |
| Build tool       | `@webex/legacy-tools` over babel | `@babel/core` `^7.17.10` |
| Test framework   | jest via `webex-legacy-tools` (`test:unit`); chai, sinon, and `@webex/test-helper-mock-webex` | sinon `^9.2.4` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: registers public plugin `authorization` with proxies `isAuthorizing` and
  `isAuthenticating`; re-exports the class, `Events`, `InitialAuthorizationCodeGrantOutcomes`, and
  `config`.
- `src/authorization.js`: the `Authorization` plugin. Spec: `src/docs/README.md`.
- `src/config.js`: `credentials.clientType` (default `public`), `getClientAuthenticationOptions`, and
  the browser `refreshCallback`.
- `test/unit/spec/authorization.js`: the unit spec run by `test:unit`; it imports the package by name,
  which loads `dist/`.
- `test/automation/spec/authorization-code-grant.js`: skipped browser automation suite; no package
  script runs it.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md`: retained npm page. It is not the behavioral authority; see
  [ADR-0001](docs/adr/0001-retain-product-readme.md).

### Critical Constraints

- The CSRF token (`oauth2-csrf-token`) and PKCE verifier (`oauth2-code-verifier`) are single-use
  `sessionStorage` entries removed on first read. Keep the key names; a login started by one page load
  finishes on the next.
- Never send the raw email. `initiateLogin` replaces it with its SHA-256 (`emailHash`, `state.emailhash`).
- After a successful CSRF check, `initialize` must keep scrubbing `code`, `id_token`, `email`, and
  `csrf_token` from the URL (a failed check throws first and leaves them), and must set `ready` to
  `true` whether the startup exchange succeeds or fails.
- The third-party callback requires a stored CSRF token (`requireMatch`); do not relax it.
- Token-endpoint requests use `shouldRefreshAccessToken: false` and client authentication from
  `getClientAuthenticationOptions`.
- `eventEmitter` is shared by every instance in the page, and hosts switch on `eventType`. The QR
  `authorizationSuccess` event carries the token response body, so treat its listeners as token
  consumers.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/plugin-authorization-browser-first-party build:src`
2. `yarn workspace @webex/plugin-authorization-browser-first-party test:unit`
3. `yarn workspace @webex/plugin-authorization-browser-first-party test:style`

Step 1 matters: the unit spec imports `@webex/plugin-authorization-browser-first-party` by name, which
resolves `main` (`dist/index.js`), so a stale `dist/` makes results meaningless.

Testing rules:

- Add or update unit cases for every behavior change. The 400 grant-error mapping, the missing-code
  rejection, registration, and the logout redirect have no unit case today.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use `sinon.useFakeTimers()` for QR polling cases, as the existing cases do.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`;
  `src/authorization.js` disables eslint and TypeScript checking at file level.
- Prefer small functions over large procedural blocks.
- Make error handling explicit; report QR outcomes through `qRCodeLogin` events, not rejections.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Emit {eventType, data} or {eventType, userData} on eventEmitter for QR progress.
- Build token-endpoint auth with getClientAuthenticationOptions(this.config).
- Add a case next to the matching describe block in test/unit/spec/authorization.js.

Avoid:
- Storing secrets anywhere but the two single-use sessionStorage keys.
- Treating README.md as the list of methods or events.
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
- Risk and impact on the Webex web client login, QR login, and logout flows.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Changing CSRF, PKCE, URL-scrubbing, or client-authentication behavior.
- Changing token-endpoint or `oauth-helper` request shapes, or the QR verification host.
- Changing event names, `eventType` values, or `sessionStorage` key names.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, client secrets, or credentials, including in test fixtures.
- Log tokens, codes, verifiers, or raw email addresses.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
