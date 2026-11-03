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
updated_at: 2026-10-28T14:58:37Z
validation_status: pass
-->

# Specification registry

Use this page to find the canonical architecture for `@webex/internal-plugin-wdm` and every instantiated
module specification plus native contract. Technical facts stay in one owning document; this page is
navigation, ownership, status, and change/test routing only.

Start with the [package architecture](../architecture.md). There is no service specification: the package is a
published library, not a deployable service.

## Document roles

| Document                                       | Canonical ownership                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [Package architecture](../architecture.md)     | Package boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture         |
| Service specification                          | N/A — not generated; the package has no deployable runtime, so no service or operating contract exists            |
| Module specifications                          | Stable behavior and design at each module's canonical spec path, routed by `.sdd/manifest.json`                   |
| [ADR](../adr/index.md)                         | A durable decision, its deciders, rationale, consequences, and supersession lineage; none are registered yet       |

## Instantiated specification registry

| Resource          | Role         | Canonical path         | Owner                                              | Status | Last verified |
| ----------------- | ------------ | ---------------------- | -------------------------------------------------- | ------ | ------------- |
| Repository        | Architecture | `docs/architecture.md` | Cisco Webex for Developers (named in `README.md`)  | Draft  | 2026-10-28    |
| `src`             | Module       | `src/docs/README.md`   | Cisco Webex for Developers (named in `README.md`)  | Draft  | 2026-10-28    |
| `wdm-alias-sdk`   | Contract     | `src/index.js`         | Cisco Webex for Developers (named in `README.md`)  | Draft  | 2026-10-28    |

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its
human-readable mirror and the reconciliation surface for `check_spec_index.py`.

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Deprecated alias entry point: re-exports the device plugin's default export and six named exports from `@webex/internal-plugin-device` so the historical package name keeps working | Partial | `src/docs/README.md` |

Generator-side field measurement for `src` is complete: 86.7% (13 of 15 mandatory fields) assessed 2026-10-12,
with critical field coverage at 7 of 7. The score, date, and evidence summary are recorded in the module
specification's `Coverage score` metadata row and in `.sdd/manifest.json`. Independent validation passed on
2026-10-28 with zero findings. That result is separate from the completed coverage measurement.

Two fields remain weak. Test and characterization coverage lacks a baseline: the only unit test asserts `true`,
and only `MOD-004` has any automated evidence (an integration test that needs provisioned test users). The
rationale for omitting `CatalogDetails` and `DeviceRegistrationOptions` from the alias is an approved unknown
(`MOD-003`). Provenance is present now that the owner approval is recorded. Promotion to `Specced` stays held
while no drift measurement exists. The coverage-improvement decision recorded for this onboarding is `pending`.

## Change and verification routing

| Change affects                                          | Load and update                                                                   | Verification route                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Package boundaries or cross-cutting architecture        | `docs/architecture.md` and applicable ADRs                                        | Package test routing and affected owner specs    |
| A stable code, package, or component boundary           | The module spec `src/docs/README.md`                                              | Module tests plus affected contracts             |
| A public API, event, or header contract                 | The owning architecture/module section plus the native source named in the registry above | Unit tests and the integration suite       |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Every module and submodule appears in the Module registry above in manifest tree order.

Each contract has a stable identity, a `published` or `internal` publication state, a canonical native source,
and an owning-module link in `contract_catalog`. This package owns no HTTP surface, so no OpenAPI source applies:
its published SDK surface keeps its ecosystem-native source, `package.json` plus `src/index.js`. This page
provides navigation and ownership rather than a copied contract.
