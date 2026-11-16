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
updated_at: 2026-11-12T17:30:10Z
validation_status: pass-with-warnings
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
| Package | Architecture | `docs/architecture.md` | @webex/web-sdk | Draft | 2026-11-12 |
| Messages plugin | Module | `src/docs/README.md` | @webex/web-sdk | Draft | 2026-11-12 |
| Retain the product README | ADR | `docs/adr/0001-retain-product-readme.md` | @webex/web-sdk | Accepted | 2026-11-12 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | `webex.messages`: message post, edit, read, list, and delete through Hydra, with multipart file uploads; webhook-shaped message events from the Mercury socket | Partial | `src/docs/README.md` |

Generator-side field measurement for the module is complete (100%, assessed 2026-11-12). Independent semantic validation passed with warnings on 2026-11-12 (0 Blocking, 1 Important). A unit
suite, a characterization baseline, and promotion past Partial remain pending.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn build:src` and `test:style`, and the module spec |
| A stable code, package, or component boundary | `src/docs/README.md` | Build and lint |
| A public method, request path, payload rule, event field, or the registration | The owning architecture section, `src/docs/README.md`, and the native definition in `src/messages.js`, `src/index.js`, or `package.json` | Build and lint; add a `test/unit/spec` case and a `test:unit` script for the changed path, since the package has no unit tests and the integration spec is skipped |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Register every module and submodule in the Module registry above in manifest tree
order.

Contracts are registered in `.sdd/manifest.json` `contract_catalog` and indexed in
[`docs/architecture.md`](../architecture.md#public-and-consumer-surfaces) with a stable ID, publication
state, native source, and owning module. This page provides navigation and ownership rather than a copied
contract.
