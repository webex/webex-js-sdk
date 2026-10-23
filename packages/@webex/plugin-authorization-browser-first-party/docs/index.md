---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: pending
updated_at: 2026-10-14T13:20:00Z
validation_status: not-run
-->

# @webex/plugin-authorization-browser-first-party documentation

Doc map for developers and agents.

This package is the Webex JS SDK's first-party browser authorization plugin. It registers
`webex.authorization`, completes the OAuth Authorization Code + PKCE redirect during SDK
initialization, starts first-party and third-party login redirects, and runs the QR code (Device
Authorization) login flow for the Webex Web Client.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)
- [First-party browser authorization plugin specification](../src/docs/README.md) — behavior of `src/`

## Decisions

- [adr/](adr/index.md) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package-wide architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `src/docs/README.md` — the owning specification beside the module's code
- [adr/](adr/index.md) — concrete architectural decisions

No deployable service exists in this package, so no service specification is generated. The
published contracts are an npm/SDK surface whose authoritative source is `package.json` with
`src/index.js`, and the plugin event set whose source is `src/authorization.js`. No OpenAPI document
applies.

## Related repository resources

- `README.md` — the package's npm-facing usage page, retained separately from this generated
  documentation set. See [ADR 0001](adr/0001-retain-product-readme.md).
- [Monorepo documentation home](../../../../docs/index.md) — routes to every onboarded package.

No `ci/`, `operate/`, `diagrams/`, or runbook directories exist in this package.
