---
type: Reference
title: Specification registry
description: Canonical specification registry and change-routing guide.
tags: [specifications, registry]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: spec-index@0.3.0
generated_by: cursor
approved_by: pending
updated_at: 2026-09-16T10:06:00Z
validation_status: not-run
-->

# Specification registry

Use this page to find the canonical package architecture and every instantiated module specification plus native contract. Keep technical facts in one owning document and use this page only for navigation, ownership, status, and change/test routing.

Start with the [package architecture](../architecture.md). There is no deployable service specification for this SDK.

## Document roles

| Document                                            | Canonical ownership                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Package architecture](../architecture.md)          | Package boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture    |
| Service specification                               | N/A — this package is not a deployable service                                                               |
| Module specifications                               | Stable behavior and design at each manifest-routed `<module-path>/docs/README.md`                            |
| [ADR](../adr/)                                      | A durable decision, its deciders, rationale, consequences, and supersession lineage                          |

## Instantiated specification registry

| Resource   | Role        | Canonical path                 | Owner                         | Status | Last verified |
| ---------- | ----------- | ------------------------------ | ----------------------------- | ------ | ------------- |
| Package    | Architecture | `docs/architecture.md`        | Webex JS SDK / SPARK-853132   | Draft  | 2026-09-16    |
| core       | Module      | `src/core/docs/README.md`      | Webex JS SDK / SPARK-853132   | Draft  | 2026-09-16    |
| web        | Module      | `src/web/docs/README.md`       | Webex JS SDK / SPARK-853132   | Draft  | 2026-09-16    |
| extension  | Module      | `src/extension/docs/README.md` | Webex JS SDK / SPARK-853132   | Draft  | 2026-09-16    |
| npm exports | Contract   | `package.json`                 | Webex JS SDK                  | Active | 2026-09-16    |

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its human-readable mirror. Reconcile it with the Repo Annotation plugin checker `scripts/check_spec_index.py --repo-root <this-package>` (the script is not vendored in this JS SDK tree).

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/core` | Env-agnostic protocol, validation, correlation, rate limit, errors, and logger | Partial | `src/core/docs/README.md` |
| `src/web` | Page adapter: `createWebBridge` over `window.postMessage` | Partial | `src/web/docs/README.md` |
| `src/extension` | Isolated-world relay, privileged worker bridge, and extension UI client | Partial | `src/extension/docs/README.md` |

## Change and verification routing

| Change affects                                          | Load and update                                                                   | Verification route                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Package boundaries or cross-cutting architecture        | `docs/architecture.md` and applicable ADRs                                        | Package test routing and affected owner specs    |
| A stable code, package, or component boundary           | Its module spec                                                                   | Module tests plus affected contracts             |
| A public SDK export or file contract                    | The owning architecture/module section plus `package.json` / `src/index.ts` / `src/extension/index.ts` | `test:unit` and `test:style`                     |
| Origin checks, envelope fields, or BridgeError codes    | Owning module spec plus `SECURITY.md`                                             | `test/unit/spec/security/threats.ts`             |

## Module and contract registration

Generate each module specification directly at the exact `modules[].canonical_spec` path recorded in `.sdd/manifest.json`. Register every module in the Module registry above in manifest tree order.

Published contracts:

- `web-page-sdk` — `package.json` export `.` owned by `src/web`
- `extension-sdk` — `package.json` export `./extension` owned by `src/extension`
- `content-script-entry` — `package.json` export `./content-script` owned by `src/extension`
- `bridge-envelope` — internal event contract in `src/core/protocol.ts` owned by `src/core`
