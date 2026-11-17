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
updated_at: 2026-11-12T11:40:54Z
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
| Search plugin | Module | `src/docs/README.md` | @webex/web-sdk | Draft | 2026-11-12 |
| Retain the product README | ADR | `docs/adr/0001-retain-product-readme.md` | @webex/web-sdk | Accepted | 2026-11-12 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | `webex.internal.search`: directory people lookup, activity search with a KMS-encrypted query and decrypted results through registered payload predicates, search key binding, and remote-cluster results | Partial | `src/docs/README.md` |

Generator-side field measurement for the module is complete (93.3%, assessed 2026-11-12).
Independent
semantic validation passed with warnings on 2026-11-12 under validator runtime
`01a1cf84-ad67-72e1-9afd-c1b97580ada4` (0 Blocking, 2 Important findings: the accepted warnings for
the missing unit-test command and for the command-source parity of the workspace-qualified command
form). A characterization baseline and promotion past Partial remain pending.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/internal-plugin-search build:src` and `test:style`, and the module spec; no unit test exists |
| A stable code, package, or component boundary | `src/docs/README.md` | Build and lint; add unit cases, because none exist |
| A public method, payload predicate or transform, resource, or request body | The owning architecture section, `src/docs/README.md`, and the native definition in `src/search.js`, `src/index.js`, or `package.json` | Build and lint; check `@webex/plugin-device-manager` and first-party clients that call `webex.internal.search` |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Register every module and submodule in the Module registry above in manifest tree
order.

Contracts are registered in `.sdd/manifest.json` `contract_catalog` and indexed in
[`docs/architecture.md`](../architecture.md#public-and-consumer-surfaces) with a stable ID, publication
state, native source, and owning module. This page provides navigation and ownership rather than a copied
contract.
