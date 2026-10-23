---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-10-12T14:00:30Z
validation_status: pass
-->

# @webex/internal-plugin-feature documentation

Doc map for developers and agents working on the feature toggle plugin.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)

## Decisions

- [adr/](adr/index.md) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- [`src/docs/README.md`](../src/docs/README.md) — the feature toggle plugin specification beside its code
- [adr/](adr/index.md) — concrete architectural decisions; blank ADR templates remain under `.sdd/`

This package is a library, so there is no service specification and no OpenAPI document. Exact
contract details live in the native sources linked from the architecture index: `package.json` and
`src/index.js` for the package, and `src/feature.js` for the plugin API and events.

## Related repository resources

- [`README.md`](../README.md) — retained npm usage page; see [ADR-0001](adr/0001-retain-product-readme.md)
- [`AGENTS.md`](../AGENTS.md) — agent instructions for this package
