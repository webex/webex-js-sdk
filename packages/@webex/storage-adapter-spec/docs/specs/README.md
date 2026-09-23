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
updated_at: 2026-09-23T09:08:18Z
validation_status: not-run
-->

# Specification registry

Use this page to find the canonical repository architecture and every
instantiated service and module specification plus native contract. Keep technical facts
in one owning document and use this page only for navigation, ownership,
status, and change/test routing.

Start with the [repository architecture](../architecture.md). No service specification exists here:
this package is a library published to npm, not a deployable service, so that artifact is recorded
as omitted in `.sdd/manifest.json`.

## Document roles

| Document                                            | Canonical ownership                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Repository architecture](../architecture.md)       | Repository boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture |
| Service specification                                | Not applicable — no deployable service exists in this package                                                |
| Module specifications                                | Stable behavior and design at each manifest-routed `<module-path>/docs/README.md`                              |
| [ADR](../adr/)                                      | A durable decision, its deciders, rationale, consequences, and supersession lineage                          |

## Instantiated specification registry

| Resource   | Role                       | Canonical path         | Owner          | Status                                  | Last verified |
| ---------- | -------------------------- | ---------------------- | -------------- | --------------------------------------- | ------------- |
| Repository | Architecture               | `docs/architecture.md` | Webex JS SDK storage maintainers | Active | 2026-09-23 |
| Abstract storage-adapter conformance suite | Module | `src/docs/README.md` | Webex JS SDK storage maintainers | Active | 2026-09-23 |
| `storage-adapter-spec-suite` | Contract | `package.json` | Webex JS SDK storage maintainers | Active | 2026-09-23 |

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
| `src/` | Defines and enforces the behavioral contract every Webex storage adapter must satisfy | Untracked | `src/docs/README.md` |

Generator-side field measurement is complete: the module scored 95% (21 of 22 mandatory spec fields
PRESENT) on 2026-09-23. The module remains `Untracked` because a promotion to `Specced` is a manifest
change awaiting human approval, not because coverage is unmeasured. Independent validation ran on a
different runtime on 2026-09-23 and returned blocked; these documents were regenerated in response
and await re-validation.

## Change and verification routing

| Change affects                                          | Load and update                                                                   | Verification route                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Repository boundaries or cross-cutting architecture     | `docs/architecture.md` and applicable ADRs                                        | Repository test routing and affected owner specs |
| A deployable service surface or operating posture       | Not applicable — no deployable service exists in this package                     | Not applicable                                   |
| A stable code, package, or component boundary           | Its module spec                                                                   | Module tests plus affected contracts             |
| A public API, event, command, package, or file contract | The owning architecture/service/module section plus the native definition         | Compatibility and contract tests                 |

One routing caveat is specific to this package: its unit tier is satisfied by a sibling workspace
package, not by any command declared here. Any change to `src/` is verified with the manifest's
`contract-verify` command, which runs the suite inside `@webex/webex-core`. The three browser-backed
adapter packages skip under Node and cannot serve as the verification route. See
[getting started](../getting-started.md).

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

One contract is registered here, owned by `src/`, published, and defined in JavaScript rather than
HTTP. It resolves through the ecosystem-native package manifest. The storage adapter interface that
consumers implement is the argument half of that same contract rather than a separate entry, because
it has no machine-readable artifact of its own; see
[architecture](../architecture.md#public-and-consumer-surfaces) for why, and the module spec for its
full specification. No OpenAPI document applies, which is why `api-specs/openapi.yaml` is recorded as
omitted.
