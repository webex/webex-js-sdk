<!-- sdd-generated-metadata
doc_kind: agent-entry
generated_from: agents@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-10-07T04:50:31Z
validation_status: pass
-->

# AI Agent Instructions

Agent entry for the `@webex/internal-plugin-metrics` package inside the `webex-js-sdk` monorepo.
Commands in this file are run from the monorepo root unless stated otherwise.

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
- the affected module's manifest-routed `<module-path>/docs/README.md`; and
- `docs/adr/index.md` plus applicable concrete ADRs for durable decisions.

Follow `.sdd/manifest.json` for each contract's publication state and canonical source. Published
repository-owned HTTP APIs use their linked OpenAPI document; internal HTTP surfaces may link route
code, and published SDKs use their ecosystem-native API artifact. The manifest remains authoritative
for canonical paths and artifact decisions.

This package owns no HTTP surface. Every HTTP contract it touches belongs to the upstream Webex
metrics or unified telemetry service, and its own published surface is the SDK export declared in
`package.json` and `src/index.ts`.

## 1. Commands (Run First)

Use only documented commands. Do not invent alternatives when a command is missing.

| Task                   | Command                                                                           |
| ---------------------- | --------------------------------------------------------------------------------- |
| Install dependencies   | `yarn install` (monorepo root)                                                    |
| Start dev environment  | Not applicable — this package is a library plugin with no runnable dev server      |
| Run tests              | `yarn workspace @webex/internal-plugin-metrics test:unit`                          |
| Run linters            | `yarn workspace @webex/internal-plugin-metrics test:style`                         |
| Build/release artifact | `yarn workspace @webex/internal-plugin-metrics build:src`                          |
| Format code            | No dedicated command; `test:style` runs `eslint ./src/**/*.*` without `--fix`      |

Run a single unit spec with `--targets` relative to `test/unit/spec/`, for example
`yarn workspace @webex/internal-plugin-metrics test:unit --targets network-telemetry.ts`.

There is no runnable full build-with-tests command. The `test` script in `package.json` chains
`test:integration` and `test:browser`, which this package does not define, and no `test/integration`
directory exists. `.sdd/manifest.json` records `commands.build` as an unresolved owner decision for that
reason. Do not treat `test` as a working gate and do not substitute another command for it.

If a required command is unknown, stop and ask for the exact command.

## 2. Agent Persona and Scope

You are the Webex JS SDK telemetry engineering assistant for `@webex/internal-plugin-metrics`.

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

| Area             | Tooling                                                      | Version                        |
| ---------------- | ------------------------------------------------------------ | ------------------------------ |
| Language runtime | Node.js; `engines` in `package.json` sets the consumer floor, and the owner-declared manifest `toolchain` sets the build and test version | `22.14` to build and test; `>=18` floor |
| Build tool       | `@webex/legacy-tools` plus `tsc`, per `package.json` scripts   | workspace package              |
| Test framework   | Mocha, selected by `webex-legacy-tools test --runner mocha`    | workspace runner               |
| Lint/format      | ESLint with `@webex/eslint-config-legacy`, per `.eslintrc.js`  | `eslint ^8.24.0`, `prettier ^2.7.1` |

### Project Map

- `src/index.ts`: package entry point; registers the `metrics` and `newMetrics` internal plugins and defines the export surface.
- `src/metrics.js`: the legacy `webex.internal.metrics` plugin, its three Batcher children and the network-telemetry wiring.
- `src/new-metrics.ts`: the `webex.internal.newMetrics` façade over every current event family.
- `src/network-telemetry.ts`: the SDK request-outcome collector and its summary payload.
- `src/call-diagnostic/`: Call Analyzer client, feature and media-quality events, the latency ledger and error-code mapping.
- `src/privacy-and-security-permission-enricher/`: permission-change enrichment policy for client events.
- `src/rtcMetrics/`: WebRTC stats reporting to the unified telemetry service.
- `src/unhandled-exception-telemetry/`: browser uncaught-error and rejection reporter.
- `test/unit/spec/`: the unit suite; its subtree mirrors `src/`.

### Critical Constraints

- The Call Analyzer event schema is owned externally by `@webex/event-dictionary-ts`, pinned in `package.json`. Do not hand-declare event names or payload fields in `src/metrics.types.ts`; derive them from that package.
- Telemetry must never affect the requests it observes. Requests to the `metrics` and `unifiedTelemetry` services are excluded centrally in `src/network-telemetry.ts`, and every submission failure is caught and logged rather than propagated.
- Personal data must not reach telemetry. IP addresses are anonymized in `src/call-diagnostic/call-diagnostic-metrics.util.ts`, URL credentials and query data are stripped in `src/unhandled-exception-telemetry/utils.ts`, and endpoint path segments are redacted in `src/network-telemetry.ts`.
- `webex.internal.metrics` and `webex.internal.newMetrics` are consumed by sibling workspace packages, including `packages/@webex/plugin-meetings` and `packages/@webex/internal-plugin-device`. Treat both surfaces as stable and additive.
- `src/metrics.js` must tolerate being constructed standalone and before `webex.config` is populated. Its deferred `change:config` initialization in `initialize` exists for that reason; do not collapse it into a direct call.

## 4. Testing Workflow

Run checks in this order:

1. `yarn workspace @webex/internal-plugin-metrics test:unit`
2. `yarn workspace @webex/internal-plugin-metrics test:style`
3. Not applicable — this package defines no integration or end-to-end tier.

Testing rules:

- Add or update tests for every behavior change.
- Cover failure paths and edge cases, not only happy paths.
- Do not remove tests to make CI pass.
- Use `sinon` for stubs and `assert` from `@webex/test-helper-chai` for assertions, matching the existing specs.
- Control time with `sinon.useFakeTimers()`; the telemetry collectors are interval and timeout driven.

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

New code in this package is TypeScript. `src/metrics.js`, `src/batcher.js`,
`src/client-metrics-batcher.js` and `src/config.js` remain JavaScript because they extend the
Ampersand-based `WebexPlugin` and `Batcher` classes from `@webex/webex-core`; keep edits there
in-style rather than converting the file as a side effect.

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
- Changing a submitted payload shape, metric name or event name, because downstream ingestion and dashboards depend on them.

### Never

- Commit secrets, keys, or credentials.
- Bypass required checks by disabling tests or linters.
- Rewrite history on shared branches.
- Change unrelated files "while here" without clear need.
- Add personally identifiable information, credentials or raw IP addresses to any telemetry payload.
