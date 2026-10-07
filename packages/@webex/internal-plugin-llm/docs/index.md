---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-07T07:05:22Z
validation_status: pass-with-warnings
-->

# @webex/internal-plugin-llm documentation

Doc map for developers and agents.

This package is the Webex JS SDK's LLM data-channel connection manager. It registers
`webex.internal.llm`, registers each session with the data-channel service, connects the returned
WebSocket through the Mercury plugin it extends, and tracks session ownership and data-channel tokens.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)
- [LLM channel plugin specification](../src/docs/README.md) — behavior of `src/`

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package-wide architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `src/docs/README.md` — the owning specification beside the module's code
- [adr/](adr/) — concrete architectural decisions

No deployable service exists in this package, so no service specification is generated. The
published contracts are an npm/SDK surface whose authoritative source is `package.json` with
`src/index.ts`, and the plugin event set whose source is `src/llm.ts`. No OpenAPI document applies.

## Related repository resources

- `README.md` — the package's npm-facing usage page, retained separately from this generated
  documentation set. See [ADR 0001](adr/0001-retain-product-readme.md).

No `ci/`, `operate/`, `diagrams/`, or runbook directories exist in this package.
