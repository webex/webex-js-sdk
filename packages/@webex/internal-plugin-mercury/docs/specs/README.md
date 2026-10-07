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
updated_at: 2026-10-07T00:24:39Z
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
| Package | Architecture | `docs/architecture.md` | @webex/web-client, @webex/web-sdk | Draft | 2026-10-06 |
| Mercury plugin | Module | `src/docs/README.md` | @webex/web-client, @webex/web-sdk | Draft | 2026-10-06 |
| Mercury Socket | Module | `src/socket/docs/README.md` | @webex/web-client, @webex/web-sdk | Draft | 2026-10-06 |
| `mercury-sdk` | Contract | `package.json` | @webex/web-client, @webex/web-sdk | Active | 2026-10-06 |
| `mercury-plugin-events` | Contract | `src/mercury.js` | @webex/web-client, @webex/web-sdk | Active | 2026-10-06 |
| `mercury-socket-transport` | Contract | `src/socket/socket-base.js` | @webex/web-client, @webex/web-sdk | Active | 2026-10-06 |
| `mercury-wire-protocol` | Contract | `src/socket/socket-base.js` | @webex/web-client, @webex/web-sdk | Active | 2026-10-06 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Mercury sessions, reconnect policy, envelope routing, and shutdown switchover | Partial | `src/docs/README.md` |
| ↳ `src/socket/` | One WebSocket connection: handshake, keepalive, acks, and close codes | Partial | `src/socket/docs/README.md` |

Generator-side field measurement is complete. Field coverage measured 2026-10-06 is 93.3% across both modules (28 of 30 mandatory fields PRESENT; `src` 14 of 15, `src/socket` 14 of 15). Critical fields are 16 of 16 PRESENT. The WEAK field in each module is test strategy: untested paths are listed in each spec's Verification section, and no characterization baseline exists. Independent validation returned pass-with-warnings on 2026-10-07 with 0 Blocking. Coverage state stays `Partial` until a characterization baseline and a spec-drift record exist.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/internal-plugin-mercury test:unit` and `yarn workspace @webex/internal-plugin-mercury test:style` |
| A deployable service surface or operating posture | Not applicable — no deployable service exists in this package | Not applicable |
| Sessions, retries, close-code policy, or event routing | `src/docs/README.md` | `yarn workspace @webex/internal-plugin-mercury test:unit` |
| Socket frames, keepalive, or the platform hook | `src/socket/docs/README.md` and the parent spec when failure classes change | `yarn workspace @webex/internal-plugin-mercury test:unit`, then `yarn workspace @webex/internal-plugin-mercury test:browser` |
| A public export, event name, or subclass-visible method | The owning module spec and `docs/architecture.md`; check internal-plugin-llm and internal-plugin-board | Unit spec plus the browser run |

## Module and contract registration

Modules, in manifest tree order: `src` with canonical spec `src/docs/README.md`, and its child
`src/socket` with canonical spec `src/socket/docs/README.md`.

`mercury-sdk` is published; its ecosystem-native artifact is `package.json`, owned by `src`.
`mercury-plugin-events` is published with source `src/mercury.js`, owned by `src`.
`mercury-socket-transport` and `mercury-wire-protocol` are internal with source
`src/socket/socket-base.js`, owned by `src/socket`. No OpenAPI document applies, which is why
`api-specs/openapi.yaml` is omitted.

`webex-core-plugin-host`, `webex-device-registration`, `webex-feature-toggles`, `webex-metrics`,
`webex-common-sdk`, `webex-common-timers`, `backoff`, `lodash`, `uuid`, and `ws` are external
required contracts. They are not implemented in this package.
