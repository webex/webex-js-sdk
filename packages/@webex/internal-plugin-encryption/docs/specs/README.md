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
updated_at: 2026-11-16T05:59:53Z
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
| Encryption plugin | Module | `src/docs/README.md` | @webex/web-sdk | Draft | 2026-11-16 |
| Retain the product README | ADR | `docs/adr/0001-retain-product-readme.md` | @webex/web-sdk | Accepted | 2026-11-16 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | `webex.internal.encryption` and `.kms`: content crypto, the key cache, KMS requests over an ECDH session, batching, certificate validation, and the shipped Union bundle | Partial | `src/docs/README.md` |

Generator-side field measurement is complete (100%, assessed 2026-11-16). Independent validation passed on 2026-11-16 (0 Blocking, 0 findings; previous finding VAL-001 closed after current-install unit tests passed 92 of 92). The module remains Partial pending unit cases for the untested requirements, a characterization baseline, and promotion review.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/internal-plugin-encryption build:src`, `test:unit`, and `test:style`, and the module spec |
| A stable code, package, or component boundary | `src/docs/README.md` | Build, unit tests, and lint |
| Certificate validation, CA roots, or the shipped bundle | `src/docs/README.md` (MOD-023 to MOD-026, INV-001 to INV-003, INV-007), `src/kms.js`, `src/kms-certificate-validation.js`, `src/union-bundle.js` | Build, then `test/unit/spec/kms.js` and `test/unit/spec/kms-certificate-validation.js` |
| A KMS request, retries, batching, or the context | The module spec's requirements and State machine, `src/kms.js`, `src/kms-batcher.js` | Build, unit tests, and lint; add unit cases, since batching and retries have none; integration in CI |
| Content crypto, the key cache, or download | The module spec, `src/encryption.js`, `src/ensure-buffer.js` | Build, unit tests, and lint; integration in CI |
| Registration or the payload transforms | The module spec (MOD-001 to MOD-004), `src/index.js`, `package.json` | Build, unit tests, and lint; check consuming plugins |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Register every module and submodule in the Module registry above in manifest tree
order.

Contracts are registered in `.sdd/manifest.json` `contract_catalog` and indexed in
[`docs/architecture.md`](../architecture.md#public-and-consumer-surfaces) with a stable ID, publication
state, native source, and owning module. This page provides navigation and ownership rather than a copied
contract.
