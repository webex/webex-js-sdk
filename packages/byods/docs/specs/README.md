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
updated_at: 2026-11-13T13:41:05Z
validation_status: pass
-->

# Specification registry

Use this page to find the canonical package architecture and every instantiated module specification
and native contract. Keep technical facts in the owning document.

Start with the [package architecture](../architecture.md). No service specification exists: this
package is a library published to npm, so that artifact is omitted in `.sdd/manifest.json`.

## Document roles

| Document | Canonical ownership |
| -------- | ------------------- |
| [Package architecture](../architecture.md) | Package boundaries, resource inventory, interactions, dependency topology, contract index, and cross-cutting architecture |
| Service specification | Not applicable — no deployable service exists in this package |
| Module specifications | Stable behavior and design at each manifest-routed module spec |
| [ADR](../adr/) | A durable decision, its deciders, rationale, and consequences |

## Instantiated specification registry

| Resource | Role | Canonical path | Owner | Status | Last verified |
| -------- | ---- | -------------- | ----- | ------ | ------------- |
| Package | Architecture | `docs/architecture.md` | @webex/web-sdk | Draft | 2026-11-13 |
| BYoDS SDK | Module | `src/docs/README.md` | @webex/web-sdk | Draft | 2026-11-13 |
| `byods-sdk` | Contract | `package.json` | @webex/web-sdk | Active | 2026-11-13 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Service App token lifecycle, `/dataSources` calls, JWS renewal and verification, logging | Partial | `src/docs/README.md` |

Generator-side field measurement is complete: field coverage measured 2026-11-13 is 100% (18 of 18
mandatory fields PRESENT for `src`), and critical fields are 7 of 7 PRESENT. Independent validation
passed on 2026-11-13 by validator runtime `01a1d521-829f-75f0-b109-9b44c29a9ae4`, with 0 findings.
Coverage state stays `Partial` until characterization tests pin the probe-only requirements listed
in the module spec Verification.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn test:unit` and `yarn test:style` |
| A deployable service surface or operating posture | Not applicable — no deployable service exists in this package | Not applicable |
| Token acquisition, refresh, or storage | `src/docs/README.md` | `yarn test:unit` |
| Data source calls or the renewal timer | `src/docs/README.md` | `yarn test:unit`, after adding a characterization case for a failing tick |
| JWS verification or environment selection | `src/docs/README.md` and `docs/architecture.md` Security architecture | `yarn test:unit` |
| Exports, entry fields, or build scripts | `src/docs/README.md`, `docs/architecture.md` | `yarn build:src` and `yarn docs` |

## Module and contract registration

Modules, in manifest tree order: `src` with canonical spec `src/docs/README.md`.

`byods-sdk` is published; its ecosystem-native artifact is `package.json`, owned by `src`. No
OpenAPI document applies, which is why `api-specs/openapi.yaml` is omitted.

`webex-access-token-http`, `webex-datasources-http`, `webex-idbroker-jwks`, `jose-jwt`, and
`node-fetch-http` are external required contracts. They are not implemented in this package.
