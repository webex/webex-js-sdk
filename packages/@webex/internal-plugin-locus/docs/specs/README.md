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
updated_at: 2026-10-09T07:21:56Z
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
| Package | Architecture | `docs/architecture.md` | @webex/web-sdk | Draft | 2026-10-09 |
| Locus plugin | Module | `src/docs/README.md` | @webex/web-sdk | Draft | 2026-10-09 |
| `locus-sdk` | Contract | `package.json` | @webex/web-sdk | Active | 2026-10-09 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Locus REST wrappers, sequence comparison, delta merge, and event names | Partial | `src/docs/README.md` |

Generator-side field measurement is complete. Field coverage measured 2026-10-09 is 93.3% (14 of 15 mandatory fields PRESENT for `src`). Critical fields are 8 of 8 PRESENT. The WEAK field is test strategy: the 134 unit cases cover only sequence comparison, and the untested paths are listed in the module spec's Verification section. Independent validation returned pass-with-warnings on 2026-10-09 with 0 Blocking. Coverage state stays `Partial` until REST and merge behavior is tested, a characterization baseline exists, and a spec-drift record exists.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/internal-plugin-locus test:unit` and `yarn workspace @webex/internal-plugin-locus test:style` |
| A deployable service surface or operating posture | Not applicable — no deployable service exists in this package | Not applicable |
| Sequence comparison or delta merge | `src/docs/README.md` and the fixtures in `test/unit/lib` | `yarn workspace @webex/internal-plugin-locus test:unit` |
| A REST wrapper, request body, or Conflict handling | `src/docs/README.md` | `yarn workspace @webex/internal-plugin-locus test:unit`, after adding the missing unit case |
| A public export, the plugin name, or `eventKeys` | `src/docs/README.md` and `docs/architecture.md`; check internal-plugin-lyra | `yarn workspace @webex/internal-plugin-locus test:unit` |

## Module and contract registration

Modules, in manifest tree order: `src` with canonical spec `src/docs/README.md`.

`locus-sdk` is published; its ecosystem-native artifact is `package.json`, owned by `src`. No
OpenAPI document applies, which is why `api-specs/openapi.yaml` is omitted.

`locus-service-http`, `janus-history-http`, `webex-core-plugin-host`, `webex-device-registration`,
`mercury-sdk`, `lodash`, and `uuid` are external required contracts. They are not implemented in
this package.
