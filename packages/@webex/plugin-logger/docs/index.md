---
okf_version: "0.1"
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-08T08:51:39Z
validation_status: pass-with-warnings
-->

# @webex/plugin-logger documentation

Doc map for developers and agents.

This package publishes the Webex SDK logger plugin. It prints leveled output to `console`, redacts authorization keys, email addresses, and MTID values, and keeps bounded in-memory buffers that `@webex/internal-plugin-support` formats and uploads.

## Start here

- [Getting started](getting-started.md)
- [Package architecture](architecture.md)
- [Module specification](../src/docs/README.md) — behavior of `src/`

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical package-wide architecture
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `src/docs/README.md` — the owning specification beside the module's code
- [adr/](adr/) — concrete architectural decisions

No deployable service exists in this package, so no service specification is generated. The published contract is an npm/SDK surface whose authoritative source is `package.json` together with `src/index.js`, not an OpenAPI document.

## Related repository resources

- `README.md` — the package's npm-facing usage document, retained separately from this generated documentation set. See [ADR 0001](adr/0001-retain-product-readme.md).

No `ci/`, `operate/`, `diagrams/`, or runbook directories exist in this package.
