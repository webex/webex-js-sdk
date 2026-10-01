<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: rules@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# RULES — @webex/plugin-meetings

## Coverage Map (which docs/specs to trust)

Per-module status is defined in `.sdd/manifest.json` and mirrored by `SPEC_INDEX.md`. `Specced` is authoritative; `Partial` requires source cross-checking; `Untracked` requires code/tests and a characterization baseline before modification.

## Autonomy & Ask-First

- Ask before code changes, public/event/request contract changes, new dependencies, security/performance-sensitive work, or modifications to Partial/Untracked modules without a baseline.
- Do not modify remote systems, publish packages, deploy, push, or post review findings without explicit permission.
- Reconcile before changing protected canonical specs; update code and spec deltas together after onboarding.

## Naming

- Reuse constants and typed enums from the owning module. Because legacy code also uses raw wire strings, search both constants/enums and raw values before changing a logical condition.
- Preserve established camelCase/PascalCase file and type conventions; do not rename consumer-visible values incidentally.

## Logging

- Use `src/common/logs/logger-proxy.ts` or the established injected logger, with existing meeting/correlation context.
- Never add `console.log` or log credentials, tokens, meeting passwords/URLs, participant PII, transcript/caption text, raw media, or entire service payloads.

## Error Handling

- Preserve typed package errors and server rejection details needed by callers.
- Do not swallow promise rejections, turn failure into success, or add unbounded retries.
- Cleanup listeners, timers, media objects, edit locks, and queued work on both success and failure.

## Imports / Dependencies

- Import through existing package/module boundaries; HTTP through request helpers, media through media-core/helpers, and host capabilities through Webex core plugins/services.
- Do not add an external dependency without approval. Keep workspace packages as `workspace:*` unless the repository release policy says otherwise.
- Preserve `src/index.ts` as the public export authority.

## Testing

- Mirror `src/{area}/` under `test/unit/spec/{area}/`; target paths are relative to `test/unit/spec/`.
- Use Sinon and `@webex/test-helper-chai`; prefer `calledOnceWithExactly`, fake timers for time, shared helpers, and parameterized tests beyond three similar cases.
- Plugin tests are slow: focus the smallest target. Temporary `.only` is allowed by the retained package rule only during a focused run and must be removed before completion.
- Test happy path, rejection/error, state transition/order, and cleanup for async/event/media work.

## Security

- Treat request credentials, JWTs, route/data-channel tokens, device/participant identity, meeting URLs/passwords, transcripts, captions, and media as sensitive.
- Keep authorization decisions in remote capability/role/policy gates; do not bypass them client-side.
- Validate/normalize external payloads at existing parser/request boundaries and avoid exposing internal response bodies as new public contracts.

## Spec-Currency & Drift Thresholds

- Code behavior, spec delta, and canonical module update land in the same merge.
- Blocking drift includes missing/changed public surface, event/error semantics, state transition, security rule, or required test strategy. Run the configured drift checker when explicitly requested or in CI; do not claim it ran otherwise.

## Secrets Policy

- Secrets belong in managed/local environment configuration, never repository files, examples, logs, snapshots, or metrics.
- Redact generated evidence and test fixtures; use synthetic values.

## Concurrency & Async

- Preserve event scope and ordering; expect realtime duplication/out-of-order delivery where current code does.
- Bound retry/backoff and timer lifetimes; make cleanup idempotent.
- Do not block media/event callbacks with unrelated network work; coordinate shared state through existing queues/managers.

## Strict-Compliance Mode

Load the routed manifest/spec/rules before changes; stop on protected-spec conflict, missing approval, unresolved security/contract facts, failed conformance, below-approved coverage, or independent-validator blockers.

## Maintenance

Rules must remain code-grounded and mechanically checkable where possible. Put examples in `patterns/`; update this file when package conventions or gates change.
