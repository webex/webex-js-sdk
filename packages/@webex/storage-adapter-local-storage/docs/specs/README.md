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
approved_by: rsarika@cisco.com
updated_at: 2026-10-03T20:17:51Z
validation_status: not-run
-->

# Specification registry

Use this page to find the canonical package architecture and every instantiated module
specification plus native contract. Technical facts stay in one owning document; this page carries
navigation, ownership, status, and change/test routing only.

Start with the [repository architecture](../architecture.md). There is no service specification —
this package is a published library, not a deployable service.

## Document roles

| Document                                            | Canonical ownership                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Repository architecture](../architecture.md)       | Package boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture |
| Service specification                                | Not applicable — no deployable service in this package                                                    |
| Module specifications                                | Stable behavior and design at each manifest-routed `<module-path>/docs/README.md`                              |
| ADR                                                  | A durable decision, its deciders, rationale, consequences, and supersession lineage. None exist yet.        |

## Instantiated specification registry

| Resource   | Role                       | Canonical path         | Owner          | Status                                  | Last verified |
| ---------- | -------------------------- | ---------------------- | -------------- | --------------------------------------- | ------------- |
| Repository | Architecture               | `docs/architecture.md` | `@webex/web-client` | Active                             | 2026-10-03    |
| `src` | Module | `src/docs/README.md` | `@webex/web-client` | Active | 2026-10-03 |
| `storage-adapter-local-storage-sdk` | Contract (SDK, published) | `package.json` | `@webex/web-client` | Active | 2026-10-03 |
| `local-storage-bounded-document` | Contract (file, internal) | `src/index.js` | `@webex/web-client` | Active | 2026-10-03 |
| `webex-core-store-adapter-interface` | Contract (SDK, internal, consumed) | packages/@webex/webex-core/src/lib/storage/make-webex-store.js | `@webex/web-sdk` | Active | 2026-10-03 |

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its
human-readable mirror and the reconciliation surface for `scripts/check_spec_index.py`.

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Browser localStorage-backed bounded storage adapter for the webex-core storage layer | Partial | `src/docs/README.md` |

## Change and verification routing

| Change affects                                          | Load and update                                                                   | Verification route                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Package boundaries or cross-cutting architecture     | `docs/architecture.md`                                        | No executing suite covers this package; verify manually in a browser and state so in the PR |
| A deployable service surface or operating posture       | Not applicable — no service in this package        | —                          |
| A stable code, package, or component boundary           | `src/docs/README.md`                                                   | `test:style`, `build:src`; note that `test:unit` and `test:browser` execute nothing |
| A public API, event, command, package, or file contract | The owning architecture/module section plus `package.json`         | Compatibility review against `@webex/webex`, `@webex/recipe-private-web-client`, and the authorization-browser fixtures |
| The at-rest `localStorage` document layout | `src/docs/README.md` "Data, schema, and migration discipline" and `docs/architecture.md` "Repository data and schema" | Manual browser verification that a document written by the previous release still reads |

## Module and contract registration

Each module specification is generated directly at the exact `modules[].canonical_spec` path
recorded in `.sdd/manifest.json` — here, `src/docs/README.md`. Never copy a module starter or
reconstruct a path from an example.

Contracts registered for this package:

- `storage-adapter-local-storage-sdk` — **published** SDK surface, owned by `src`. Canonical native
  source `package.json`; the package ships no `.d.ts` and no API report, so that manifest is the
  only machine-readable declaration. Published SDK surfaces retain their ecosystem-native artifact
  and do not require OpenAPI.
- `local-storage-bounded-document` — **internal** file contract, owned by `src`. The at-rest JSON
  document under `localStorage[basekey]`, canonical source `src/index.js`.
- `webex-core-store-adapter-interface` — **internal** SDK contract **consumed**, not owned. Defined
  outside this SDD root by `@webex/webex-core`.

No HTTP surface exists, so `api-specs/openapi.yaml` is recorded as `omit` in
`layout.artifact_decisions`. This page provides navigation and ownership rather than a copied
contract.
