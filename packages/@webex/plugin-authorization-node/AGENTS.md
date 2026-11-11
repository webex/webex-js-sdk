<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-11T09:32:15Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/plugin-authorization-node`, the Node `authorization` plugin of
the SDK (authorization-code exchange with the confidential client secret, JWT exchange, guest JWT
creation, and the logout request). This file orients agents. The monorepo root `AGENTS.md` governs
workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, or config keys. Verify them from this package's source and
  tests, and check that a credentials key exists in webex-core `CredentialsConfig` before reading it.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (Node authorization
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
| Run tests              | `yarn workspace @webex/plugin-authorization-node test:unit` (jest) after `build:src` |
| Run linters            | `yarn workspace @webex/plugin-authorization-node test:style` |
| Build/release artifact | `yarn workspace @webex/plugin-authorization-node build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`test:integration` runs the Node-only integration spec through mocha against live Webex services and
needs test-user credentials (`WEBEX_CLIENT_ID`, `WEBEX_CLIENT_SECRET`, `WEBEX_SCOPE`,
`WEBEX_APPID_ORGID`, `WEBEX_APPID_SECRET`); it is not a routine verification command. `test:browser`
runs the specs through karma, where every Node-only suite is skipped, so it verifies nothing. The
aggregate `test` chains all four scripts and therefore needs live services too.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/plugin-authorization-node`.

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
| Language runtime | node; JavaScript sources | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=16`; the workspace root `package.json` `engines.node` still reads `18.x`, which conflicts with the other pins |
| Build tool       | yarn workspaces and `@webex/legacy-tools` over babel | yarn `3.4.1` (root `packageManager`), `@babel/core` `^7.17.10` |
| Test framework   | jest via `webex-legacy-tools` (`test:unit`); chai, sinon, and `@webex/test-helper-mock-webex` | sinon `^9.2.4` |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: imports `@webex/internal-plugin-device`, registers public plugin `authorization`
  with proxies `isAuthorizing` and `isAuthenticating`, and re-exports the class and `config`.
- `src/authorization.js`: the `Authorization` plugin. Spec: `src/docs/README.md`.
- `src/config.js`: `{credentials: {}}`; the package adds no configuration value.
- `test/unit/spec/authorization.js`: the unit spec run by `test:unit` (4 Node-only cases); it imports
  the package by name, which loads `dist/`.
- `test/integration/spec/authorization.js`: Node-only cases against live services.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md` and `NODE-OAUTH-FLOW-GUIDE.md`: retained documents, context only. They are not the
  behavioral authority; see [ADR-0001](docs/adr/0001-keep-existing-docs-separate.md).

### Critical Constraints

- The code grant sends `client_id` and `client_secret` as Basic credentials with
  `shouldRefreshAccessToken: false`. Keep both; the secret is why this exchange runs in Node.
- Every token goes to `webex.credentials.set({supertoken})`. Do not store tokens in this package.
- An HTTP 400 from the token endpoint must keep mapping to a grant error through `grantErrors.select`.
- `requestAccessTokenFromJwt` is called by webex-core credentials in JWT mode; keep its name,
  argument shape, and `oneFlight` decorator.
- `oneFlight` is keyed by method name: concurrent calls with different codes or JWTs share the first
  call's result.
- `logout` does not return or await its request; `WebexCore#logout` finishes without it.
- `logout` reads `config.service`, which `CredentialsConfig` does not declare, so `cisService` is
  undefined by default.
- This package does no CSRF or `state` check; the host does that before passing the code.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/plugin-authorization-node build:src`
2. `yarn workspace @webex/plugin-authorization-node test:unit`
3. `yarn workspace @webex/plugin-authorization-node test:style`

Step 1 matters: the unit spec imports `@webex/plugin-authorization-node` by name, which resolves
`main` (`dist/index.js`), so a stale `dist/` makes results meaningless.

Step 3 does not lint `src/authorization.js`: the shared `@webex/eslint-config-legacy` ignore list
names every `authorization.js` (its "Files with decorator" entries). Review that file by hand.

Testing rules:

- Add or update unit cases for every behavior change. Registration, the HTTP 400 grant-error mapping,
  `requestAccessTokenFromJwt`, `createJwt`, and `logout` have no unit case today.
- Wrap new cases in `nodeOnly(describe)` like the existing suite.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use `sinon.useFakeTimers()` when a case depends on time.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`;
  `src/authorization.js` disables the camelcase rule at file level.
- Prefer small functions over large procedural blocks.
- Make error handling explicit; request failures reject, and argument errors should reject rather than
  throw.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- Read broker URLs and client credentials from this.config (the credentials namespace).
- Hand tokens to webex.credentials.set({supertoken}); never store them yourself.
- Add a case next to the matching describe block in test/unit/spec/authorization.js.

Avoid:
- Reading a credentials key that CredentialsConfig does not declare.
- Treating README.md or NODE-OAUTH-FLOW-GUIDE.md as the method, event, error, or refresh reference.
- Trusting JSDoc return annotations over the code.
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
- Risk and impact on the code grant, JWT login, JWT-mode refresh, and logout.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Changing the code-grant form, its client authentication, or its error mapping.
- Changing the hydra `jwt/login` request, the guest JWT claims, or the hydra fallback URL.
- Making `logout` awaited or changing its request body.
- Changing the registered plugin name or the decorator order.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, client secrets, guest issuer secrets, or credentials, including in test
  fixtures.
- Log authorization codes, tokens, JWTs, or the client secret.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
