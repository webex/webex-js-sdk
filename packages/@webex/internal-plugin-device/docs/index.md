---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-10-07T15:08:52Z
validation_status: pass
-->

# @webex/internal-plugin-device documentation

Doc map for developers and agents working on the Webex JS SDK device plugin package.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)

## Decisions

- [adr/](adr/index.md) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package architecture and the contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- [src/docs/README.md](../src/docs/README.md) — the owning specification beside the module's code
- [adr/](adr/index.md) — concrete architectural decisions; blank ADR templates remain under the repository's `.sdd/` templates

No service specification or OpenAPI document exists: this package is a library, not a deployable service, and it
owns no HTTP contract. The published SDK surface is described by `package.json` and the module's `Public surface`
section; it is registered in the architecture index rather than copied into Markdown.

## Related repository resources

The package README ([../README.md](../README.md)) is the original usage guide and remains the consumer-facing
introduction. No `ci/`, `operate/`, runbook, or diagram folders exist for this package.
