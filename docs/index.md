---
okf_version: '0.1'
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: docs-index@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-11-09T11:26:47Z
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
| `@webex/internal-plugin-conversation` | `packages/@webex/internal-plugin-conversation/` | [AGENTS.md](../packages/@webex/internal-plugin-conversation/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-conversation/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-conversation/.sdd/manifest.json) |
| `@webex/internal-plugin-feature` | `packages/@webex/internal-plugin-feature/` | [AGENTS.md](../packages/@webex/internal-plugin-feature/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-feature/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-feature/.sdd/manifest.json) |
| `@webex/internal-plugin-locus` | `packages/@webex/internal-plugin-locus/` | [AGENTS.md](../packages/@webex/internal-plugin-locus/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-locus/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-locus/.sdd/manifest.json) |
| `@webex/internal-plugin-user` | `packages/@webex/internal-plugin-user/` | [AGENTS.md](../packages/@webex/internal-plugin-user/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-user/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-user/.sdd/manifest.json) |
| `@webex/internal-plugin-wdm` | `packages/@webex/internal-plugin-wdm/` | [AGENTS.md](../packages/@webex/internal-plugin-wdm/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-wdm/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-wdm/.sdd/manifest.json) |
| `@webex/plugin-authorization-browser` | `packages/@webex/plugin-authorization-browser/` | [AGENTS.md](../packages/@webex/plugin-authorization-browser/AGENTS.md) | [docs/index.md](../packages/@webex/plugin-authorization-browser/docs/index.md) | [.sdd/manifest.json](../packages/@webex/plugin-authorization-browser/.sdd/manifest.json) |
| `@webex/plugin-authorization-browser-first-party` | `packages/@webex/plugin-authorization-browser-first-party/` | [AGENTS.md](../packages/@webex/plugin-authorization-browser-first-party/AGENTS.md) | [docs/index.md](../packages/@webex/plugin-authorization-browser-first-party/docs/index.md) | [.sdd/manifest.json](../packages/@webex/plugin-authorization-browser-first-party/.sdd/manifest.json) |
| `@webex/storage-adapter-local-storage` | `packages/@webex/storage-adapter-local-storage/` | [AGENTS.md](../packages/@webex/storage-adapter-local-storage/AGENTS.md) | [docs/index.md](../packages/@webex/storage-adapter-local-storage/docs/index.md) | [.sdd/manifest.json](../packages/@webex/storage-adapter-local-storage/.sdd/manifest.json) |
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
