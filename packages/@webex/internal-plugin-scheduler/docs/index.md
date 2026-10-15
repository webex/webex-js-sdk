---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-15T11:06:00Z
validation_status: pass-with-warnings
-->

# @webex/internal-plugin-scheduler documentation

Doc map for developers and agents.

This package registers `webex.internal.scheduler` for the Webex JS SDK. Its code is an unchanged
plugin scaffold: the `Scheduler` plugin, its config, and its payload transforms are examples, and no
scheduling behavior exists yet.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)
- [Scheduler plugin specification](../src/docs/README.md) — behavior of `src/`

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package-wide architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `src/docs/README.md` — the owning specification beside the module's code
- [adr/](adr/) — concrete architectural decisions

No deployable service exists in this package, so no service specification is generated. The
published contract is an npm/SDK surface whose authoritative source is `package.json` with
`src/index.js`. No HTTP API is served, so no OpenAPI document applies.

## Related repository resources

- `README.md` — the package's npm-facing usage page, retained separately from this generated
  documentation set. See [ADR 0001](adr/0001-retain-product-readme.md).

No `ci/`, `operate/`, `diagrams/`, or runbook directories exist in this package.
