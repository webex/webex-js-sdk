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
updated_at: 2026-09-21T08:58:59Z
validation_status: pass-with-warnings
-->

# Specification registry

Canonical specification registry and change-routing guide for `@webex/common`.

## Document roles

| Document                                            | Canonical ownership                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Repository architecture](../architecture.md)       | Repository boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture |
| Module specifications                                | Stable behavior and design at each manifest-routed `<module-path>/docs/README.md`                              |
| [ADR](../adr/)                                      | A durable decision, its deciders, rationale, consequences, and supersession lineage                          |

No service specification is registered: `docs/service.md` is `omit` in
`.sdd/manifest.json` `layout.artifact_decisions` because this package is a library, not a
deployable service.

## Instantiated specification registry

| Resource   | Role                       | Canonical path         | Owner          | Status                                  | Last verified |
| ---------- | -------------------------- | ---------------------- | -------------- | --------------------------------------- | ------------- |
| Repository | Architecture               | `docs/architecture.md` | `@webex/web-client`, `@webex/web-sdk` | Active | 2026-09-21 |
| `src` | Module | `src/docs/README.md` | `@webex/web-client`, `@webex/web-sdk` | Active | 2026-09-21 |
| `webex-common-js-api` | Contract | `package.json` | `@webex/web-client`, `@webex/web-sdk` | Active | 2026-09-21 |
| `hydra-id-format` | Contract | `src/uuid-utils.js` | `@webex/web-client`, `@webex/web-sdk` | Active | 2026-09-21 |
| `webex-client-host` | Contract | external: `@webex/webex-core` | `@webex/web-sdk` | Active | 2026-09-21 |

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its
human-readable mirror and the reconciliation surface for `scripts/check_spec_index.py`.

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Zero-Webex-dependency helpers shared by multiple SDK plugins: async flow-control decorators, base64url and Hydra identifier encoding, event proxying, environment detection, and shared constants | Partial | `src/docs/README.md` |

## Change and verification routing

| Change affects                                          | Load and update                                                                   | Verification route                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Repository boundaries or cross-cutting architecture     | `docs/architecture.md` and applicable ADRs                                        | Repository test routing and affected owner specs |
| A stable code, package, or component boundary           | Its module spec                                                                   | Module tests plus affected contracts             |
| A public API, event, command, package, or file contract | The owning architecture/service/module section plus the native definition         | Compatibility and contract tests                 |

## Module and contract registration

Generate each module specification directly at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Register every module and submodule in the Module registry above in manifest
tree order.

Each contract is registered with a stable id, publication state, canonical native source, and
owning-module link in `.sdd/manifest.json` `contract_catalog`. This package publishes an SDK
surface rather than an HTTP surface, so its published contracts point at the ecosystem-native
package manifest and source declarations; no OpenAPI document applies. `webex-client-host` is
consumed rather than provided, and is recorded with an external source.
