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
updated_at: 2026-10-07T04:50:31Z
validation_status: pass
-->

# Specification registry

Use this page to find the canonical repository architecture and every
instantiated module specification plus native contract. Keep technical facts
in one owning document and use this page only for navigation, ownership,
status, and change/test routing.

Start with the [repository architecture](../architecture.md). No service
specification exists: this package is a library plugin with no deployable
service, recorded as `docs/service.md: omit` in `.sdd/manifest.json`.

## Document roles

| Document                                            | Canonical ownership                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Repository architecture](../architecture.md)       | Repository boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture |
| Service specification                                | Not applicable — no deployable service in this package                                                       |
| Module specifications                                | Stable behavior and design at each manifest-routed `<module-path>/docs/README.md`                              |
| [ADR](../adr/)                                      | A durable decision, its deciders, rationale, consequences, and supersession lineage                          |

## Instantiated specification registry

| Resource                                     | Role         | Canonical path                                                  | Owner                             | Status | Last verified |
| -------------------------------------------- | ------------ | --------------------------------------------------------------- | --------------------------------- | ------ | ------------- |
| Repository                                   | Architecture | `docs/architecture.md`                                           | Cisco Webex JS SDK — telemetry    | Active | 2026-10-05    |
| Metrics plugin root                          | Module       | `src/docs/README.md`                                             | Cisco Webex JS SDK — telemetry    | Active | 2026-10-05    |
| Call Analyzer diagnostics                    | Module       | `src/call-diagnostic/docs/README.md`                             | Cisco Webex JS SDK — telemetry    | Active | 2026-10-05    |
| Privacy and security permission enrichment   | Module       | `src/privacy-and-security-permission-enricher/docs/README.md`     | Cisco Webex JS SDK — telemetry    | Active | 2026-10-05    |
| WebRTC stats telemetry                       | Module       | `src/rtcMetrics/docs/README.md`                                  | Cisco Webex JS SDK — telemetry    | Active | 2026-10-05    |
| Unhandled exception telemetry                | Module       | `src/unhandled-exception-telemetry/docs/README.md`                | Cisco Webex JS SDK — telemetry    | Active | 2026-10-05    |
| Published SDK surface                        | Contract     | `src/index.ts`                                                   | Cisco Webex JS SDK — telemetry    | Active | 2026-10-05    |
| Call Analyzer event schema                   | Contract     | `@webex/event-dictionary-ts`, pinned in `package.json`            | Webex Call Analyzer (external)    | Active | 2026-10-05    |

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its
human-readable mirror and the reconciliation surface for `scripts/check_spec_index.py`.

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Plugin registration, the legacy `metrics` and current `newMetrics` façades, the batcher family, tagged-event metrics and SDK network telemetry | Partial | `src/docs/README.md` |
| ↳ `src/call-diagnostic/` | Call Analyzer client, feature and media-quality events, the latency ledger, error-code mapping and its own batcher | Partial | `src/call-diagnostic/docs/README.md` |
| ↳ `src/privacy-and-security-permission-enricher/` | Permission-change enrichment policy applied to Call Analyzer client events | Partial | `src/privacy-and-security-permission-enricher/docs/README.md` |
| ↳ `src/rtcMetrics/` | WebRTC stats telemetry submitted to the unified telemetry service | Partial | `src/rtcMetrics/docs/README.md` |
| ↳ `src/unhandled-exception-telemetry/` | Browser uncaught error and promise-rejection reporter | Partial | `src/unhandled-exception-telemetry/docs/README.md` |

Every module carries a generated canonical spec. All five are held at `Partial` because the first
generator-side coverage measurement has not yet produced a score; promotion to `Specced` is a
coverage-review decision recorded in `.sdd/manifest.json`, not a generation decision. Independent
semantic validation is a separate gate and is deferred to another runtime by explicit owner
instruction.

## Change and verification routing

| Change affects                                          | Load and update                                                                   | Verification route                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Repository boundaries or cross-cutting architecture     | `docs/architecture.md` and applicable ADRs                                        | `test:unit` plus the affected owner specs        |
| A submitted payload, metric name or event name          | The owning module spec's `Protocol and wire format`, plus `src/metrics.types.ts`  | `test:unit` for the owning module's spec file    |
| A stable code, package, or component boundary           | Its module spec                                                                   | Module tests plus affected contracts             |
| A public API, event, command, package, or file contract | The owning architecture/module section plus the native declaration                | `test:unit` and `build` for declaration output   |

## Module and contract registration

Generate each module specification directly at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json` (default `<module-path>/docs/README.md`). Never copy a visible module starter or
reconstruct a path from an example. Register every module and submodule in the Module registry above
in manifest tree order.

Register each contract with a stable identity, `published` or `internal` publication state, canonical
native source, and owning-module link. This package owns no HTTP surface, so no OpenAPI document is
selected; its published surface is the ecosystem-native SDK export declared in `package.json` and
`src/index.ts`, and the upstream Webex metrics and unified telemetry HTTP contracts are externally
owned. This page provides navigation and ownership rather than a copied contract.
