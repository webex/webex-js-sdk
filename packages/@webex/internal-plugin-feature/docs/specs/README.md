---
type: Reference
title: Specification registry
description: Canonical specification registry and change-routing guide.
tags: [specifications, registry]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: spec-index@0.3.0
generated_by: claude-code
approved_by: riag@cisco.com
updated_at: 2026-10-28T08:54:44Z
validation_status: pass
-->

# Specification registry

Use this page to find the canonical package architecture and every instantiated module specification
plus native contract. Keep technical facts in one owning document and use this page only for
navigation, ownership, status, and change/test routing.

Start with the [package architecture](../architecture.md). No service specification exists because this
package is a library.

## Document roles

| Document | Canonical ownership |
| -------- | ------------------- |
| [Package architecture](../architecture.md) | Package boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture |
| Module specifications | Stable behavior and design at each manifest-routed `<module-path>/docs/README.md` |
| [ADR](../adr/index.md) | A durable decision, its deciders, rationale, consequences, and supersession lineage |

## Instantiated specification registry

| Resource | Role | Canonical path | Owner | Status | Last verified |
| -------- | ---- | -------------- | ----- | ------ | ------------- |
| Package | Architecture | `docs/architecture.md` | @webex/web-sdk | Draft | 2026-10-28 |
| Feature toggle plugin | Module | `src/docs/README.md` | @webex/web-sdk | Draft | 2026-10-28 |
| Retain the product README | ADR | `docs/adr/0001-retain-product-readme.md` | @webex/web-sdk | Accepted | 2026-10-12 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | `webex.internal.feature`: promise-based toggle reads, writes to the Feature service, pushed-update handling, and `change:*` events over the device feature collections | Partial | `src/docs/README.md` |

Generator-side field measurement for the module is complete (93.3%, assessed 2026-10-28). Independent
semantic validation by runtime `codex`, session `01a181ab-6ee4-7841-822a-c45cb65b8d99`, passed on
2026-10-28 with no findings. Drift recording, a characterization baseline, and promotion past Partial
remain pending.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/internal-plugin-feature test:unit` and the module spec |
| A stable code, package, or component boundary | `src/docs/README.md` | Module tests plus affected contracts |
| A public API, event, or package contract | The owning architecture section, `src/docs/README.md`, and the native definition in `src/feature.js` or `package.json` | Unit tests; check Mercury, LLM, board, conversation, and presence callers |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Register every module and submodule in the Module registry above in manifest tree
order.

Contracts are registered in `.sdd/manifest.json` `contract_catalog` and indexed in
[`docs/architecture.md`](../architecture.md#public-and-consumer-surfaces) with a stable ID, publication
state, native source, and owning module. This page provides navigation and ownership rather than a copied
contract.
