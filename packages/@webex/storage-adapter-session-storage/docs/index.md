---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T06:13:09Z
validation_status: pass
-->

# @webex/storage-adapter-session-storage documentation

Doc map for developers and agents working on the sessionStorage storage adapter.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)

## Decisions

- [adr/](adr/index.md) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- [`src/docs/README.md`](../src/docs/README.md) — the sessionStorage adapter specification beside its
  code
- [adr/](adr/index.md) — concrete architectural decisions; blank ADR templates remain under the
  monorepo root `.sdd/`

This package is a library, so there is no service specification and no OpenAPI document. Exact
contract details live in the native sources linked from the architecture index: `package.json` for
the published package and `src/index.js` for the adapter and its stored document.

## Related repository resources

- [`README.md`](../README.md) — retained npm page; context only, and its description calls the
  package a localStorage adapter, see [ADR-0001](adr/0001-retain-product-readme.md)
- [`AGENTS.md`](../AGENTS.md) — agent instructions for this package
