---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: cursor
approved_by: pending
updated_at: 2026-09-16T10:06:00Z
validation_status: pass
-->

# @webex/web-extension-bridge documentation

Doc map for developers and agents working in this package. SDD root is the package, not the JS SDK monorepo.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)
- Service specification — N/A; this package is a client SDK, not a deployable service
- API specification — N/A; published contracts are npm package exports in `package.json`

## Decisions

- [adr/](adr/) — architectural decision records (none registered yet)

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package-wide architecture and consumer-surface index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `src/core/docs/README.md`, `src/web/docs/README.md`, `src/extension/docs/README.md` — owning specifications beside each module's code
- [adr/](adr/) — concrete architectural decisions; blank ADR templates remain under `.sdd/`
- [SECURITY.md](../SECURITY.md) — disclosure policy and in-scope threats
- [README.md](../README.md) — product README (not overwritten by SDD generation)

Use the manifest-linked native source for exact contract details. Register and link those sources from the architecture index and owning module spec instead of copying them into Markdown.

## Related repository resources

- Product samples live at JS SDK repo `docs/samples/web-extension-bridge` and `docs/samples/web-extension-bridge-extension`, outside this SDD root.
- Unit tests live at `test/unit`.
