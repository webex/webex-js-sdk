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

# webex-js-sdk documentation

Doc map for developers and agents.

This repository is the Webex JS SDK monorepo. Its packages are onboarded one at a time; each onboarded
package owns its architecture, specifications, and decisions beside its code. This page routes to them.

## Start here

- [Repository agent instructions](../AGENTS.md)
- [Contributing](../CONTRIBUTING.md)

<!-- sdd-package-routing:start -->
## SDD package routing

| Package | Path | Agent entry | Docs | Manifest |
| --- | --- | --- | --- | --- |
| `@webex/internal-plugin-user` | `packages/@webex/internal-plugin-user/` | [AGENTS.md](../packages/@webex/internal-plugin-user/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-user/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-user/.sdd/manifest.json) |
<!-- sdd-package-routing:end -->

## Decisions

No repository-level architectural decision records exist. Decisions are recorded by each onboarded
package under its own `docs/adr/`.

## Specifications and contracts

Architecture, module specifications, and contract indexes are generated per package, not at the
repository root. Open the package row above, then its `docs/index.md`.

## Related repository resources

- [README](../README.md) — product overview and usage
- `docs/` also holds the published website sources for this repository; they are separate from the SDD documentation.
