---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T10:21:50Z
validation_status: pass-with-warnings
-->

# @webex/internal-plugin-dss documentation

Doc map for developers and agents working on the Directory Search Service (DSS) plugin.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)

## Decisions

- [adr/](adr/index.md) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- [`src/docs/README.md`](../src/docs/README.md) — the DSS plugin specification beside its code
- [adr/](adr/index.md) — concrete architectural decisions; blank ADR templates remain under the
  monorepo root `.sdd/`

This package is a library, so there is no service specification and no OpenAPI document. Exact
contract details live in the native sources linked from the architecture index: `package.json` and
`src/index.ts` for the package, `src/dss.ts` for the API, `src/dss-batcher.ts` for lookup batching,
and `src/constants.ts`, `src/types.ts`, and `src/dss-errors.ts` for event names, result paths, option
types, and the timeout error.

## Related repository resources

- [`README.md`](../README.md) — retained npm usage page; context only and partly stale, see
  [ADR-0001](adr/0001-retain-product-readme.md)
- [`AGENTS.md`](../AGENTS.md) — agent instructions for this package
