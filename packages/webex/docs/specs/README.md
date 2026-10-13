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
updated_at: 2026-10-13T05:14:36Z
validation_status: not-run
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
| Package | Architecture | `docs/architecture.md` | @webex/web-sdk | Draft | 2026-10-13 |
| webex bundle entry points | Module | `src/docs/README.md` | @webex/web-sdk | Draft | 2026-10-13 |
| `webex-sdk` | Contract | `package.json` | @webex/web-sdk | Active | 2026-10-13 |
| `webex-umd-bundles` | Contract | `umd/` | @webex/web-sdk | Active | 2026-10-13 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Entry files, package config, storage choice, and the `Calling` wrapper | Partial | `src/docs/README.md` |

Generator-side field measurement is complete. Field coverage measured 2026-10-13 is 93.3% (14 of 15 mandatory fields PRESENT for `src`). Critical fields are 8 of 8 PRESENT. The WEAK field is test strategy: 4 unit cases and four integration specs cover the main entry only, and the untested entries are listed in the module spec's Verification section. Independent validation: see the Validation status row of the module spec. Coverage state stays `Partial` until the other entries and `Calling` are tested, a characterization baseline exists, and a spec-drift record exists.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace webex test:unit` and `yarn workspace webex test:style` |
| A deployable service surface or operating posture | Not applicable — no deployable service exists in this package | Not applicable |
| The plugin set or `init` of an entry file | `src/docs/README.md` | `yarn workspace webex test:unit`, then `yarn workspace webex test:integration` |
| `Calling` | `src/docs/README.md` | `yarn workspace webex test:unit`, after adding the missing unit case |
| The `exports` map, `browser` field, or UMD globals | `src/docs/README.md` and `docs/architecture.md` | `yarn workspace webex build` and `yarn workspace webex test:unit` |
| `env.js` or `browser.js` | `src/docs/README.md` | `yarn workspace webex test:integration` |

## Module and contract registration

Modules, in manifest tree order: `src` with canonical spec `src/docs/README.md`.

`webex-sdk` is published; its ecosystem-native artifact is `package.json`, owned by `src`.
`webex-umd-bundles` is published; its native artifact is the committed `umd/` directory, owned by
`src`. No OpenAPI document applies, which is why `api-specs/openapi.yaml` is omitted.

`webex-core-plugin-host`, `webex-public-plugins`, `webex-internal-plugins`, `webex-calling-sdk`,
`webex-contact-center-sdk`, `storage-adapter-local-storage`, `babel-polyfill`, and `lodash` are
external required contracts. They are not implemented in this package.
