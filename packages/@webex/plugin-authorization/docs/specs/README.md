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
updated_at: 2026-11-12T05:35:41Z
validation_status: pass
-->

# Specification registry

Use this page to find the canonical package architecture and every instantiated module specification
plus native contract. Keep technical facts in one owning document and use this page only for
navigation, ownership, status, and change/test routing.

Start with the [package architecture](../architecture.md). No service specification exists because this
package is a library.

## Document roles

| Document | Canonical ownership |
| -------- | ------------------- |
| [Package architecture](../architecture.md) | Package boundaries, resource inventory, interactions, dependency topology, platform split, and cross-cutting architecture |
| Module specifications | Stable behavior and design at each manifest-routed `<module-path>/docs/README.md` |
| [ADR](../adr/index.md) | A durable decision, its deciders, rationale, consequences, and supersession lineage |

## Instantiated specification registry

| Resource | Role | Canonical path | Owner | Status | Last verified |
| -------- | ---- | -------------- | ----- | ------ | ------------- |
| Package | Architecture | `docs/architecture.md` | @webex/web-sdk | Draft | 2026-11-12 |
| Environment-selecting authorization entry | Module | `src/docs/README.md` | @webex/web-sdk | Draft | 2026-11-12 |
| Keep the existing package docs separate | ADR | `docs/adr/0001-keep-existing-docs-separate.md` | @webex/web-sdk | Accepted | 2026-11-12 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Single import name for `webex.authorization`: the Node entry re-exports `@webex/plugin-authorization-node`, and the `package.json` `browser` field routes bundlers to the browser entry, which re-exports `@webex/plugin-authorization-browser` | Partial | `src/docs/README.md` |

Generator-side field measurement for the module is complete (93.3%, assessed 2026-11-12); the one
weak field is test strategy, because the package has no tests. Independent semantic validation passed
on 2026-11-12 with 0 findings (runtime `01a1ce37-eca0-7270-afda-0ea567c81b36`). A drift scan, a
characterization baseline, and promotion past Partial remain pending.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/plugin-authorization build:src` and `test:style`, and the module spec |
| An entry file or the `main`, `devMain`, or `browser` routing | `src/docs/README.md` and the native definition in `src/index.js`, `src/index.browser.js`, or `package.json` | `build:src`, `test:style`, a Node `require` of the package, and the `webex` UMD build |
| The `webex.authorization` API | The owning sibling package (`@webex/plugin-authorization-node` or `@webex/plugin-authorization-browser`), not this package | That package's tests |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Register every module and submodule in the Module registry above in manifest tree
order.

Contracts are registered in `.sdd/manifest.json` `contract_catalog` and indexed in
[`docs/architecture.md`](../architecture.md#public-and-consumer-surfaces) with a stable ID, publication
state, native source, and owning module. This page provides navigation and ownership rather than a copied
contract.
