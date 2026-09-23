---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: rsarika@cisco.com
updated_at: 2026-09-23T06:45:42Z
validation_status: not-run
-->

# @webex/storage-adapter-spec documentation

Doc map for developers and agents.

This package publishes one thing: an executable conformance suite that every Webex storage adapter
runs against itself. If you are here to change behavior, the contract lives in the module
specification, not in this page.

## Start here

- [Getting started](getting-started.md)
- [Repository architecture](architecture.md)
- [Module specification](../src/docs/README.md) — the conformance suite's behavior and contract

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical repository-wide architecture
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `src/docs/README.md` — the owning specification beside the module's code
- [adr/](adr/) — concrete architectural decisions; blank ADR templates remain under `.sdd/`

No deployable service exists in this package, so no service specification is generated. The published
contract is an npm/SDK surface whose authoritative source is `src/index.js`, not an OpenAPI document.

Use the manifest-linked native source for exact contract details: OpenAPI for published repository
HTTP APIs, route code for internal HTTP surfaces, and ecosystem-native artifacts for published SDKs.
Register and link those sources from the architecture index and owning module spec instead of copying
them into Markdown.

## Related repository resources

- `README.md` — the package's npm-facing usage document, owned and maintained separately from this
  generated documentation set.

No `ci/`, `operate/`, `diagrams/`, or runbook directories exist in this package.
