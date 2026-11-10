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
updated_at: 2026-11-05T12:32:04Z
validation_status: pass
-->

# Specification registry

Use this page to find the canonical architecture for `@webex/internal-plugin-encryption` and every instantiated
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

| Resource                   | Role         | Canonical path         | Owner                                              | Status | Last verified |
| -------------------------- | ------------ | ---------------------- | -------------------------------------------------- | ------ | ------------- |
| Repository                 | Architecture | `docs/architecture.md` | Cisco Webex for Developers (named in `README.md`)  | Draft  | 2026-11-05    |
| `src`                      | Module       | `src/docs/README.md`   | Cisco Webex for Developers (named in `README.md`)  | Draft  | 2026-11-05    |
| `encryption-plugin-sdk`    | Contract     | `src/index.js`         | Cisco Webex for Developers (named in `README.md`)  | Draft  | 2026-11-05    |

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its
human-readable mirror and the reconciliation surface for `check_spec_index.py`.

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Encryption and KMS client plugin: registers `webex.internal.encryption` with a `kms` child, negotiates the KMS session (including optional certificate-chain enforcement and report-only CA-root trials), fetches and caches keys, encrypts and decrypts text, binary data, and SCRs, downloads encrypted files, and wraps and unwraps KMS messages in service payloads | Partial | `src/docs/README.md` |

Generator-side drafts of every document were produced on 2026-11-05. Independent validation passed on 2026-11-05 with
zero findings. Generator-side field measurement is complete: 93.3% (14 of 15 mandatory fields). The module was promoted from `Untracked` to `Partial` on 2026-11-05 with owner approval;
promotion to `Specced` is held because the drift measurement and the pull-request churn gate for `Specced` have not been run.

Known weak areas, recorded in the module specification's Verification section: the request retry and context
renegotiation policy (`MOD-008`) and browser buffer conversion (`MOD-019`) have no automated evidence; several
requirements are evidenced only by integration suites that need provisioned test users.

## Change and verification routing

| Change affects                                          | Load and update                                                                   | Verification route                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Package boundaries or cross-cutting architecture        | `docs/architecture.md` and applicable ADRs                                        | Package test routing and affected owner specs    |
| A stable code, package, or component boundary           | The module spec `src/docs/README.md`                                              | Module tests plus affected contracts             |
| A public API, event, or header contract                 | The owning architecture/module section plus the native source named in the registry above | Unit tests and the integration suites     |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Every module and submodule appears in the Module registry above in manifest tree order.

Each contract has a stable identity, a `published` or `internal` publication state, a canonical native source,
and an owning-module link in `contract_catalog`. This package owns no HTTP surface, so no OpenAPI source applies:
its published SDK surface keeps its ecosystem-native source, `package.json` plus `src/index.js`. This page
provides navigation and ownership rather than a copied contract.
