# Rules — @webex/calling

> These rules reconcile the previous Calling rules with current source, tests, lint configuration, and the standard SDD layout. Detailed examples remain in `patterns/`.

## Coverage Map (which docs/specs to trust)

- `.sdd/manifest.json` is authoritative for module routes and coverage state.
- `Partial` specs are useful but every changed claim must be checked against source and tests.
- `src/index.ts` is authoritative for consumer-facing exports; `src/api.ts` supports generated API documentation.
- Exact endpoints/constants/types remain authoritative in their defining source files.

## Autonomy & Ask-First

- Ask before changing public exports, method signatures, events, backend behavior, errors, metrics, protocols, state machines, security-sensitive handling, or dependencies.
- Present the impacted modules, public-contract delta, backend scope, tests, and spec updates before coding.
- Do not silently resolve source-vs-doc conflicts; use a spec-only reconciliation decision.

## Naming

- Classes use PascalCase; methods/variables use camelCase; constants and enum members use SCREAMING_SNAKE_CASE.
- Interfaces follow the package's established `I` prefix (`ICallingClient`, `ILine`, `ICall`).
- Main classes use PascalCase filenames; shared declarations use `types.ts` and `constants.ts`; tests use `*.test.ts`.
- Preserve public names and serialized/event string values unless an approved compatibility plan exists.

## Logging

- Import the package Logger; never use `console.*`.
- Include predefined `file` and concrete `method` context.
- `error` is blocking failure, `warn` is recoverable degradation, `log` is material outcome, `info` is lifecycle progress, and `trace` is verbose diagnostics.
- Do not log tokens, credentials, full sensitive payloads, contact/recording/voicemail content, or unfiltered media/signaling data.

## Error Handling

- Use `ExtendedError` and the scope-specific CallError/LineError/client or transport error types.
- Preserve typed error codes/layers and caller recovery signals.
- Log errors with context and emit/return/throw through the module's documented contract; never swallow failures.
- Backend “not supported” behavior and HTTP mappings are observable contracts and require tests.

## Imports / Dependencies

- Use module entry points and source-local shared utilities; avoid new cross-module cycles.
- Add dependencies only with approval and update package metadata, build, security review, and docs.
- Public exports are added only through `src/index.ts`; `src/api.ts` remains aligned for docs.
- Reuse SDKConnector, Eventing, Logger, Metrics, Errors, common utilities, and existing backend connector patterns.

## Testing

- Co-locate Jest tests as `*.test.ts`; use existing fixtures and Webex/WebSocket/media mocks.
- Cover positive and negative behavior, emitted events, error mapping, metrics, cleanup/listener removal, retries/timers, and backend differences.
- Use fake timers/flush helpers carefully and restore mocks/state after each test.
- Run focused tests during development, then package unit tests, build, and style checks.

## Security

- Treat SDK inputs, HTTP responses, Mercury events, WebSocket frames, browser state, and caller/contact identifiers as untrusted or sensitive.
- Keep tokens inside SDK/request/socket boundaries; never persist them in localStorage or logs.
- Preserve Contacts encryption/decryption and safe fallback behavior.
- Validate URL/header/payload construction and avoid credentials in URLs.

## Spec-Currency & Drift Thresholds

- Code, tests, owning module spec, `CONTRACTS.md`, `SERVICE_STATE.md`, and manifest routing change together when applicable.
- Public API/signature/architecture/contract drift is blocking; type/event/transport drift is important.
- Run generated-doc conformance before coverage review and independent spec validation.

## Secrets Policy

- No tokens, credentials, phone numbers, private service endpoints, or production payloads in source, fixtures, docs, snapshots, logs, or generated reports.
- Use approved environment/CI secret injection and sanitized fixtures.

## Concurrency & Async

- Preserve ordering and idempotency assumptions in call, registration, Mercury, and Mobius flows.
- Guard shared socket transitions with existing mutexes; keep bounded retry/backoff/timer behavior.
- Remove listeners, timers, pending requests, media resources, and collection entries during teardown.
- Handle duplicate, late, timeout, auth-close, network-flap, and recovery paths explicitly.

## Strict-Compliance Mode

- Load `AGENTS.md`, `SPEC_INDEX.md`, the owning spec, and applicable cross-cutting docs before changes.
- Stop on unresolved policy/spec conflict or failed build, test, lint, conformance, drift, or validator gate.
- Do not weaken tests or documentation to force a pass.

## Maintenance

- Detailed architecture, error, event, testing, and TypeScript examples live in `patterns/` and must be rechecked against at least three real source locations when updated.
- Review this file when tooling, public compatibility, event/error conventions, security boundaries, or lifecycle policy changes.
