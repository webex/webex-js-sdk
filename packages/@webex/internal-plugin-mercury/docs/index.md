---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-07T00:34:58Z
validation_status: pass-with-warnings
-->

# @webex/internal-plugin-mercury documentation

Doc map for developers and agents.

This package is the Webex JS SDK's Mercury connection manager. It registers
`webex.internal.mercury`, opens and keeps alive WebSocket connections to the Mercury service per
session, reconnects by close code, and turns inbound envelopes into plugin handler calls and events.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)
- [Mercury plugin specification](../src/docs/README.md) — behavior of `src/`
- [Socket specification](../src/socket/docs/README.md) — behavior of `src/socket/`

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package-wide architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `src/docs/README.md` and `src/socket/docs/README.md` — the owning specifications beside each
  module's code
- [adr/](adr/) — concrete architectural decisions

No deployable service exists in this package, so no service specification is generated. The
published contracts are an npm/SDK surface whose authoritative source is `package.json` with
`src/index.js`, and the plugin event set in `src/mercury.js`. No OpenAPI document applies.

## Related repository resources

- `README.md` — the package's npm-facing usage page, retained separately from this generated
  documentation set. See [ADR 0001](adr/0001-retain-product-readme.md).

No `ci/`, `operate/`, `diagrams/`, or runbook directories exist in this package.
