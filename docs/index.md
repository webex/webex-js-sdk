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
| `@webex/internal-plugin-dss` | `packages/@webex/internal-plugin-dss/` | [AGENTS.md](../packages/@webex/internal-plugin-dss/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-dss/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-dss/.sdd/manifest.json) |
| `@webex/internal-plugin-ai-assistant` | `packages/@webex/internal-plugin-ai-assistant/` | [AGENTS.md](../packages/@webex/internal-plugin-ai-assistant/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-ai-assistant/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-ai-assistant/.sdd/manifest.json) |
| `@webex/internal-plugin-calendar` | `packages/@webex/internal-plugin-calendar/` | [AGENTS.md](../packages/@webex/internal-plugin-calendar/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-calendar/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-calendar/.sdd/manifest.json) |
| `@webex/internal-plugin-board` | `packages/@webex/internal-plugin-board/` | [AGENTS.md](../packages/@webex/internal-plugin-board/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-board/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-board/.sdd/manifest.json) |
| `@webex/internal-plugin-ediscovery` | `packages/@webex/internal-plugin-ediscovery/` | [AGENTS.md](../packages/@webex/internal-plugin-ediscovery/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-ediscovery/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-ediscovery/.sdd/manifest.json) |
| `@webex/internal-plugin-feature` | `packages/@webex/internal-plugin-feature/` | [AGENTS.md](../packages/@webex/internal-plugin-feature/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-feature/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-feature/.sdd/manifest.json) |
| `@webex/internal-plugin-user` | `packages/@webex/internal-plugin-user/` | [AGENTS.md](../packages/@webex/internal-plugin-user/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-user/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-user/.sdd/manifest.json) |
| `@webex/internal-plugin-voicea` | `packages/@webex/internal-plugin-voicea/` | [AGENTS.md](../packages/@webex/internal-plugin-voicea/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-voicea/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-voicea/.sdd/manifest.json) |
| `@webex/internal-plugin-wdm` | `packages/@webex/internal-plugin-wdm/` | [AGENTS.md](../packages/@webex/internal-plugin-wdm/AGENTS.md) | [docs/index.md](../packages/@webex/internal-plugin-wdm/docs/index.md) | [.sdd/manifest.json](../packages/@webex/internal-plugin-wdm/.sdd/manifest.json) |
| `@webex/plugin-authorization` | `packages/@webex/plugin-authorization/` | [AGENTS.md](../packages/@webex/plugin-authorization/AGENTS.md) | [docs/index.md](../packages/@webex/plugin-authorization/docs/index.md) | [.sdd/manifest.json](../packages/@webex/plugin-authorization/.sdd/manifest.json) |
| `@webex/plugin-authorization-browser-first-party` | `packages/@webex/plugin-authorization-browser-first-party/` | [AGENTS.md](../packages/@webex/plugin-authorization-browser-first-party/AGENTS.md) | [docs/index.md](../packages/@webex/plugin-authorization-browser-first-party/docs/index.md) | [.sdd/manifest.json](../packages/@webex/plugin-authorization-browser-first-party/.sdd/manifest.json) |
| `@webex/plugin-authorization-node` | `packages/@webex/plugin-authorization-node/` | [AGENTS.md](../packages/@webex/plugin-authorization-node/AGENTS.md) | [docs/index.md](../packages/@webex/plugin-authorization-node/docs/index.md) | [.sdd/manifest.json](../packages/@webex/plugin-authorization-node/.sdd/manifest.json) |
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
