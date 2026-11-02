<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-opus-5
approved_by: rarajes2@cisco.com
updated_at: 2026-09-28T14:57:53Z
validation_status: pass-with-warnings
-->

# AI Agent Instructions

Instructions for AI coding assistants working in `@webex/helper-image`, a published Webex JavaScript
SDK helper package that reads EXIF orientation onto image files, resolves their MIME type, and
measures and thumbnails them through separate Node and browser implementations.

## Working Method

- Read the relevant repository files before editing. Do not edit blind.
- Understand the task and affected surfaces before writing code.
- Prefer focused edits over rewriting whole files.
- Do not invent commands, paths, exports, or behavior. Verify them from repository-local source.
- Test or validate before declaring done.
- Keep output concise. If something is uncertain, say so instead of guessing.

## Canonical Repository Documentation

Before changing code or documentation, start with:

- `docs/index.md` for repository documentation navigation;
- `docs/architecture.md` for repository boundaries and interactions;
- `docs/specs/README.md` for the manifest-backed module and contract registry;
- the affected module's manifest-routed specification, which for this package is the single module at `src/docs/README.md`; and
- `docs/adr/index.md` plus applicable concrete ADRs for durable decisions.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. Published
repository-owned HTTP APIs use their linked OpenAPI document; internal HTTP surfaces may link route
code, and published SDKs use their ecosystem-native API artifact. The manifest remains authoritative
for canonical paths and artifact decisions.

This package owns no HTTP surface. Its published contract is the package export surface declared in
`package.json` and `src/index.js`.

`README.md` is the consumer-facing npm readme. It is reference-only context, not a specification, and
it is incomplete: it documents `updateImageOrientation`, `readExifData` and `orient` while omitting
`processImage` and `detectFileType`, and it presents `orient` as though it were a package export.
`src/docs/README.md` states the real boundary.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing.

| Task                   | Command                                             |
| ---------------------- | --------------------------------------------------- |
| Install dependencies   | `yarn install`                                      |
| Start dev environment  | Not applicable — this package is a library with no runnable entry point |
| Run tests              | `yarn workspace @webex/helper-image test:unit`      |
| Run linters            | `yarn workspace @webex/helper-image test:style`     |
| Build/release artifact | `yarn workspace @webex/helper-image build`          |
| Format code            | No dedicated command; formatting is enforced through the lint command above |

Browser-runner variant of the same unit specs: `yarn workspace @webex/helper-image test:browser`.

Do not run the package's aggregate `test` script, `yarn workspace @webex/helper-image test`. It chains
`yarn test:integration`, which `package.json` does not define, so it fails before reaching the browser
tier. Run the tiers individually.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the `@webex/web-client` engineering assistant for `@webex/helper-image`.

Primary outcomes:

- Deliver production-safe changes with passing tests.
- Preserve existing behavior unless a change request explicitly requires a behavior change.
- Keep docs and configuration aligned with code changes.

Definition of done:

1. Requested change is implemented.
2. Relevant tests/lint/build checks pass locally.
3. Updated docs/config cover new behavior.
4. PR summary includes risks and rollback notes.

## 3. Repository Knowledge

### Tech Stack

Document concrete versions so assistants choose compatible APIs.

| Area             | Tooling                                                     | Version     |
| ---------------- | ----------------------------------------------------------- | ----------- |
| Language runtime | Node, plus browser targets built from the same sources       | `>=18`      |
| Build tool       | `@webex/legacy-tools` (`webex-legacy-tools build`) over Babel via `@webex/babel-config-legacy` | workspace   |
| Test framework   | Mocha with `@webex/test-helper-chai` assertions and Sinon; Karma for the browser runner | `sinon ^9.2.4` |
| Lint/format      | ESLint with `@webex/eslint-config-legacy`, Prettier          | `eslint ^8.24.0`, `prettier ^2.7.1` |

Node's floor is declared in `package.json`. Yarn workspaces resolve the `workspace:*` dependencies,
and the Yarn version is pinned by the enclosing workspace rather than by this package.

### Project Map

- `src/`: the only module. Public entry plus EXIF orientation, MIME detection, and image
  measurement/thumbnailing. Specified in `src/docs/README.md`.
- `src/index.js`: the package export surface and the EXIF orientation functions.
- `src/process-image.js` and `src/process-image.browser.js`: the two implementations of
  `processImage`, selected by the `browser` field in `package.json`.
- `test/unit/spec/index.js`: the whole unit suite, run by both the Mocha and Karma runners.
- `docs/`: generated standing documentation. `.sdd/`: manifest and the templates symlink.

### Critical Constraints

- `processImage` has two implementations with genuinely different behavior. A change to one is not a
  change to the package unless the other is updated to match, and the differences are catalogued in
  `src/docs/README.md`.
- `readExifData` mutates the `file` object it is given and returns the buffer unchanged. Callers in
  the wider SDK depend on that side effect, so the mutation is the contract, not an implementation
  detail.
- The export surface is published to npm. Renaming, removing, or changing the shape of any export in
  `src/index.js` is a breaking change for external consumers.
- The Node implementation depends on a GraphicsMagick or ImageMagick binary on the host and
  deliberately degrades to an undefined result when it is absent. Do not convert that degradation
  into a rejection without treating it as a breaking change.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/helper-image test:unit`
2. `yarn workspace @webex/helper-image test:style`
3. `yarn workspace @webex/helper-image test:browser` — the browser runner for the same specs; it is
   the only tier that executes the `browserOnly` cases

Testing rules:

- Add or update tests for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- The `readExifData` cases in `test/unit/spec/index.js` are disabled with `xdescribe`, so the EXIF
  parsing path is currently unpinned. Treat any change to it as unguarded and add coverage rather
  than relying on the existing suite.

## 5. Code Style and Patterns

Coding expectations:

- Follow repository style rules and static analysis output.
- Prefer small, composable functions over large procedural blocks.
- Make error handling explicit at system boundaries.
- Keep public interfaces stable unless a breaking change is requested.
- Before adding a literal path, filename, command, workflow identifier, status,
  or other policy value, search the repository for exact and semantically
  equivalent uses. When repeated production values represent one shared
  contract, move them to the narrowest owning shared module or catalog as one
  canonical named constant, enum, or type and update consumers. Keep incidental
  similarities, one-off implementation details, and independent test fixtures
  local.
- Do not import a default, named, object, or namespace binding and immediately
  re-export it. Consumers should import from the owning module; package barrels
  should use direct named re-exports.
- Do not write inline runtime `typeof` checks outside descriptively named guard
  implementations. Import and reuse the owning guard instead; TypeScript
  type-position `typeof` queries remain allowed.
- Take a `logger` as a parameter rather than importing one. Every function in this package that
  logs receives the logger from its caller, which is what lets the SDK route package logs through
  the host client's logger.

Pattern example:

```text
Preferred:
- Validate external input close to the boundary.
- Return typed/structured results.
- Include actionable error messages.

Avoid:
- Passing unvalidated payloads deep into the system.
- Swallowing exceptions or returning ambiguous null values.
```

## 6. Git Workflow

- Branch naming: `[feature|fix|chore]/[short-description]`
- Commit format: conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- Keep commits focused and reversible.
- Rebase on the target branch before opening PR.

PR checklist:

- What changed and why.
- Tests run and results.
- Risk/impact areas.
- Rollback approach.

## 7. Boundaries and Escalation

### Always

- Prefer existing patterns over introducing new architecture.
- Keep changes minimal for the requested scope.
- Call out assumptions and unknowns explicitly.

### Ask First

- Adding new dependencies or external services.
- Large refactors or schema migrations.
- Security-sensitive changes (auth, encryption, secrets handling).
- Any destructive data or infrastructure operation.
- Changing any export in `src/index.js`, or changing one `processImage` implementation without the
  other. Both are consumer-visible.

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
