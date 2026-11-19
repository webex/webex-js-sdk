---
type: Reference
title: Specification registry
description: Canonical specification registry and change-routing guide.
tags: [specifications, registry]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: spec-index@0.3.0
generated_by: cursor
approved_by: akulakum@cisco.com
updated_at: 2026-10-01T11:15:00Z
validation_status: pass-with-warnings
-->

# Specification registry

Use this page to find the canonical repository architecture and the instantiated module specification. Keep technical facts in the owning document.

Start with the [repository architecture](../architecture.md). No service specification exists here: this package is a library published to npm, not a deployable service, so that artifact is omitted in `.sdd/manifest.json`.

## Document roles

| Document | Canonical ownership |
| -------- | ------------------- |
| [Repository architecture](../architecture.md) | Repository boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture |
| Service specification | Not applicable — no deployable service exists in this package |
| Module specifications | Stable behavior and design at each manifest-routed module spec |
| [ADR](../adr/) | A durable decision, its rationale, and consequences |

## Instantiated specification registry

| Resource | Role | Canonical path | Owner | Status | Last verified |
| -------- | ---- | -------------- | ----- | ------ | ------------- |
| Repository | Architecture | `docs/architecture.md` | @webex/web-client | Active | 2026-10-01 |
| HTML helper | Module | `src/docs/README.md` | @webex/web-client | Active | 2026-10-01 |
| `helper-html-sdk` | Contract | `package.json` | @webex/web-client | Active | 2026-10-01 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src` | HTML allow-list filtering in the browser and string no-ops plus text escaping in Node | Partial | `src/docs/README.md` |

Field coverage measured 2026-10-01 is 93.3% (14 of 15 mandatory fields PRESENT). Critical fields are 8 of 8 PRESENT. The WEAK field is test strategy: `test/unit/spec/html.js` is wrapped in `skipInNode`, and `package.json` does not define `test:unit`. Coverage state stays `Partial` for that gap. Independent validation has not run.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Repository boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/helper-html test:browser` and `yarn workspace @webex/helper-html test:style` |
| A deployable service surface or operating posture | Not applicable — no deployable service exists in this package | Not applicable |
| A stable code or package boundary | `src/docs/README.md` | `yarn workspace @webex/helper-html test:browser` |
| A public export or URL-scheme rule | The module spec plus `src/index.js` or `src/html.shim.js` | Browser unit spec |

## Module and contract registration

The only module is `src`, with canonical spec `src/docs/README.md`.

`helper-html-sdk` is published. Its ecosystem-native artifact is `package.json`. Per-export behavior is specified in the module spec and implemented in `src/`. No OpenAPI document applies, which is why `api-specs/openapi.yaml` is omitted.

`lodash` is an external required contract. It is not implemented in this package.
