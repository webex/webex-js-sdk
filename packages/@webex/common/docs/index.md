---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-09-21T08:58:59Z
validation_status: pass-with-warnings
-->

# @webex/common documentation

Doc map for developers and agents. Shared, zero-Webex-dependency helpers for the Webex JS SDK.
[`../README.md`](../README.md) remains the consumer-facing usage guide.

## Start here

- [Getting started](getting-started.md)
- [Repository architecture](architecture.md)
- Service specification — N/A: this is a library package, not a deployable service
  (`docs/service.md` is `omit` in the manifest artifact decisions)
- API specification — N/A: no HTTP surface is served, so no OpenAPI document applies
  (`api-specs/openapi.yaml` is `omit`)

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical repository-wide architecture
- Service specification — not applicable for this package
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- [`src/docs/README.md`](../src/docs/README.md) — the owning specification beside the module's code
- [adr/](adr/) — concrete architectural decisions; blank ADR templates remain under `.sdd/`

Use the manifest-linked native source for exact contract details. This package publishes an SDK
surface, so `package.json` plus the `src/index.js` barrel are the ecosystem-native artifacts;
OpenAPI does not apply. Those sources are registered in the architecture index and the owning module
spec rather than copied into Markdown.

## Related repository resources

- Monorepo root `AGENTS.md` — workspace-wide setup and conventions
- Monorepo root `CONTRIBUTING.md` and `CHANGELOG.md` — contribution flow and release history,
  both managed at the workspace level
