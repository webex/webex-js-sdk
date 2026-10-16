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
updated_at: 2026-10-15T15:50:41Z
validation_status: pass-with-warnings
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
| [ADR](../adr/) | A durable decision, its deciders, rationale, and consequences |

## Instantiated specification registry

| Resource | Role | Canonical path | Owner | Status | Last verified |
| -------- | ---- | -------------- | ----- | ------ | ------------- |
| Package | Architecture | `docs/architecture.md` | @webex/web-sdk | Draft | 2026-10-13 |
| webex bundle entry points | Module | `src/docs/README.md` | @webex/web-sdk | Draft | 2026-10-13 |
| `webex-sdk` | Contract | `package.json` | @webex/web-sdk | Active | 2026-10-13 |
| `webex-umd-bundles` | Contract | `umd/` | @webex/web-sdk | Active | 2026-10-13 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Entry files, package config, storage choice, and the `Calling` wrapper | Partial | `src/docs/README.md` |

Generator-side field measurement is complete. Field coverage measured 2026-10-13 is 93.3% (14 of 15 mandatory fields PRESENT for `src`). Critical fields are 8 of 8 PRESENT. The WEAK field is test strategy: 4 unit cases and three loadable integration specs (`commonjs.js`, `init.js`, `request.js`, whose user-agent case fails while `package.json` has no `version`) cover the main entry only; the fourth integration spec, `env.js`, requires the unexported `webex/env` subpath and cannot reach `env.js`, and the untested entries are listed in the module spec's Verification section. Independent validation: see the Validation status row of the module spec. PASS-WITH-WARNINGS; validator current-session; assessed 2026-10-15; source 8d56e3b; findings: 0 Blocking, 1 Important, 0 Medium, 1 Minor. Coverage state stays `Partial` until the other entries and `Calling` are tested, a characterization baseline exists, and a spec-drift record exists.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace webex test:unit` and `yarn workspace webex test:style` |
| A deployable service surface or operating posture | Not applicable — no deployable service exists in this package | Not applicable |
| The plugin set or `init` of `src/webex.js` or `src/index.js` | `src/docs/README.md` | Add an assertion for the namespace added or removed (existing specs assert only ten public namespaces, not `cc` or the internal plugins); `yarn workspace webex build:src`, `yarn workspace webex test:unit`, `yarn workspace webex test:style`, then `yarn workspace webex test:integration --targets commonjs.js` and `yarn workspace webex test:integration --targets init.js` (`request.js` fails its user-agent case while `package.json` has no `version`); for UMD, `yarn build:script` and check its output |
| The plugin set or `init` of `src/meetings.js`, `src/encryption.js`, or `src/webex-first-party.js` | `src/docs/README.md` | No existing test loads these entries; add a focused test that loads the changed entry, run `yarn workspace webex build:src`, `yarn workspace webex test:unit`, and `yarn workspace webex test:style`; for UMD-fed entries, `yarn build:script` and check its output |
| `Calling` | `src/docs/README.md` | Add the missing unit case, then `yarn workspace webex build:src`, `yarn workspace webex test:unit`, and `yarn workspace webex test:style`; `yarn build:script` and check its output |
| `src/config.js`, `src/config-storage.js`, or `src/config-storage.shim.js` | `src/docs/README.md` | Add a focused characterization test for the merged config and storage adapters (the unit spec asserts neither), then `yarn workspace webex build:src`, `yarn workspace webex test:unit`, and `yarn workspace webex test:style`; `yarn build:script` and check its output |
| The `exports` map, `browser` field, or UMD globals | `src/docs/README.md` and `docs/architecture.md` | `yarn workspace webex build` and `yarn workspace webex test:unit` for `dist/`; `yarn build:script` from the workspace root for the `umd/` bundles and globals, then check its webpack output and the rewritten `umd/` files (it can exit 0 after a failed build; module spec Pitfalls) |
| `env.js`, `browser.js`, or `process` | `src/docs/README.md` | `yarn workspace webex eslint ./env.js ./browser.js ./process`, then add a test with the change: no test covers `browser.js`, and the `env.js` integration spec requires the unexported `webex/env` subpath |

## Module and contract registration

Modules, in manifest tree order: `src` with canonical spec `src/docs/README.md`.

`webex-sdk` is published; its ecosystem-native artifact is `package.json`, owned by `src`.
`webex-umd-bundles` is published; its native artifact is the committed `umd/` directory, owned by
`src`. No OpenAPI document applies, which is why `api-specs/openapi.yaml` is omitted.

`webex-core-plugin-host`, `webex-public-plugins`, `webex-internal-plugins`, `webex-calling-sdk`,
`webex-contact-center-sdk`, `storage-adapter-local-storage`, `babel-polyfill`, and `lodash` are
external required contracts. They are not implemented in this package.
