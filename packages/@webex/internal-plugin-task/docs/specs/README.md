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
updated_at: 2026-10-09T16:00:49Z
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
| Task plugin | Module | `src/docs/README.md` | @webex/web-sdk | Draft | 2026-10-09 |
| `task-sdk` | Contract | `package.json` | @webex/web-sdk | Active | 2026-10-09 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Raindrop task REST wrappers, title and notes encryption, and registration state | Partial | `src/docs/README.md` |

Generator-side field measurement is complete. Field coverage measured 2026-10-09 is 93.3% (14 of 15
mandatory fields PRESENT for `src`). Critical fields are 8 of 8 PRESENT. The WEAK field is test
strategy; the untested paths are listed in the module spec's Verification section. Independent
validation is recorded in the module spec Validation status row. Coverage state stays `Partial`
until the missing tests and a characterization baseline exist and a spec-drift record exists.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/internal-plugin-task test:unit` and `yarn workspace @webex/internal-plugin-task test:style` |
| A deployable service surface or operating posture | Not applicable — no deployable service exists in this package | Not applicable |
| A REST wrapper or request shape | `src/docs/README.md` | `yarn workspace @webex/internal-plugin-task build:src`, then `yarn workspace @webex/internal-plugin-task test:unit` |
| Encrypted fields or key selection | `src/docs/README.md` and the architecture Security architecture | `yarn workspace @webex/internal-plugin-task build:src`, then `yarn workspace @webex/internal-plugin-task test:unit`, after adding the missing helper cases |
| `register`, `unregister`, or the event names | `src/docs/README.md` | `yarn workspace @webex/internal-plugin-task build:src`, then `yarn workspace @webex/internal-plugin-task test:unit` |
| The default export or the plugin name | `src/docs/README.md` and `docs/architecture.md`; check the sibling package webex | `yarn workspace @webex/internal-plugin-task build:src`, then `yarn workspace @webex/internal-plugin-task test:unit` |

## Module and contract registration

Modules, in manifest tree order: `src` with canonical spec `src/docs/README.md`.

`task-sdk` is published; its ecosystem-native artifact is `package.json`, owned by `src`. No OpenAPI
document applies, which is why `api-specs/openapi.yaml` is omitted.

`raindrop-tasks-http`, `webex-core-plugin-host`, `encryption-sdk`, `webex-device-registration`,
`mercury-sdk`, `conversation-sdk`, and `lodash` are external required contracts. They are not
implemented in this package.
