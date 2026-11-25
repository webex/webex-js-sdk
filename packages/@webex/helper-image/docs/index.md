---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-opus-5
approved_by: rarajes2@cisco.com
updated_at: 2026-09-28T14:57:53Z
validation_status: pass-with-warnings
-->

# @webex/helper-image documentation

Doc map for developers and agents working in this package: a published Webex JavaScript SDK helper
that reads EXIF orientation onto image files, resolves their MIME type, and measures and thumbnails
them through separate Node and browser implementations.

## Start here

- [Getting started](getting-started.md)
- [Repository architecture](architecture.md)
- Service specification — not applicable; this package is a published library with no deployable
  service surface
- API specification — not applicable; the published contract is the package export surface declared
  in `package.json` and `src/index.js`, not an HTTP API

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical repository-wide architecture
- Service specification — omitted; see the artifact decisions in `.sdd/manifest.json`
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- [`src/docs/README.md`](../src/docs/README.md) — the owning specification beside the module's code.
  This package has exactly one module, so this is the only module specification
- [adr/](adr/) — concrete architectural decisions; blank ADR templates remain under `.sdd/`

Use the manifest-linked native source for exact contract details: OpenAPI for published repository
HTTP APIs, route code for internal HTTP surfaces, and ecosystem-native artifacts for published SDKs.
Register and link those sources from the architecture index and owning module spec instead of copying
them into Markdown.

## Related repository resources

- [`../README.md`](../README.md) — consumer-facing npm readme. Reference-only context, and incomplete:
  it omits `processImage` and `detectFileType` and presents the module-internal `orient` as a package
  export. The module spec is authoritative for the public surface.
- [`../AGENTS.md`](../AGENTS.md) — agent instructions for this package.
- Contributing and security reporting are owned at the workspace level rather than per package; the
  consumer readme links the workspace contributing guide.
