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
updated_at: 2026-10-14T13:20:00Z
validation_status: not-run
-->

# Specification registry

Use this page to find the canonical package architecture and every instantiated module specification
and native contract. Keep technical facts in the owning document.

Start with the [package architecture](../architecture.md). No service specification exists: this
package is a library published to npm, so that artifact is omitted in `.sdd/manifest.json`.

## Document roles

| Document | Canonical ownership |
| -------- | ------------------- |
| [Package architecture](../architecture.md) | Package boundaries, resource inventory, interactions, dependency topology, contract index, and cross-cutting architecture |
| Service specification | Not applicable — no deployable service exists in this package |
| Module specifications | Stable behavior and design at each manifest-routed module spec |
| [ADR](../adr/index.md) | A durable decision, its deciders, rationale, and consequences |

## Instantiated specification registry

| Resource | Role | Canonical path | Owner | Status | Last verified |
| -------- | ---- | -------------- | ----- | ------ | ------------- |
| Package | Architecture | `docs/architecture.md` | @webex/web-client | Draft | 2026-10-14 |
| First-party browser authorization plugin | Module | `src/docs/README.md` | @webex/web-client | Draft | 2026-10-14 |
| `authz-bfp-sdk` | Contract | `package.json` | @webex/web-client | Active | 2026-10-14 |
| `authz-bfp-events` | Contract | `src/authorization.js` | @webex/web-client | Active | 2026-10-14 |
| `authz-bfp-redirect-protocol` | Contract | `src/authorization.js` | @webex/web-client | Active | 2026-10-14 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | First-party browser OAuth sign-in: redirect completion, login and third-party redirects, token exchange, QR device flow, client authentication | Partial | `src/docs/README.md` |

Generator-side field measurement is complete. Field coverage measured 2026-10-14 is 93.3% (14 of 15
mandatory fields PRESENT for `src`). Critical fields are 8 of 8 PRESENT. The WEAK field is test strategy:
untested paths are listed in the module spec's Verification section, and no characterization baseline
exists. Coverage state stays `Partial` until independent validation, a characterization baseline, and a
spec-drift record exist.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/plugin-authorization-browser-first-party test:unit` and `yarn workspace @webex/plugin-authorization-browser-first-party test:style` |
| A deployable service surface or operating posture | Not applicable — no deployable service exists in this package | Not applicable |
| Redirect completion, CSRF, PKCE, or URL scrubbing | `src/docs/README.md` | `yarn workspace @webex/plugin-authorization-browser-first-party build:src`, then `yarn workspace @webex/plugin-authorization-browser-first-party test:unit` |
| Token exchange, refresh callback, or client authentication | `src/docs/README.md`; check webex-core credentials callers | `yarn workspace @webex/plugin-authorization-browser-first-party build:src`, then `yarn workspace @webex/plugin-authorization-browser-first-party test:unit` |
| QR device flow or event payloads | `src/docs/README.md` and `docs/architecture.md`; check web client listeners | `yarn workspace @webex/plugin-authorization-browser-first-party test:unit` |
| A public export, event name, or the plugin name | The module spec and `docs/architecture.md`; check the `webex` first-party bundle and recipe-private-web-client | `yarn workspace @webex/plugin-authorization-browser-first-party test:unit`, then `yarn workspace @webex/plugin-authorization-browser-first-party build` |
| Login, logout, or third-party URL construction | Not owned here; change sibling package webex-core | That package's own checks, then `yarn workspace @webex/plugin-authorization-browser-first-party test:unit` |

## Module and contract registration

Modules, in manifest tree order: `src` with canonical spec `src/docs/README.md`. It has no child
module.

`authz-bfp-sdk` is published; its ecosystem-native artifact is `package.json`, owned by `src`.
`authz-bfp-events` is published with source `src/authorization.js`, owned by `src`.
`authz-bfp-redirect-protocol` is internal with source `src/authorization.js`, owned by `src`. No
OpenAPI document applies, which is why `api-specs/openapi.yaml` is omitted.

`webex-core-plugin-host`, `webex-common-js-api`, `idbroker-oauth`, and
`oauth-helper-device-authorization` are external required contracts. They are not implemented in
this package.
