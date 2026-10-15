---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-09-23T06:29:48Z
validation_status: pass-with-warnings
-->

# @webex/http-core documentation

Doc map for developers and agents working on the core HTTP client of the Webex JS SDK.

## Start here

- [Getting started](getting-started.md)
- [Repository architecture](architecture.md)

No service specification exists: this package is a published library, not a deployable service. No
API specification exists either — it is an HTTP *client* and serves no routes, so its published
contract is the npm package export surface declared by `package.json`.

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical repository-wide architecture
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `<module-path>/docs/README.md` — the owning specification beside each module's code:
  - [src/docs/README.md](../src/docs/README.md) — the package surface: exports, error taxonomy, interceptor contract
  - [src/request/docs/README.md](../src/request/docs/README.md) — the request pipeline and its Node and browser transports
- [adr/](adr/) — concrete architectural decisions; blank ADR templates remain under `.sdd/`

Use the manifest-linked native source for exact contract details. For this package that is
`package.json` and the exports it declares; register and link that source from the architecture index
and owning module spec instead of copying signatures into Markdown.

## Related repository resources

- [README.md](../README.md) — the package's published usage documentation on npm
- [AGENTS.md](../AGENTS.md) — agent working instructions for this package
