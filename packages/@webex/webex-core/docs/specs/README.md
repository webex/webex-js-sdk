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
updated_at: 2026-10-07T13:20:21Z
validation_status: pass-with-warnings
-->

# Specification registry

Use this page to find the canonical package architecture and every module specification plus native
contract. Keep technical facts in one owning document and use this page only for navigation, ownership,
status, and change/test routing.

Start with the [repository architecture](../architecture.md). There is no service specification because
the package is a library, not a deployable service.

## Document roles

| Document | Canonical ownership |
| --- | --- |
| [Repository architecture](../architecture.md) | Package boundaries, resource inventory, interactions, dependency topology, contract index and cross-cutting architecture |
| Module specifications | Stable behavior and design at each manifest-routed `<module-path>/docs/README.md` |
| [ADR](../adr/index.md) | A durable decision, its deciders, rationale, consequences and supersession lineage |

## Instantiated specification registry

| Resource | Role | Canonical path | Owner | Status | Last verified |
| --- | --- | --- | --- | --- | --- |
| Package | Architecture | `docs/architecture.md` | Cisco Webex for Developers | Active | 2026-10-07 |
| `src` | Module — plugin host and export surface | `src/docs/README.md` | Cisco Webex for Developers | Active | 2026-10-07 |
| `src/interceptors` | Module — request/response interceptors | `src/interceptors/docs/README.md` | Cisco Webex for Developers | Active | 2026-10-07 |
| `src/lib/credentials` | Module — OAuth credentials | `src/lib/credentials/docs/README.md` | Cisco Webex for Developers | Active | 2026-10-07 |
| `src/lib/services` | Module — v1 service discovery | `src/lib/services/docs/README.md` | Cisco Webex for Developers | Active | 2026-10-07 |
| `src/lib/services-v2` | Module — v2 service discovery | `src/lib/services-v2/docs/README.md` | Cisco Webex for Developers | Active | 2026-10-07 |
| `src/lib/storage` | Module — persistence layer | `src/lib/storage/docs/README.md` | Cisco Webex for Developers | Active | 2026-10-07 |

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its
human-readable mirror and the reconciliation surface for `scripts/check_spec_index.py`.

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Plugin host: WebexCore construction, plugin registration, interceptor-chain assembly, config defaults, plugin base classes, Batcher, Page, WebexHttpError and the package export surface | Partial | `src/docs/README.md` |
| ↳ `src/interceptors/` | The sixteen request/response interceptors that implement auth replay, redirects, tracking ids, rate limits, catalog URL validation, timing and logging | Partial | `src/interceptors/docs/README.md` |
| ↳ `src/lib/credentials/` | OAuth supertoken and scoped user-token lifecycle: refresh, downscope, revoke, login/logout URLs, scope helpers and grant errors | Partial | `src/lib/credentials/docs/README.md` |
| ↳ `src/lib/services/` | v1 U2C service discovery, host selection and failover, readiness gating, and the service/hostmap/server-error interceptors | Partial | `src/lib/services/docs/README.md` |
| ↳ `src/lib/services-v2/` | Opt-in TypeScript v2 service discovery over the U2CV2 hostmap, not registered by default | Partial | `src/lib/services-v2/docs/README.md` |
| ↳ `src/lib/storage/` | persist/waitForValue decorators, bounded and unbounded store factories, MemoryStoreAdapter and storage errors | Partial | `src/lib/storage/docs/README.md` |

## Change and verification routing

| Change affects | Load and update | Verification route |
| --- | --- | --- |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/webex-core test:unit` and affected owner specs |
| Plugin registration, config defaults, request orchestration or the export barrel | `src/docs/README.md` | Unit tests under `test/unit/spec` plus a dependent-plugin review |
| An interceptor or the interceptor order | `src/interceptors/docs/README.md` (and `src/docs/README.md` for ordering) | `test/unit/spec/interceptors` and `test/unit/spec/webex-core.js` |
| Tokens, scopes, refresh or logout | `src/lib/credentials/docs/README.md` | `test/unit/spec/credentials` |
| Service catalog, host selection or readiness | `src/lib/services/docs/README.md` or `src/lib/services-v2/docs/README.md` | `test/unit/spec/services` or `test/unit/spec/services-v2` |
| Persistence decorators or store factories | `src/lib/storage/docs/README.md` | `test/unit/spec/storage` |
| A public API, event, package or file contract | The owning module section plus the native source listed in the contract index | Compatibility review across dependent workspace packages |

## Module and contract registration

Every module specification lives at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. The package's contracts are registered in `contract_catalog` and indexed in
[`docs/architecture.md`](../architecture.md#public-and-consumer-surfaces); each owning module links the
same native source. The package is an SDK, so no OpenAPI document applies.
