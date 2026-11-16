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
updated_at: 2026-11-12T14:15:30Z
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
| Team plugin | Module | `src/docs/README.md` | @webex/web-sdk | Draft | 2026-11-12 |
| Retain the product README | ADR | `docs/adr/0001-retain-product-readme.md` | @webex/web-sdk | Accepted | 2026-11-12 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | `webex.internal.team`: team create, read, and list; team conversations; team activities through the general conversation; the payload transforms that encrypt and decrypt team names and summaries | Partial | `src/docs/README.md` |

Generator-side field measurement for the module is complete (100%, assessed 2026-11-12). Independent
semantic validation passed with warnings on 2026-11-12 (0 Blocking; one Important finding: B11-001,
the command-source parity of the workspace-qualified command form, accepted as a warning). A
characterization baseline and promotion past Partial remain pending.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/internal-plugin-team build:src`, then `test:unit` and `test:style`, and the module spec |
| A stable code, package, or component boundary | `src/docs/README.md` | Build, unit tests, and lint |
| A public method, request body, activity, transform, or config default | The owning architecture section, `src/docs/README.md`, and the native definition in `src/team.js`, `src/index.js`, `src/config.js`, or `package.json` | Build, unit tests, and lint; check the conversation plugin's transform dispatch when a transform name changes |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Register every module and submodule in the Module registry above in manifest tree
order.

Contracts are registered in `.sdd/manifest.json` `contract_catalog` and indexed in
[`docs/architecture.md`](../architecture.md#public-and-consumer-surfaces) with a stable ID, publication
state, native source, and owning module. This page provides navigation and ownership rather than a copied
contract.
