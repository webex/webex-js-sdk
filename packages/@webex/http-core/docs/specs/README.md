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
approved_by: pending
updated_at: 2026-09-23T06:29:48Z
validation_status: pass-with-warnings
-->

# Specification registry

Use this page to find the canonical repository architecture and every
instantiated module specification plus native contract. Keep technical facts
in one owning document and use this page only for navigation, ownership,
status, and change/test routing.

Start with the [repository architecture](../architecture.md). No service specification exists: this
package is a published library, not a deployable service.

## Document roles

| Document                                       | Canonical ownership                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Repository architecture](../architecture.md)  | Repository boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture |
| Module specifications                          | Stable behavior and design at each manifest-routed `<module-path>/docs/README.md`                              |
| [ADR](../adr/)                                 | A durable decision, its deciders, rationale, consequences, and supersession lineage                          |

## Instantiated specification registry

| Resource      | Role         | Canonical path               | Owner                      | Status | Last verified |
| ------------- | ------------ | ---------------------------- | -------------------------- | ------ | ------------- |
| Repository    | Architecture | `docs/architecture.md`       | Cisco Webex for Developers | Draft  | 2026-09-23    |
| `src`         | Module       | `src/docs/README.md`         | Cisco Webex for Developers | Draft  | 2026-09-23    |
| `src/request` | Module       | `src/request/docs/README.md` | Cisco Webex for Developers | Draft  | 2026-09-23    |
| `http-core-sdk` | Contract   | `package.json`               | Cisco Webex for Developers | Active | 2026-09-23    |

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its
human-readable mirror and the reconciliation surface for `scripts/check_spec_index.py`.

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Package surface: client construction, interceptor extension contract, HTTP error taxonomy, progress payload, and MIME detection | Partial | `src/docs/README.md` |
| ↳ `src/request/` | Request execution: applies interceptors around a platform-specific transport and emits progress | Partial | `src/request/docs/README.md` |

Generator-side field measurement is complete for both modules and recorded in each module's
`Coverage score` row: both at 93.3%, assessed 2026-09-23, with every critical field present. Independent
semantic validation by `codex` ran on 2026-09-23 and returned `pass-with-warnings` with 0 Blocking,
1 Important, and 1 Medium finding. The proposed promotion from `Partial` to `Specced` remains held
because neither module has a characterization baseline.

## Change and verification routing

| Change affects                                          | Load and update                                                                   | Verification route                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Repository boundaries or cross-cutting architecture     | `docs/architecture.md` and applicable ADRs                                        | Repository test routing and affected owner specs |
| A stable code, package, or component boundary           | Its module spec                                                                   | Module tests plus affected contracts             |
| A public API, event, command, package, or file contract | The owning architecture/module section plus the native definition in `package.json` | Compatibility and contract tests               |
| Either transport in `src/request/`                      | `src/request/docs/README.md`, and check the sibling transport for parity          | `test:unit` plus `test:integration` and `test:browser` |
| An `HttpError` subtype name or parent                   | `src/docs/README.md` export stability section                                     | `test/integration/spec/http-error.js`            |

## Module and contract registration

Each module specification is generated directly at the exact `modules[].canonical_spec` path recorded
in `.sdd/manifest.json`. Every module and submodule is registered in the Module registry above in
manifest tree order.

This package publishes an SDK surface, not an HTTP surface, so it retains its ecosystem-native API
artifact — `package.json` and the exports it declares — and requires no OpenAPI document. The
contract identifiers, their `published` or `internal` state, and their canonical sources are recorded
in `contract_catalog.definitions` in `.sdd/manifest.json` and indexed for humans in
[Public and consumer surfaces](../architecture.md#public-and-consumer-surfaces).
