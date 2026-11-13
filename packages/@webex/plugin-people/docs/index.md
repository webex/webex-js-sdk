---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T16:20:06Z
validation_status: pass-with-warnings
-->

# @webex/plugin-people documentation

Doc map for developers and agents working on the People plugin.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)

## Decisions

- [adr/](adr/index.md) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- [`src/docs/README.md`](../src/docs/README.md) — the People plugin specification beside its code
- [adr/](adr/index.md) — concrete architectural decisions; blank ADR templates remain under the
  monorepo root `.sdd/`

This package is a library, so there is no service specification and no OpenAPI document. Exact
contract details live in the native sources linked from the architecture index: `package.json`,
`src/index.js`, and `src/config.js` for the package and its defaults, and `src/people.js` and
`src/people-batcher.js` for the API.

## Related repository resources

- [`README.md`](../README.md) — retained npm page; context only, it shows only `get(id)`, see
  [ADR-0001](adr/0001-retain-product-readme.md)
- [`AGENTS.md`](../AGENTS.md) — agent instructions for this package
