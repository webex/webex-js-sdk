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
updated_at: 2026-10-07T15:08:52Z
validation_status: pass
-->

# Specification registry

Use this page to find the canonical architecture for `@webex/internal-plugin-device` and every instantiated
module specification plus native contract. Technical facts stay in one owning document; this page is
navigation, ownership, status, and change/test routing only.

Start with the [package architecture](../architecture.md). There is no service specification: the package is a
published library, not a deployable service.

## Document roles

| Document                                       | Canonical ownership                                                                                              |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [Package architecture](../architecture.md)     | Package boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture         |
| Service specification                          | N/A — not generated; the package has no deployable runtime, so no service or operating contract exists            |
| Module specifications                          | Stable behavior and design at each module's canonical spec path, routed by `.sdd/manifest.json`                       |
| [ADR](../adr/index.md)                         | A durable decision, its deciders, rationale, consequences, and supersession lineage; none are registered yet       |

## Instantiated specification registry

| Resource                        | Role         | Canonical path                   | Owner                    | Status | Last verified |
| ------------------------------- | ------------ | -------------------------------- | ------------------------ | ------ | ------------- |
| Repository                      | Architecture | `docs/architecture.md`           | Webex JS SDK maintainers | Draft  | 2026-10-07    |
| `src`                           | Module       | `src/docs/README.md`             | Webex JS SDK maintainers | Draft  | 2026-10-07    |
| `device-plugin-sdk`             | Contract     | `package.json`                   | Webex JS SDK maintainers | Draft  | 2026-10-07    |
| `device-registration-events`    | Contract     | `src/device.js`                  | Webex JS SDK maintainers | Draft  | 2026-10-07    |
| `cisco-device-url-header`       | Contract     | `src/interceptors/device-url.js` | Webex JS SDK maintainers | Draft  | 2026-10-07    |

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its
human-readable mirror and the reconciliation surface for `check_spec_index.py`.

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Device registration with the WDM service (register, refresh, unregister, stale-device cleanup), device-derived state and feature toggles, the `cisco-device-url` request header, inactivity logout, and IP network detection | Partial | `src/docs/README.md` |

Generator-side field measurement for `src` is complete: 80.0% (12 of 15 mandatory fields) assessed 2026-10-07,
with critical field coverage at 6 of 7. The score, date, and evidence summary are recorded in the module
specification's `Coverage score` metadata row and in `.sdd/manifest.json`. Independent validation returned `pass`
for this documentation set; that is separate from the coverage measurement.

Three fields remain weak. The external WDM integration has no committed machine-readable contract and the owner
has stated none can be provided, so it is recorded as an approved unknown. The design rationale needs owner input
(no ADR exists). Test and characterization coverage lacks a baseline, and `MOD-015`, `MOD-026`, `INV-004`, and
`INV-005` have no automated evidence. Promotion to `Specced` stays held while a critical field is weak and no drift
measurement exists. The improvement decision recorded for this onboarding is `deferred`.

## Change and verification routing

| Change affects                                          | Load and update                                                                   | Verification route                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Package boundaries or cross-cutting architecture        | `docs/architecture.md` and applicable ADRs                                        | Package test routing and affected owner specs    |
| A stable code, package, or component boundary           | The module spec `src/docs/README.md`                                              | Module tests plus affected contracts             |
| A public API, event, or header contract                 | The owning architecture/module section plus the native source named in the registry above | Unit tests and the dependent-package integration suites |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Every module and submodule appears in the Module registry above in manifest tree order.

Each contract has a stable identity, a `published` or `internal` publication state, a canonical native source,
and an owning-module link in `contract_catalog`. This package owns no HTTP surface, so no OpenAPI source applies:
its published SDK surface keeps its ecosystem-native source, `package.json` plus the sources it names. This page
provides navigation and ownership rather than a copied contract.
