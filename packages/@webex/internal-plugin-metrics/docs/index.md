---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-10-07T04:50:31Z
validation_status: pass
-->

# @webex/internal-plugin-metrics documentation

Doc map for developers and agents working on the Webex JS SDK metrics plugin: the package that
collects, enriches, batches and submits every SDK-owned telemetry family to the Webex metrics and
unified telemetry services.

## Start here

- [Getting started](getting-started.md)
- [Repository architecture](architecture.md)
- Service specification — not applicable; this package is a library plugin with no deployable
  service, recorded as `docs/service.md: omit` in `.sdd/manifest.json`.
- API specification — not applicable; the package owns no HTTP surface, recorded as
  `api-specs/openapi.yaml: omit` in `.sdd/manifest.json`.

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical repository-wide architecture and the contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `<module-path>/docs/README.md` — the owning specification beside each module's code, one per
  module in the registry
- [adr/](adr/) — concrete architectural decisions; blank ADR templates remain under `.sdd/`

Use the manifest-linked native source for exact contract details: the ecosystem-native SDK exports
in `package.json` and `src/index.ts` for the published package surface, the TypeScript declarations
in `src/metrics.types.ts` for every event envelope, and the externally owned
`@webex/event-dictionary-ts` schema for Call Analyzer event names and payload fields. Register and
link those sources from the architecture index and the owning module spec instead of copying them
into Markdown.

## Related repository resources

- [README.md](../README.md) — the published npm landing page for this package. It is owner-authored
  and retained in place; it is not generated and is not a canonical specification.
- Monorepo-level contribution, security and release governance lives at the `webex-js-sdk`
  repository root rather than in this package.
