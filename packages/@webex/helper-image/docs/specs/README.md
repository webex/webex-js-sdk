---
type: Reference
title: Specification registry
description: Canonical specification registry and change-routing guide.
tags: [specifications, registry]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: spec-index@0.3.0
generated_by: claude-opus-5
approved_by: rarajes2@cisco.com
updated_at: 2026-09-28T14:57:53Z
validation_status: pass-with-warnings
-->

# Specification registry

Use this page to find the canonical repository architecture and every
instantiated service and module specification plus native contract. Keep technical facts
in one owning document and use this page only for navigation, ownership,
status, and change/test routing.

Start with the [repository architecture](../architecture.md). No service specification exists: this
package is a published library with no deployable service surface, recorded as an omitted artifact
in `.sdd/manifest.json`.

## Document roles

| Document                                            | Canonical ownership                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Repository architecture](../architecture.md)       | Repository boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture |
| Service specification                               | Not applicable — no deployable service in this package                                                       |
| Module specifications                                | Stable behavior and design at each module's manifest-routed spec; here, `src/docs/README.md`                    |
| [ADR](../adr/)                                      | A durable decision, its deciders, rationale, consequences, and supersession lineage                          |

## Instantiated specification registry

| Resource            | Role                        | Canonical path         | Owner                | Status | Last verified |
| ------------------- | --------------------------- | ---------------------- | -------------------- | ------ | ------------- |
| Repository          | Architecture                | `docs/architecture.md` | `@webex/web-client`  | Active | 2026-09-28    |
| Image helpers       | Module                      | `src/docs/README.md`   | `@webex/web-client`  | Active | 2026-09-28    |
| Package export surface | Contract (`helper-image-package-api`, published) | `package.json` | `@webex/web-client` | Active | 2026-09-28 |
| Thumbnail result triple | Contract (`image-thumbnail-png`, published) | `src/process-image.js` | `@webex/web-client` | Active | 2026-09-28 |

Contract detail stays in the native sources above and is indexed in
[`docs/architecture.md`](../architecture.md) under `Public and consumer surfaces`. `.sdd/manifest.json`
remains authoritative for each contract's publication state and canonical source.

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its
human-readable mirror and the reconciliation surface for `scripts/check_spec_index.py`.

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Reads EXIF orientation onto a file, resolves its MIME type, and measures and thumbnails it through separate Node and browser implementations | Partial | `src/docs/README.md` |

Generator-side field measurement for `src/` is complete: its coverage score is recorded in the module
spec's `Metadata` table. The module remains `Partial` because semantic validation by an independent
runtime has not run and no characterization baseline pins the EXIF parsing path, whose unit cases are
disabled in `test/unit/spec/index.js`.

## Change and verification routing

| Change affects                                          | Load and update                                                                   | Verification route                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Repository boundaries or cross-cutting architecture     | `docs/architecture.md` and applicable ADRs                                        | Repository test routing and affected owner specs |
| A deployable service surface or operating posture       | Not applicable — no service spec in this package                                  | Not applicable                                   |
| A stable code, package, or component boundary           | Its module spec                                                                   | Module tests plus affected contracts             |
| A public API, event, command, package, or file contract | The owning architecture/service/module section plus the native definition         | Compatibility and contract tests                 |

Concretely, for this package: any change to an export in `src/index.js`, to the `browser` field in
`package.json`, or to either `processImage` implementation routes through `src/docs/README.md` and is
verified by `yarn workspace @webex/helper-image test:unit` plus
`yarn workspace @webex/helper-image test:browser`.

## Module and contract registration

Generate each module specification directly at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`, which defaults to a `docs/README.md` beside the module's own directory. Never
copy a visible module starter or reconstruct a path from an example. Register every module and submodule in the Module registry above
in manifest tree order.

Register each contract with a stable identity, `published` or `internal` publication state, canonical
native source, and owning-module link. A published repository-owned HTTP surface must reuse an
existing OpenAPI source or populate the selected root `api-specs/openapi.yaml`; route code alone is
valid only for an internal HTTP surface. Published SDK/package surfaces retain their ecosystem-native
API artifact and do not require OpenAPI. This page provides navigation and ownership rather than a
copied contract.

This package owns no HTTP surface, so no OpenAPI document applies. Its two published contracts are
the package export surface and the shape of the `processImage` result, both registered above.
