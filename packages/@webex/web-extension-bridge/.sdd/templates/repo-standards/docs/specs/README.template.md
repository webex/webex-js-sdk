---
type: Reference
title: Specification registry
description: Canonical specification registry and change-routing guide.
tags: [specifications, registry]
---
<!-- ───────────────────────────────
  Template:     Specification Registry
  Template-ID:  spec-index
  Generates:    docs/specs/README.md
  Description:  Resolved from WebexTools/repo-standards templates/docs/specs/index.md
  Library ver:  0.3.0
  Source:       WebexTools/repo-standards@d89a7fe59126ae3ad9bac9ca352aa7f12b4c85dc templates/docs/specs/index.md
  Last updated: 2026-08-24
─────────────────────────────── -->

# Specification registry

Use this page to find the canonical repository architecture and every
instantiated service and module specification plus native contract. Keep technical facts
in one owning document and use this page only for navigation, ownership,
status, and change/test routing.

Start with the [repository architecture](../architecture.md). Load a
[service specification](../service.md) only when the repository contains a
deployable service.

## Document roles

| Document                                            | Canonical ownership                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Repository architecture](../architecture.md)       | Repository boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture |
| [Service specification](../service.md)              | Runtime and operating contract for one deployable service                                                    |
| Module specifications                                | Stable behavior and design at each manifest-routed `<module-path>/docs/README.md`                              |
| [ADR](../adr/)                                      | A durable decision, its deciders, rationale, consequences, and supersession lineage                          |

## Instantiated specification registry

Replace the example rows with the specifications that actually exist in the
target repository. Do not list template paths as if they were completed
specifications.

| Resource   | Role                       | Canonical path         | Owner          | Status                                  | Last verified |
| ---------- | -------------------------- | ---------------------- | -------------- | --------------------------------------- | ------------- |
| Repository | Architecture               | `docs/architecture.md` | [team or role] | Draft / Active                          | YYYY-MM-DD    |
| [resource] | Service / Module / Contract | `[path]`               | [team or role] | Draft / Active / Deprecated / Delivered | YYYY-MM-DD    |

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
| `[module-path]/` | [one line] | [from `.sdd/manifest.json`] | `[modules[].canonical_spec]` |
| ↳ `[module-path]/src/main/[child-name]/` | [what the child owns] | [from `.sdd/manifest.json`] | `[child module canonical_spec]` |
## Change and verification routing

| Change affects                                          | Load and update                                                                   | Verification route                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Repository boundaries or cross-cutting architecture     | `docs/architecture.md` and applicable ADRs                                        | Repository test routing and affected owner specs |
| A deployable service surface or operating posture       | Its service spec, native contract/configuration, and affected module specs        | Contract/integration/operational checks          |
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
