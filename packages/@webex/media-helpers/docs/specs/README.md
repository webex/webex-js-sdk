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
updated_at: 2026-09-30T05:28:59Z
validation_status: pass
-->

# Specification registry

Use this page to find the canonical repository architecture and every
instantiated service and module specification plus native contract. Keep technical facts
in one owning document and use this page only for navigation, ownership,
status, and change/test routing.

Start with the [repository architecture](../architecture.md). There is no service specification:
`@webex/media-helpers` is a published library, and `.sdd/manifest.json` records `docs/service.md`
as omitted.

## Document roles

| Document                                            | Canonical ownership                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Repository architecture](../architecture.md)       | Repository boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture |
| Service specification                                | Not applicable — this package is not a deployable service                                                    |
| Module specifications                                | Stable behavior and design at each manifest-routed canonical spec                                             |
| [ADR](../adr/)                                      | A durable decision, its deciders, rationale, consequences, and supersession lineage                          |

## Instantiated specification registry

| Resource               | Role         | Canonical path         | Owner                                 | Status | Last verified |
| ---------------------- | ------------ | ---------------------- | ------------------------------------- | ------ | ------------- |
| Repository             | Architecture | `docs/architecture.md` | `@webex/web-client`, `@webex/web-sdk` | Active | 2026-09-29    |
| `@webex/media-helpers` | Module       | `docs/README.md`       | `@webex/web-client`, `@webex/web-sdk` | Active | 2026-09-29    |
| `media-helpers-sdk`    | Contract     | `package.json`         | `@webex/web-client`, `@webex/web-sdk` | Active | 2026-09-29    |
| `media-helpers-server-mute-internal` | Contract | `src/webrtc-core.ts` | `@webex/web-client`, `@webex/web-sdk` | Active | 2026-09-29 |

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its
human-readable mirror and the reconciliation surface for `scripts/check_spec_index.py`. Copy each
Start here path from that module's `canonical_spec`; never reconstruct it from a layout example.

Modules form a tree. Carry depth with one `↳ ` prefix per module level, placed BEFORE the
backticked path and never inside it, and keep rows in depth-first order so each child follows its
parent. Depth must increase by at most one row to row; a jump means a parent row is missing. Keep
the table at four columns — depth lives in the Module cell, not a fifth column.

A child's path always begins with its parent's path, but the two need not be adjacent: source-layout
directories that are not themselves modules (`src/`, `main/`, `java/`, `res/`) sit in between and are
written out in full. They add no depth. One marker per MODULE level, never one per path segment — so
a module at `billing/src/main/java/ledger/` whose nearest module ancestor is `billing/` is depth 1
and takes a single marker.

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Adapts upstream local media streams with Webex server-mute authority and unmute gating, and exposes the package's single media entry point | Partial | `docs/README.md` |

## Change and verification routing

| Change affects                                          | Load and update                                                                   | Verification route                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Repository boundaries or cross-cutting architecture     | `docs/architecture.md` and applicable ADRs                                        | Repository test routing and affected owner specs |
| A deployable service surface or operating posture       | Not applicable — this package is not a deployable service                         | Not applicable                                   |
| A stable code, package, or component boundary           | Its module spec                                                                   | Module tests plus affected contracts             |
| A public API, event, command, package, or file contract | The owning architecture/service/module section plus the native definition         | Compatibility and contract tests                 |

## Module and contract registration

Generate each module specification directly at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json` (default `<module-path>/docs/README.md`). Never copy a visible module starter or
reconstruct a path from an example. Register every module and submodule in the Module registry above
in manifest tree order.

Register each contract with a stable identity, `published` or `internal` publication state, canonical
native source, and owning-module link. A published repository-owned HTTP surface must reuse an
existing OpenAPI source or populate the selected root `api-specs/openapi.yaml`; route code alone is
valid only for an internal HTTP surface. Published SDK/package surfaces retain their ecosystem-native
API artifact and do not require OpenAPI. This page provides navigation and ownership rather than a
copied contract.

This package's module spec is routed to `docs/README.md` rather than `src/docs/README.md`:
`.sdd/manifest.json` records `layout.module_docs_strategy: existing-convention` with
`layout.module_docs_root: docs`, because the monorepo `.gitignore` rule `packages/**/docs/` was
negated only for the package-level `docs/` directory.
