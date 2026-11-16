---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T13:41:05Z
validation_status: pass
-->

# @webex/byods documentation

Doc map for developers and agents.

This package is the Bring Your Own Data Source (BYoDS) Node.js SDK. One `BYODS` instance manages a
Webex Service App token pair for one organization, calls the Webex data source API, renews data
source JWS tokens on a timer, and verifies JWS tokens that Webex presents to a data source.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)
- [BYoDS SDK specification](../src/docs/README.md) — behavior of `src/`

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package-wide architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `src/docs/README.md` — the owning specification beside the module's code
- [adr/](adr/) — concrete architectural decisions

No deployable service exists in this package, so no service specification is generated. The
published contract is an npm/SDK surface whose authoritative source is `package.json` with the
`src/index.ts` entry. The package serves no HTTP API, so no OpenAPI document applies; the Webex
endpoints it calls are external contracts.

## Related repository resources

- `README.md` — the package's npm-facing page, retained separately from this generated
  documentation set. See [ADR 0001](adr/0001-retain-product-readme.md).

No `ci/`, `operate/`, `diagrams/`, or runbook directories exist in this package.
