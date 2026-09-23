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
approved_by: "@riag"
updated_at: 2026-09-23T14:03:22Z
validation_status: pass
-->

# Specification registry

Use this page to find the canonical repository architecture and every
instantiated service and module specification plus native contract. Keep technical facts
in one owning document and use this page only for navigation, ownership,
status, and change/test routing.

Start with the [repository architecture](../architecture.md). This package contains no deployable
service, so no service specification is generated.

## Document roles

| Document                                            | Canonical ownership                                                                                          |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| [Repository architecture](../architecture.md)       | Repository boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture |
| Module specifications                                | Stable behavior and design at each manifest-routed `<module-path>/docs/README.md`                              |
| [ADR](../adr/)                                      | A durable decision, its deciders, rationale, consequences, and supersession lineage                          |

## Instantiated specification registry

| Resource   | Role                       | Canonical path         | Owner          | Status                                  | Last verified |
| ---------- | -------------------------- | ---------------------- | -------------- | --------------------------------------- | ------------- |
| Repository | Architecture               | `docs/architecture.md` | Webex JS SDK Team | Active                               | 2026-09-23    |
| AI call summary plugin | Module         | `src/docs/README.md`   | Webex JS SDK Team | Active                               | 2026-09-23    |
| ADR-0001   | Contract                   | `docs/adr/0001-flatten-container-response-and-prefer-single-request-summary.md` | Webex JS SDK Team | Active | 2026-09-23 |

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its
human-readable mirror and the reconciliation surface for `scripts/check_spec_index.py`.

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Resolve Pragya containers and return decrypted AI call summary, notes, action items, and transcript content | Specced | `src/docs/README.md` |

Coverage state is mirrored from `.sdd/manifest.json`. Generator-side field measurement is complete:
the module is `Specced` at 100% public-surface coverage, assessed 2026-09-23, with independent
validation reporting no drift. Behavior is verified by 38 unit tests in
`test/unit/spec/ai-summary.ts`, covering every documented requirement including plugin registration.

## Change and verification routing

| Change affects                                          | Load and update                                                                   | Verification route                               |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------ |
| Repository boundaries or cross-cutting architecture     | `docs/architecture.md` and applicable ADRs                                        | Repository test routing and affected owner specs |
| A stable code, package, or component boundary           | `src/docs/README.md`                                                              | Module tests plus affected contracts             |
| A public API, event, command, package, or file contract | The owning architecture/module section plus the native definition                 | Compatibility and contract tests                 |
| The published SDK surface or its types                  | `src/docs/README.md` Public surface plus `src/index.ts` and `src/types.ts`        | Compatibility checks; no automated tests exist yet |

## Module and contract registration

The module specification is generated directly at the exact `modules[].canonical_spec` path recorded
in `.sdd/manifest.json`, which is `src/docs/README.md`.

Six contracts are registered in `.sdd/manifest.json` `contract_catalog`:

| Contract ID | Publication | Native source |
| ----------- | ----------- | ------------- |
| `aisummary-sdk` | internal | `src/ai-summary.ts` |
| `aisummary-package-entry` | internal | `src/index.ts` |
| `aisummary-types` | internal | `src/types.ts` |
| `pragya-containers-http` | published, externally owned | External: Webex service catalog pragya. `src/constants.ts` |
| `ai-bridge-content-http` | published, externally owned | URLs supplied at runtime by PragyaSummaryData. `src/types.ts` |
| `webex-encryption-sdk` | internal | Workspace package @webex/internal-plugin-encryption. `package.json` |

No repository-owned HTTP surface exists, so no `api-specs/openapi.yaml` is selected. The published
SDK surface retains its ecosystem-native TypeScript declarations as the contract source. This page
provides navigation and ownership rather than a copied contract.
