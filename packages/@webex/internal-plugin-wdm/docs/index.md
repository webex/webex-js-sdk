---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-10-12T15:10:04Z
validation_status: pass
-->

# @webex/internal-plugin-wdm documentation

Doc map for developers and agents working on the deprecated Webex JS SDK WDM alias package.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)

## Decisions

- [adr/](adr/index.md) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package architecture and the contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- [src/docs/README.md](../src/docs/README.md) — the owning specification beside the module's code
- [adr/](adr/index.md) — concrete architectural decisions; blank ADR templates remain in the monorepo root `.sdd/` templates, reached from this package through the `.sdd/templates/repo-standards` symlink

No service specification or OpenAPI document exists: this package is a library, not a deployable service, and it
owns no HTTP contract. The published SDK surface is described by `package.json` and the module's `Public surface`
section; it is registered in the architecture index rather than copied into Markdown. Behavior behind the
re-exports is specified by the device package's
module specification (the device package's own `src/docs/README.md`, outside this package).

## Related repository resources

The package README ([../README.md](../README.md)) is the package's own deprecation notice and usage text; it is kept
separate from these generated documents. No `ci/`, `operate/`, runbook, or diagram folders exist for this package.
