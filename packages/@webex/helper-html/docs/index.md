---
okf_version: "0.1"
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: cursor
approved_by: akulakum@cisco.com
updated_at: 2026-10-01T11:15:00Z
validation_status: pass-with-warnings
-->

# @webex/helper-html documentation

Doc map for developers and agents.

This package publishes an HTML allow-list filter. Browser builds sanitize markup. Node builds return the input string from the filter exports and still escape angle brackets and ampersands through `escape` and `escapeSync`.

## Start here

- [Getting started](getting-started.md)
- [Repository architecture](architecture.md)
- [Module specification](../src/docs/README.md) — behavior of `src/`

## Decisions

- [adr/](adr/) — architectural decision records

## Specifications and contracts

- [architecture.md](architecture.md) — canonical repository-wide architecture
- [specs/README.md](specs/README.md) — manifest-backed module and contract registry
- `src/docs/README.md` — the owning specification beside the module's code
- [adr/](adr/) — concrete architectural decisions

No deployable service exists in this package, so no service specification is generated. The published contract is an npm/SDK surface whose authoritative source is `package.json` together with `src/index.js`, not an OpenAPI document.

## Related repository resources

- `README.md` — the package's npm-facing usage document, retained separately from this generated documentation set. See [ADR 0001](adr/0001-retain-product-readme.md).

No `ci/`, `operate/`, `diagrams/`, or runbook directories exist in this package.
