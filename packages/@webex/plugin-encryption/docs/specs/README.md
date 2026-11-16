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
updated_at: 2026-11-16T07:57:20Z
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
| Package | Architecture | `docs/architecture.md` | @webex/web-sdk | Draft | 2026-11-16 |
| Cypher plugin | Module | `src/docs/README.md` | @webex/web-sdk | Draft | 2026-11-16 |
| Retain the product docs | ADR | `docs/adr/0001-retain-product-docs.md` | @webex/web-sdk | Accepted | 2026-11-16 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | `webex.cypher`: device registration and encrypted file download and decryption through `webex.internal.encryption`, plus the standalone `Webex` constructor | Partial | `src/docs/README.md` |

Generator-side field measurement is complete (100%, assessed 2026-11-16). Independent validation passed on 2026-11-16 with 0 Blocking findings. The module remains Partial pending unit cases for the untested requirements, a characterization baseline, and promotion review.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn build:src`, `test:unit`, and `test:style`, and the module spec |
| A stable code, package, or component boundary | `src/docs/README.md` | Build, unit tests with coverage, and lint |
| `downloadAndDecryptFile`, its options, or its errors | `src/docs/README.md` (MOD-005 to MOD-008, INV-001, INV-003, and the download-error and progress-event known defects), `src/cypher/index.ts`, `src/cypher/types.ts` | Build, then `test/unit/spec/cypher/index.ts`; add cases for the untested paths |
| `register`, `deregister`, or the registered flag | The module spec (MOD-003, MOD-004, INV-002, State machine), `src/cypher/index.ts` | Build, unit tests, and lint |
| The standalone constructor, its defaults, or the package entries | The module spec (MOD-011 and the types and config known defects), `src/webex.js`, `src/webex-config.ts`, `package.json` | Build and lint; no unit case loads these files, so check the built main and the `webex` and `webex-node` packages |
| Registration of `cypher` | The module spec (MOD-001), `src/index.ts`, `src/config.ts` | Build, unit tests, and lint |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Register every module and submodule in the Module registry above in manifest tree
order.

Contracts are registered in `.sdd/manifest.json` `contract_catalog` and indexed in
[`docs/architecture.md`](../architecture.md#public-and-consumer-surfaces) with a stable ID, publication
state, native source, and owning module. This page provides navigation and ownership rather than a copied
contract.
