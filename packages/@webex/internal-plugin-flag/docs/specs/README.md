---
type: Reference
title: Specification registry
description: Canonical specification registry and change-routing guide.
tags: [specifications, registry]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: spec-index@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-15T14:22:13Z
validation_status: pass-with-warnings
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
| Package | Architecture | `docs/architecture.md` | @webex/web-sdk | Draft | 2026-10-12 |
| Flag plugin | Module | `src/docs/README.md` | @webex/web-sdk | Draft | 2026-10-12 |
| `flag-sdk` | Contract | `package.json` | @webex/web-sdk | Active | 2026-10-12 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Flag plugin: registration, flag create/list/change/delete requests, and mapping flags to activities | Partial | `src/docs/README.md` |

Generator-side field measurement is complete. Field coverage measured 2026-10-12 is 93.3% (14 of 15
mandatory fields PRESENT for `src`). Critical fields are 8 of 8 PRESENT. The WEAK field is test
strategy; the untested paths are listed in the module spec's Verification section. Independent
validation is pass-with-warnings, assessed 2026-10-15 by validator current-session (round 7 at
fbb8720), as recorded in the module spec Validation status row. Coverage state stays `Partial`
until the missing tests and a characterization baseline exist and a spec-drift record exists.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/internal-plugin-flag build`, then `yarn workspace @webex/internal-plugin-flag test:unit` and `yarn workspace @webex/internal-plugin-flag test:style` |
| A deployable service surface or operating posture | Not applicable — no deployable service exists in this package | Not applicable |
| A flag method's request or resolved value | `src/docs/README.md` (Requirements, Protocol and wire format) | `yarn workspace @webex/internal-plugin-flag build`, then `yarn workspace @webex/internal-plugin-flag test:unit` and `yarn workspace @webex/internal-plugin-flag test:style`, after adding unit cases; `yarn workspace @webex/internal-plugin-flag test:browser` when live users are available |
| The activity host check or the multistatus filter | `src/docs/README.md` (`INV-003`, `INV-005`) and the architecture Security architecture | `yarn workspace @webex/internal-plugin-flag build`, then `yarn workspace @webex/internal-plugin-flag test:unit` and `yarn workspace @webex/internal-plugin-flag test:style` |
| Config keys | `src/docs/README.md` | `yarn workspace @webex/internal-plugin-flag build`, then `yarn workspace @webex/internal-plugin-flag test:unit` |
| The default export or the plugin name | `src/docs/README.md` and `docs/architecture.md` | `yarn workspace @webex/internal-plugin-flag build`, then `yarn workspace @webex/internal-plugin-flag test:unit` and `yarn workspace @webex/internal-plugin-flag test:style` |

## Module and contract registration

Modules, in manifest tree order: `src` with canonical spec `src/docs/README.md`.

`flag-sdk` is published; its ecosystem-native artifact is `package.json`, owned by `src`. No
OpenAPI document applies, which is why `api-specs/openapi.yaml` is omitted.

`webex-core-plugin-host`, `conversation-sdk`, `webex-device-registration`, `user-apps-flags-http`,
and `conversation-bulk-activities-http` are external required contracts. They are not implemented
in this package.
