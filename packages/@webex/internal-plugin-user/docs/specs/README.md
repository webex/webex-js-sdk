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
updated_at: 2026-10-27T00:00:00Z
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
| Package | Architecture | `docs/architecture.md` | @webex/web-client, @webex/web-sdk | Draft | 2026-10-12 |
| User plugin | Module | `src/docs/README.md` | @webex/web-client, @webex/web-sdk | Draft | 2026-10-12 |
| `user-sdk` | Contract | `package.json` | @webex/web-client, @webex/web-sdk | Active | 2026-10-12 |
| `user-identity-http` | Contract | `src/user.js` | @webex/web-client, @webex/web-sdk | Active | 2026-10-12 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | uuid resolution and cache, account flows, profile and SCIM updates | Partial | `src/docs/README.md` |

Generator-side field measurement is complete. Field coverage measured 2026-10-27 is 93.3% (14 of 15 mandatory fields PRESENT for `src`). Critical fields are 8 of 8 PRESENT. The WEAK field is test strategy: untested paths are listed in the module spec's Verification section, and no characterization baseline exists. Coverage state stays `Partial` until a spec-drift record and a characterization baseline exist.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/internal-plugin-user test:unit` and `yarn workspace @webex/internal-plugin-user test:style` |
| A deployable service surface or operating posture | Not applicable — no deployable service exists in this package | Not applicable |
| uuid resolution, the batcher, or the store | `src/docs/README.md`; check callers in internal-plugin-conversation and internal-plugin-team | `yarn workspace @webex/internal-plugin-user test:unit` |
| Account flows (`verify`, `activate`, OTP, password, name, preferred site) | `src/docs/README.md`; check sign-in callers | `yarn workspace @webex/internal-plugin-user test:unit` |
| A public export, config key, or `hasPassword` | The module spec and `docs/architecture.md`; check the six consuming packages | `yarn workspace @webex/internal-plugin-user test:unit`, then `yarn workspace @webex/internal-plugin-user build` |
| Request transport, credentials, or the `Batcher` base | Not owned here; change sibling package webex-core | That package's own checks, then `yarn workspace @webex/internal-plugin-user test:unit` |

## Module and contract registration

Modules, in manifest tree order: `src` with canonical spec `src/docs/README.md`. It has no child
module.

`user-sdk` is published; its ecosystem-native artifact is `package.json`, owned by `src`.
`user-identity-http` is internal with source `src/user.js`, owned by `src`. No OpenAPI document
applies, which is why `api-specs/openapi.yaml` is omitted.

`webex-core-plugin-host`, `webex-device-registration`, and `webex-common-sdk` are external required
contracts. They are not implemented in this package.
