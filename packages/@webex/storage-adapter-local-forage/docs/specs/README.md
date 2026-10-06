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
approved_by: rsarika@cisco.com
updated_at: 2026-10-06T12:05:00Z
validation_status: pass-with-warnings
-->

# Specification registry

Use this page to find the canonical architecture for `@webex/storage-adapter-local-forage` and every
instantiated module specification plus native contract. Technical facts stay in one owning document;
this page covers navigation, ownership, status, and change and test routing only.

Start with the [repository architecture](../architecture.md). There is no service specification,
because the package is a published library rather than a deployable service.

## Document roles

| Document                                      | Canonical ownership |
| --------------------------------------------- | ------------------- |
| [Repository architecture](../architecture.md) | Package boundaries, resource inventory, interactions, dependency topology, data, security, and other cross-cutting architecture |
| Service specification                         | N/A, not generated; the package has no deployable runtime or operating contract |
| Module specifications                         | Stable behavior and design at each module's `docs/README.md`, routed by `.sdd/manifest.json` |
| [ADR](../adr/index.md)                        | A durable decision, its deciders, rationale, consequences, and supersession lineage; none are registered yet |

## Instantiated specification registry

| Resource | Role | Canonical path | Owner | Status | Last verified |
| -------- | ---- | -------------- | ----- | ------ | ------------- |
| `@webex/storage-adapter-local-forage` | Architecture | `docs/architecture.md` | `@webex/web-client` | Active | 2026-10-06 |
| `src/` | Module | `src/docs/README.md` | `@webex/web-client` | Active | 2026-10-06 |
| `local-forage-storage-adapter` | Contract | `package.json` | `@webex/web-client` | Active | 2026-10-06 |
| `local-forage-indexeddb-store` | Contract | `src/index.js` | `@webex/web-client` | Active | 2026-10-06 |

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its
human-readable mirror and the reconciliation surface for `check_spec_index.py`.

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | `StorageAdapterLocalForage`: namespaced Webex storage-adapter bindings persisted in the browser's default `localforage` (IndexedDB) database | Untracked | `src/docs/README.md` |

Generator-side field measurement for `src/` is complete: 93% (13 of 14 mandatory fields) assessed
2026-10-06, with critical fields at 7 of 7. The score and its evidence summary are recorded in the
module specification's `Coverage score` metadata row.

`src/` stays `Untracked` for now, and two gates hold promotion open. The one weak field is test and
characterization coverage: no automated test executes the module and no characterization baseline
exists. Promotion to `Partial` also needs a drift measurement, which independent validation has not
produced yet.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries, dependencies, data location, host contract, release, or security posture | `docs/architecture.md`, plus a new ADR under `docs/adr/` when the decision is durable | `yarn workspace @webex/storage-adapter-local-forage build` and the affected module spec |
| Adapter behavior: `bind`, `get`, `put`, `del`, `clear`, logging, or concurrency | `src/docs/README.md`: `Requirements`, `Caller-visible failure modes`, `Concurrency and reactive flow`, `Verification` | `yarn workspace @webex/storage-adapter-local-forage test:style`; there is no executing unit tier yet (see the module's `Verification`) |
| The stored record layout, database, or store name | `src/docs/README.md` `Data, schema, and migration discipline` and `Export stability`, plus `docs/architecture.md` `Repository data and schema` | A data migration plan and a review by `@webex/web-client` |
| The exported surface | `src/docs/README.md` `Public surface` and `Export stability`, plus the architecture contract index | `yarn workspace @webex/storage-adapter-local-forage build` and every dependent host configuration |
| Build, lint, or test configuration | `docs/getting-started.md` and the architecture `Shared and base libraries` section | `yarn workspace @webex/storage-adapter-local-forage test:style` and `build` |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`, which is `src/docs/README.md`. Every module and submodule is registered in the
Module registry above in manifest tree order; `src/` has no submodules.

The package provides two published contracts. `local-forage-storage-adapter` is an SDK/package
surface whose native source is the entry point declared in `package.json`, with exact declarations in
`src/index.js`. `local-forage-indexeddb-store` is the on-device record layout defined in
`src/index.js`. Published package surfaces keep their ecosystem-native source and do not need
OpenAPI, and the package serves no HTTP routes, so `api-specs/openapi.yaml` is omitted. The module
also requires four external contracts owned elsewhere: `storage-adapter-spec-suite`,
`webex-common-js-api`, `webex-core-storage-layer`, and `localforage-api`. This page provides
navigation and ownership rather than a copied contract.
