<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T05:35:41Z
validation_status: pass
-->

# AI Agent Instructions

Package-scoped SDD entry for `@webex/plugin-authorization`, the environment-selecting entry for
`webex.authorization`: its Node entry re-exports `@webex/plugin-authorization-node`, and the
`package.json` `browser` field routes bundlers to a browser entry that re-exports
`@webex/plugin-authorization-browser`. This file orients agents. The monorepo root `AGENTS.md`
governs workspace-wide setup.

## Working Method

- Read the relevant package files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, or behavior. Verify them from this package's source and from
  the sibling package that owns the behavior.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- [`docs/index.md`](docs/index.md) for package documentation navigation;
- [`docs/architecture.md`](docs/architecture.md) for package boundaries, the platform split, and
  interactions;
- [`docs/specs/README.md`](docs/specs/README.md) for the manifest-backed module and contract registry;
- the module specification at [`src/docs/README.md`](src/docs/README.md) (environment-selecting
  entry); and
- [`docs/adr/index.md`](docs/adr/index.md) plus applicable concrete ADRs.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. This package
publishes an SDK surface, so its contract artifact is `package.json` plus the two entry files. It
serves no HTTP, so no OpenAPI applies. The `webex.authorization` methods are owned by the sibling
packages, not by this one.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing. Run workspace
commands from the monorepo root.

| Task                   | Command |
| ---------------------- | ------- |
| Install dependencies   | `yarn` (workspace root; the deploy workflow runs the same command); on a fresh checkout run `yarn prebuild:modules` once, because `yarn` does not build `@webex/legacy-tools` or sibling `dist/` |
| Start dev environment  | N/A — library package with no start script in `package.json` |
| Run tests              | N/A — the package has no tests and no `test:unit` script (see below) |
| Run linters            | `yarn workspace @webex/plugin-authorization test:style` |
| Build/release artifact | `yarn workspace @webex/plugin-authorization build` (runs `build:src`) |
| Format code            | N/A — no format script; `prettier` is a devDependency used through eslint |

`test:browser` runs karma in integration mode, but the package has no `test/` directory, so it
verifies nothing. The aggregate `test` script chains `test:unit` and `test:integration`, which are not
defined, so it fails.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK engineering assistant for `@webex/plugin-authorization`.

Primary outcomes:

- Deliver production-safe changes with lint and build passing.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant lint and build checks pass locally, and the selection is checked (see Testing Workflow).
3. Updated docs cover new behavior, including the owning module spec.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

| Area             | Tooling | Version |
| ---------------- | ------- | ------- |
| Language runtime | node; JavaScript sources | 22.14 (workspace root `AGENTS.md`; `.nvmrc` `lts/jod`); package `engines` accepts `>=18`; the workspace root `package.json` `engines.node` reads `18.x` |
| Build tool       | yarn workspaces and `@webex/legacy-tools` over babel | yarn `3.4.1` (root `packageManager`), `@babel/core` `^7.17.10` |
| Test framework   | none in this package; `@webex/jest-config-legacy` is configured but unused | N/A |
| Lint/format      | eslint via `@webex/eslint-config-legacy`, prettier | eslint `^8.24.0`, prettier `^2.7.1` |

### Project Map

- `src/index.js`: Node entry; re-exports `default` and `config` from
  `@webex/plugin-authorization-node`.
- `src/index.browser.js`: browser entry; re-exports `default` and `config` from
  `@webex/plugin-authorization-browser`. Spec for both: `src/docs/README.md`.
- `package.json`: `main` `dist/index.js`, `devMain` `src/index.js`, and the `browser` field that maps
  `./dist/index.js` and `./src/index.js` to their browser counterparts.
- `process`: package-root module exporting `{browser: true}`; not imported by `src/`.
- `dist/`: generated build output. Never edit by hand.
- `README.md` and `OAUTH-FLOW-GUIDE.md`: retained documents, context only. They are not the
  behavioral authority; see [ADR-0001](docs/adr/0001-keep-existing-docs-separate.md).

### Critical Constraints

- Keep both entries pure re-exports with the same export names, `default` and `config`.
- Keep both `browser` mappings. The workspace webpack build aliases packages to `src/index` and needs
  the `./src/index.js` mapping; published consumers resolve `dist/index.js` and need that mapping.
- Do not add runtime environment detection. Selection is by module resolution.
- Do not register a plugin or add configuration here. The selected sibling registers itself, and
  webex-core registration is first-wins, which `webex-first-party` relies on to keep the first-party
  plugin.
- Do not import both sibling plugins from one entry.
- `webex.authorization` has different methods in Node and browser builds. Changes to those methods
  belong in the sibling packages.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/plugin-authorization build:src`
2. `yarn workspace @webex/plugin-authorization test:style`
3. Check the selection: `require('@webex/plugin-authorization')` in Node must return the Node
   plugin's `default` and `config`, and a webex UMD build must contain the browser plugin.

Step 1 matters: Node consumers in the workspace resolve `main` (`dist/index.js`), so a stale `dist/`
keeps the old entry.

Testing rules:

- The package has no tests. If you add any, add the matching `test:unit` script and record it in the
  module spec and `.sdd/manifest.json`.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use `sinon.useFakeTimers()` when a case depends on time.

No coverage gate applies to this package; do not infer one.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output. The local `.eslintrc.js` sets `root: true`;
  both entry files are linted.
- Prefer small functions over large procedural blocks.
- Make error handling explicit at system boundaries.
- Keep public interfaces stable unless a breaking change is requested.

Pattern example:

```text
Preferred:
- One export statement per entry file, re-exporting default and config from the sibling.
- A browser mapping in package.json for every Node entry path, built and source.

Avoid:
- typeof window checks or any other runtime selection in this package.
- Treating README.md or OAUTH-FLOW-GUIDE.md as the reference for selection or method availability.
```

## 6. Git Workflow

- Branch naming: no package convention is defined; follow the workspace `CONTRIBUTING.md`.
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), which
  the workspace `CONTRIBUTING.md` requires for pull requests.
- Keep commits focused and reversible.
- Rebase on the target branch before opening a pull request.

PR checklist:

- What changed and why.
- Checks run and results.
- Risk and impact on Node consumers, the `webex` UMD build, and `webex-first-party`.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.
- Update the owning module spec in the same change that alters observable behavior.

### Ask First

- Adding dependencies.
- Changing `main`, `devMain`, or the `browser` field.
- Adding an export or a new entry file.
- Pointing an entry at a different authorization plugin.

### Never

- Edit `dist/` by hand.
- Commit secrets, tokens, client secrets, or credentials.
- Bypass required checks by disabling linters.
- Add a `.sdd/templates` directory, a copy of the templates, or a link to them in this package. The
  templates live once at the monorepo root, `../../../.sdd/templates/repo-standards`, and
  `.sdd/manifest.json` refers to them through `layout.monorepo_package`.
