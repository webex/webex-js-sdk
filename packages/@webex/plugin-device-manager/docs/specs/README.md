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
approved_by: rarajes2@cisco.com
updated_at: 2026-11-13T03:13:49Z
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
| Package | Architecture | `docs/architecture.md` | @webex/web-client, @webex/web-sdk | Draft | 2026-11-13 |
| Device Manager plugin | Module | `src/docs/README.md` | @webex/web-client, @webex/web-sdk | Draft | 2026-11-13 |
| Retain the product README | ADR | `docs/adr/0001-retain-product-readme.md` | @webex/web-client, @webex/web-sdk | Accepted | 2026-11-13 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | `webex.devicemanager`: recent devices from WDM, device search, Lyra PIN pairing, conversation binding, and audio control | Partial | `src/docs/README.md` |

Generator-side field measurement is complete (100%, assessed 2026-11-13). Independent semantic
validation passed on 2026-11-13 with validator runtime `01a1d2c4-873e-7eb1-bbd2-4e40457e8616` and no findings. The module remains
Partial pending unit cases for untested requirements, a characterization baseline, and promotion
review.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn build:src`, `test:unit`, and `test:style`, and the module spec |
| A stable code, package, or component boundary | `src/docs/README.md` | Build, unit tests, and lint |
| A public method, guard, pairing transition, WDM request, or the registration | The owning architecture section, `src/docs/README.md`, and the native definition in `src/device-manager.js`, `src/collection.js`, `src/index.js`, or `package.json` | Build, unit tests, and lint; add a `test/unit/spec` case for the changed path, since most methods have none |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Register every module and submodule in the Module registry above in manifest tree
order.

Contracts are registered in `.sdd/manifest.json` `contract_catalog` and indexed in
[`docs/architecture.md`](../architecture.md#public-and-consumer-surfaces) with a stable ID, publication
state, native source, and owning module. This page provides navigation and ownership rather than a copied
contract.
