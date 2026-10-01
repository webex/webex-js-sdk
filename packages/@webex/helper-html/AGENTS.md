<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: cursor
approved_by: repository user
updated_at: 2026-10-01T11:15:00Z
validation_status: not-run
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/helper-html`. This file orients agents. The monorepo root `AGENTS.md` governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, URL schemes, or error strings. Verify them from this package's source and tests.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for repository documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for repository boundaries and interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package publishes an SDK surface, so its contract artifact is `package.json` plus the `src/index.js` barrel. No OpenAPI applies.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace commands from the monorepo root.

| Task                   | Command             |
| ---------------------- | ------------------- |
| Install dependencies   | `yarn install` (workspace root) |
| Start dev environment  | N/A — library package with no runnable dev server |
| Run tests              | `yarn workspace @webex/helper-html test:browser` |
| Run linters            | `yarn workspace @webex/helper-html test:style` |
| Build/release artifact | `yarn workspace @webex/helper-html build:src` |
| Format code            | N/A — no format script; `prettier` is a devDependency invoked through eslint |

`package.json` `scripts.test` chains `test:unit` and `test:integration`. Neither script is defined, so that aggregate script is not a verification command. The unit spec is `test/unit/spec/html.js`. It is skipped in Node and is launched by the browser command above (`webex-legacy-tools test --unit --runner karma`).

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex web SDK engineering assistant for `@webex/helper-html`.

Primary outcomes:

- Deliver production-safe changes with the browser unit spec and lint passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests, lint, and build checks pass locally.
3. Updated docs cover new behavior, including [`src/docs/README.md`](src/docs/README.md).
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling     | Version     |
| ---------------- | ----------- | ----------- |
| Language runtime | node        | `>=18` (`package.json` engines) |
| Build tool       | `@webex/legacy-tools` over babel | `@babel/core` `^7.17.10` |
| Test framework   | mocha via `@webex/test-helper-mocha`, chai via `@webex/test-helper-chai`, karma via `test:browser` | workspace |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: public barrel.
- `src/html-base.js`: `escape` and `escapeSync`, used in Node and the browser.
- `src/html.js`: Node implementations. Filter exports return the input string.
- `src/html.shim.js`: browser DOM filter, selected by the `package.json` `browser` field.
- `src/docs/README.md`: the canonical module specification.
- `test/unit/spec/html.js`: the browser unit spec.
- `dist/`: generated build output. Never edit by hand.
- `docs/`: repository standing documentation.
- `README.md`: retained product readme. It is not the behavioral authority.

### Critical Constraints

- Node filter exports do not sanitize. Sanitizing behavior is in `src/html.shim.js`.
- Filter functions are curried with arity 4. The first argument is `processCallback`, then `allowedTags`, `allowedStyles`, and `html`. An optional further argument supplies extra URL schemes.
- `javascript`, `vbscript`, and `data` stay blocked even if a caller lists them in `additionalAllowedUrlSchemes`.
- The barrel is the public surface. Consumers import from `@webex/helper-html`, including `@webex/internal-plugin-conversation`.
- Do not treat `README.md` as the API contract. Its filter signature does not match the curried implementation. See `docs/adr/0001-retain-product-readme.md`.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/helper-html test:browser`
2. `yarn workspace @webex/helper-html test:style`
3. N/A — no integration tier is defined in this package.

Testing rules:

- Add or update browser unit cases for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- The existing spec is wrapped in `skipInNode`, so a Node test runner does not execute it.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`.
- Prefer small functions over large procedural blocks.
- Keep the Node file and the browser shim exporting the same names.
- Keep public interfaces stable unless a breaking change is requested.
- Before adding a literal path, filename, command, or scheme, search for the existing list in `src/html.shim.js`.

Pattern example:

```text
Preferred:
- Keep disallowed URL schemes in the blocked set in src/html.shim.js.
- Return the original string from the Node filter path.
- Add a browser unit case next to the existing table in test/unit/spec/html.js.

Avoid:
- Sanitizing inside src/html.js.
- Allowing javascript, vbscript, or data through the additional-scheme argument.
- Documenting a three-argument filter signature that the code does not implement.
```

## 6. Git Workflow

- Branch naming: `[feature|fix|chore]/[short-description]`
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Keep commits focused and reversible.
- Rebase on the target branch before opening a pull request.

PR checklist:

- What changed and why.
- Tests run and results.
- Risk and impact, including `@webex/internal-plugin-conversation` when the export surface changes.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update [`src/docs/README.md`](src/docs/README.md) in the same change that alters observable behavior.

### Ask First

- Adding dependencies. The only runtime dependency is `lodash`.
- Removing or renaming a barrel export.
- Changing the blocked URL scheme set or the default allowed schemes.
- Changing Node filter exports so they sanitize.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, or credentials.
- Invent error strings, exports, or schemes that are not in `src/`.
- Copy repo-standards template files into this package. `.sdd/templates` is a symlink to the workspace snapshot.
