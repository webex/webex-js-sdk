---
type: Reference
title: Specification registry
description: Canonical specification registry and change-routing guide.
tags: [specifications, registry]
---
<!-- sdd-generated-metadata
doc_kind: standing-doc
generated_from: spec-index@0.3.0
generated_by: claude-cowork
approved_by: akulakum@cisco.com
updated_at: 2026-10-08T08:51:39Z
validation_status: pass-with-warnings
-->

# Specification registry

Use this page to find the canonical package architecture and the instantiated module specification. Keep technical facts in the owning document.

Start with the [package architecture](../architecture.md). No service specification exists here: this package is a library published to npm, not a deployable service, so that artifact is omitted in `.sdd/manifest.json`.

## Document roles

| Document | Canonical ownership |
| -------- | ------------------- |
| [Package architecture](../architecture.md) | Package boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture |
| Service specification | Not applicable — no deployable service exists in this package |
| Module specifications | Stable behavior and design at each manifest-routed module spec |
| [ADR](../adr/) | A durable decision, its rationale, and consequences |

## Instantiated specification registry

| Resource | Role | Canonical path | Owner | Status | Last verified |
| -------- | ---- | -------------- | ----- | ------ | ------------- |
| Package | Architecture | `docs/architecture.md` | @webex/web-client, @webex/web-sdk | Active | 2026-10-06 |
| Logger plugin | Module | `src/docs/README.md` | @webex/web-client, @webex/web-sdk | Draft | 2026-10-06 |
| `plugin-logger-sdk` | Contract | `package.json` | @webex/web-client, @webex/web-sdk | Active | 2026-10-06 |
| `log-buffer-format` | Contract | `src/logger.js` | @webex/web-client, @webex/web-sdk | Active | 2026-10-06 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src` | Leveled console logging, redaction, bounded buffers, and upload formatting | Partial | `src/docs/README.md` |

Generator-side field measurement is complete. Field coverage measured 2026-10-06 is 93.8% (15 of 16 mandatory fields PRESENT). Critical fields are 8 of 8 PRESENT. The WEAK field is test strategy: registration, the non-throwing catch branch, group indentation, and the documented redaction gaps have no unit test. Coverage state stays `Partial` until independent validation runs and a spec-drift record exists.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/plugin-logger test:unit` and `yarn workspace @webex/plugin-logger test:style` |
| A deployable service surface or operating posture | Not applicable — no deployable service exists in this package | Not applicable |
| A stable code or package boundary | `src/docs/README.md` | `yarn workspace @webex/plugin-logger test:unit` |
| Redaction, levels, buffers, or `formatLogs` output | The module spec plus `src/logger.js`; check `@webex/internal-plugin-support` | Unit spec, then `yarn workspace @webex/plugin-logger test:browser` |

## Module and contract registration

The only module is `src`, with canonical spec `src/docs/README.md`.

`plugin-logger-sdk` is published. Its ecosystem-native artifact is `package.json`. Per-export behavior is specified in the module spec and implemented in `src/`. No OpenAPI document applies, which is why `api-specs/openapi.yaml` is omitted.

`log-buffer-format` is internal. Its source is `src/logger.js`, and its consumer is `@webex/internal-plugin-support`.

`webex-core-plugin-host`, `webex-common-js-api`, and `lodash` are external required contracts. They are not implemented in this package.
