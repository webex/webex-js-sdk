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
updated_at: 2026-10-07T07:23:05Z
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
| Package | Architecture | `docs/architecture.md` | @webex/web-client, @webex/web-sdk | Draft | 2026-10-07 |
| LLM channel plugin | Module | `src/docs/README.md` | @webex/web-client, @webex/web-sdk | Draft | 2026-10-07 |
| `llm-sdk` | Contract | `package.json` | @webex/web-client, @webex/web-sdk | Active | 2026-10-07 |
| `llm-plugin-events` | Contract | `src/llm.ts` | @webex/web-client, @webex/web-sdk | Active | 2026-10-07 |
| `llm-datachannel-protocol` | Contract | `src/llm.ts` | @webex/web-client, @webex/web-sdk | Active | 2026-10-07 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | LLM data-channel registration, session metadata, ownership, token cache, and URL lookup | Partial | `src/docs/README.md` |

Generator-side field measurement is complete. Field coverage measured 2026-10-07 is 93.3% (14 of 15 mandatory fields PRESENT for `src`). Critical fields are 8 of 8 PRESENT. The WEAK field is test strategy: untested paths are listed in the module spec's Verification section, and no characterization baseline exists. Independent validation round 2 passed with warnings on 2026-10-07. Coverage state stays `Partial` until a characterization baseline and a spec-drift record exist.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/internal-plugin-llm test:unit` and `yarn workspace @webex/internal-plugin-llm test:style` |
| A deployable service surface or operating posture | Not applicable — no deployable service exists in this package | Not applicable |
| Registration, connect, timing, or the auth header | `src/docs/README.md` | `yarn workspace @webex/internal-plugin-llm test:unit` |
| Ownership, token cache, or refresh handlers | `src/docs/README.md`; check callers in plugin-meetings | `yarn workspace @webex/internal-plugin-llm test:unit` |
| A public export, session id, or event name | The module spec and `docs/architecture.md`; check plugin-meetings and internal-plugin-voicea | `yarn workspace @webex/internal-plugin-llm test:unit`, then `yarn workspace @webex/internal-plugin-llm build` |
| Socket lifecycle or reconnect behavior | Not owned here; change sibling package internal-plugin-mercury | That package's own checks, then `yarn workspace @webex/internal-plugin-llm test:unit` |

## Module and contract registration

Modules, in manifest tree order: `src` with canonical spec `src/docs/README.md`. It has no child
module.

`llm-sdk` is published; its ecosystem-native artifact is `package.json`, owned by `src`.
`llm-plugin-events` is published with source `src/llm.ts`, owned by `src`.
`llm-datachannel-protocol` is internal with source `src/llm.ts`, owned by `src`. No OpenAPI document
applies, which is why `api-specs/openapi.yaml` is omitted.

`mercury-plugin-base`, `webex-core-plugin-host`, `webex-device-registration`, and
`webex-feature-toggles` are external required contracts. They are not implemented in this package.
