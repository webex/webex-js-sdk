---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-10-22T06:52:30Z
validation_status: pass
-->

# @webex/internal-plugin-user documentation

Doc map for developers and agents.

This package is the Webex JS SDK's user identity plugin. It registers `webex.internal.user`, which
turns emails and user objects into uuids through a batched lookup and an in-memory cache, and wraps
the identity, atlas, conversation, and SCIM calls for account verification, activation, one-time
passwords, password and name updates, and preferred meeting site updates.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)
- [User plugin specification](../src/docs/README.md) — behavior of `src/`

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package-wide architecture and contract index
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `src/docs/README.md` — the owning specification beside the module's code
- [adr/](adr/) — concrete architectural decisions

No deployable service exists in this package, so no service specification is generated. The
published contract is an npm/SDK surface whose authoritative source is `package.json` with
`src/index.js`. The outbound service calls are an internal contract sourced from `src/user.js`. No
OpenAPI document applies.

## Related repository resources

- `README.md` — the package's npm-facing usage page, retained separately from this generated
  documentation set. See [ADR 0001](adr/0001-retain-product-readme.md).

No `ci/`, `operate/`, `diagrams/`, or runbook directories exist in this package.
