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

# webex-js-sdk documentation

Doc map for developers and agents at the monorepo root. Architecture, specifications, and decisions
belong to each onboarded package; this page routes to them.

## Start here

- [Workspace agent instructions](../AGENTS.md) — environment, build, and test conventions for every
  package
- Each onboarded package's own `docs/index.md`, listed in the package routing table below

No root architecture document, service specification, or root OpenAPI document exists; each package
documents its own architecture and contracts.

## Decisions

No root-level architectural decision records exist. Package decisions live in each package's
`docs/adr/`.

## Specifications and contracts

Use each package's `docs/architecture.md` for its contract index and its `docs/specs/README.md` for
its module registry. Exact contract details stay in the native source each package manifest links:
ecosystem-native artifacts such as `package.json` for published SDK packages.

<!-- sdd-package-routing:start -->
## SDD package routing

| Package | Path | Agent entry | Docs | Manifest |
| --- | --- | --- | --- | --- |
| `plugin-authorization-browser-first-party` | `packages/@webex/plugin-authorization-browser-first-party/` | [AGENTS.md](../packages/@webex/plugin-authorization-browser-first-party/AGENTS.md) | [docs/index.md](../packages/@webex/plugin-authorization-browser-first-party/docs/index.md) | [.sdd/manifest.json](../packages/@webex/plugin-authorization-browser-first-party/.sdd/manifest.json) |
<!-- sdd-package-routing:end -->

## Related repository resources

- [Root package manifest](../package.json) — workspace declarations and orchestration scripts
- [Code owners](../.github/CODEOWNERS) — package ownership
