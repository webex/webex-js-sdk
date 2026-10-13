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
updated_at: 2026-09-28T05:34:36Z
validation_status: pass
-->

# Specification registry

Use this page to find the canonical architecture for `@webex/common-timers` and every instantiated
module specification plus native contract. Technical facts stay in one owning document; this page is
navigation, ownership, status, and change/test routing only.

Start with the [repository architecture](../architecture.md). There is no service specification: the
package is a published library, not a deployable service.

## Document roles

| Document                                       | Canonical ownership                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [Repository architecture](../architecture.md)  | Package boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture            |
| Service specification                          | N/A — not generated. The package has no deployable runtime, so no service or operating contract exists                |
| Module specifications                          | Stable behavior and design at each module's `docs/README.md`, routed by `.sdd/manifest.json`                          |
| [ADR](../adr/)                                 | A durable decision, its deciders, rationale, consequences, and supersession lineage. None are registered yet         |

## Instantiated specification registry

| Resource               | Role         | Canonical path         | Owner                      | Status | Last verified |
| ---------------------- | ------------ | ---------------------- | -------------------------- | ------ | ------------- |
| `@webex/common-timers` | Architecture | `docs/architecture.md` | Cisco Webex for Developers | Active | 2026-09-28    |
| `src`                  | Module       | `src/docs/README.md`   | Cisco Webex for Developers | Active | 2026-09-28    |
| `common-timers-sdk`    | Contract     | `package.json`         | Cisco Webex for Developers | Active | 2026-09-28    |

### Module registry

One row per module in `.sdd/manifest.json`, which stays authoritative; this table is its
human-readable mirror and the reconciliation surface for `check_spec_index.py`.

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Timer primitives that never hold a Node process open: unref-ing wrappers over `setTimeout` and `setInterval`, plus the guarded `Timer` lifecycle | Partial | `src/docs/README.md` |

Generator-side field measurement for `src` is complete: 100% (14 of 14 mandatory fields) assessed
2026-09-24, with critical field coverage at 9 of 9. The score, date, and evidence summary are
recorded in the module specification's `Coverage score` metadata row and in `.sdd/manifest.json`.

Two gates still hold promotion open. This module has no characterization baseline, and the `unref`
requirements (`MOD-002`, `MOD-004`, `MOD-012`) together with the re-entrancy requirement (`MOD-009`)
have no automated evidence; the sole test file, `test/unit/spec/index.ts`, is pre-existing and covers
the `Timer` lifecycle rather than the `unref` contract. Independent validation (validator `codex`,
2026-09-24) returned blocked across two runs, raising three findings in total — consumer-inventory
drift, an onboarding command with no manifest entry, and evidence-column anchors that were not
repository file paths. All three were repaired and the third run returned pass-with-warnings. A later
run assessed a test suite that has since been withdrawn from this change, so that result is stale.
`src` stays `Partial` until the missing assertions and a characterization baseline exist and a fresh
validation covers them.

## Change and verification routing

| Change affects                                                | Load and update                                                                                       | Verification route                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Package boundaries, dependency posture, platform support, or release | `docs/architecture.md`, and a new ADR under `docs/adr/` when the decision is durable              | `yarn workspace @webex/common-timers build:src` plus the affected module spec  |
| Timer behavior, the `Timer` lifecycle, or a thrown message    | `src/docs/README.md` — `Requirements`, `State machine`, `Caller-visible failure modes`, `Verification` | `yarn workspace @webex/common-timers test:unit`                                |
| The exported surface or its types                             | `src/docs/README.md` — `Public surface` and `Export stability` — plus the architecture contract index | `yarn workspace @webex/common-timers build:src` and every dependent package's unit suite |
| Build, lint, or test configuration                            | `docs/getting-started.md` and the architecture `Shared and base libraries` section                    | `yarn workspace @webex/common-timers test:style` and `test:unit`               |

## Module and contract registration

The module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json` — `src/docs/README.md`. Every module and submodule is registered in the Module
registry above in manifest tree order; `src` has no submodules.

`common-timers-sdk` is the package's only contract: a published SDK/package surface whose canonical
native source is the entry point declared by `main` and `devMain` in `package.json`, with the exact
declarations in `src/index.ts`. Published package surfaces retain their ecosystem-native API source
and do not require OpenAPI, and the package serves no HTTP routes, so `api-specs/openapi.yaml` is
omitted. The module also consumes one external contract, `host-timer-api`, the host runtime's timer
API. This page provides navigation and ownership rather than a copied contract.
