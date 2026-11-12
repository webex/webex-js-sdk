---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-12T05:35:41Z
validation_status: pass
-->

# @webex/plugin-authorization documentation

Doc map for developers and agents working on the environment-selecting authorization entry.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)

## Decisions

- [adr/](adr/index.md) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- [`src/docs/README.md`](../src/docs/README.md) — the environment-selecting entry specification
  beside its code
- [adr/](adr/index.md) — concrete architectural decisions; blank ADR templates remain under the
  monorepo root `.sdd/`

This package is a library, so there is no service specification and no OpenAPI document. Exact
contract details live in the native sources linked from the architecture index: `package.json`,
`src/index.js`, and `src/index.browser.js`. The `webex.authorization` API is documented by the
`@webex/plugin-authorization-node` and `@webex/plugin-authorization-browser` packages.

## Related repository resources

- [`README.md`](../README.md) — retained npm usage page; context only, see
  [ADR-0001](adr/0001-keep-existing-docs-separate.md)
- [`OAUTH-FLOW-GUIDE.md`](../OAUTH-FLOW-GUIDE.md) — retained OAuth overview; context only, see
  [ADR-0001](adr/0001-keep-existing-docs-separate.md)
- [`AGENTS.md`](../AGENTS.md) — agent instructions for this package
