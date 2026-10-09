---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-09T14:40:25Z
validation_status: pending
-->

# @webex/internal-plugin-task documentation

Doc map for developers and agents.

This package is the Webex JS SDK's client for the Raindrop task service. It registers
`webex.internal.task`, wraps the task REST operations, and encrypts task titles and notes before
they leave the client.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)
- [Task plugin specification](../src/docs/README.md) — behavior of `src/`

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package-wide architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `src/docs/README.md` — the owning specification beside the module's code
- [adr/](adr/) — concrete architectural decisions

No deployable service exists in this package, so no service specification is generated. The
published contract is an npm/SDK surface whose authoritative source is `package.json` with
`src/index.js`. The Raindrop task HTTP API is consumed, not served, so no OpenAPI document applies.

## Related repository resources

- `README.md` — the package's npm-facing usage page, retained separately from this generated
  documentation set. See [ADR 0001](adr/0001-retain-product-readme.md).

No `ci/`, `operate/`, `diagrams/`, or runbook directories exist in this package.
