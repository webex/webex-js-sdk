---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-17T03:14:21Z
validation_status: pass-with-warnings
-->

# @webex/plugin-meetings documentation

Doc map for developers and agents working on the meetings plugin, `webex.meetings`.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)
- [Agent instructions](../AGENTS.md)

## Decisions

- [adr/](adr/index.md) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `src/<module>/docs/README.md` — the owning specification beside each of the 23 modules' code, for
  example [`src/meeting/docs/README.md`](../src/meeting/docs/README.md) and
  [`src/meetings/docs/README.md`](../src/meetings/docs/README.md); the registry lists them all
- [adr/](adr/index.md) — concrete architectural decisions; blank ADR templates remain under the
  monorepo root `.sdd/`

This package is a library, so there is no service specification and no OpenAPI document. Exact
contract details live in the native sources linked from the architecture contract index:
`package.json` and `src/index.ts` for the published package, its registration, and its exports;
`src/constants.ts` for event names; and the request files, such as `src/meeting/request.ts`,
`src/meetings/request.ts`, `src/meeting-info/meeting-info-v2.ts`, and `src/roap/request.ts`, for the
internal Locus, site-preference, meeting-info, and ROAP HTTP clients.

## Related repository resources

- [`README.md`](../README.md) — retained consumer guide; context only, verify against code
- [`UPGRADING.md`](../UPGRADING.md) — retained upgrade guide; context only
- [`internal-README.md`](../internal-README.md) — retained historical contributor notes; current
  scripts take precedence
- Feature READMEs, context only: [`src/breakouts/README.md`](../src/breakouts/README.md),
  [`src/interpretation/README.md`](../src/interpretation/README.md), and
  [`src/aiEnableRequest/README.md`](../src/aiEnableRequest/README.md)
- [`AGENTS.md`](../AGENTS.md) — agent instructions for this package
