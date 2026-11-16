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
updated_at: 2026-11-16T14:30:00Z
validation_status: not-run
-->

# Specification registry

Use this page to find the canonical package architecture and every instantiated module specification
plus native contract. Keep technical facts in one owning document and use this page only for
navigation, ownership, status, and change/test routing. This registry mirrors `.sdd/manifest.json`;
load only the docs needed for the task.

Start with the [package architecture](../architecture.md). No service specification exists because this
package is a library.

## Document roles

| Document | Canonical ownership |
| -------- | ------------------- |
| [Package architecture](../architecture.md) | Package boundaries, resource inventory, interactions, dependency topology, and cross-cutting architecture, including the contract index (export, event, request, and dependency catalog), client-side data model, service state, security, and glossary |
| [Agent instructions](../../AGENTS.md) | Enforceable package rules, code-grounded implementation patterns (5. Code Style and Patterns), and the core and conditional review checklist |
| [Getting started](../getting-started.md) | Toolchain, focused development loop, source-to-test routing, and quality gates |
| Module specifications | Stable behavior and design at each manifest-routed `<module-path>/docs/README.md` |
| [ADR](../adr/index.md) | A durable decision, its deciders, rationale, consequences, and supersession lineage |

## Instantiated specification registry

| Resource | Role | Canonical path | Owner | Status | Last verified |
| -------- | ---- | -------------- | ----- | ------ | ------------- |
| Package | Architecture | `docs/architecture.md` | @webex/web-client, @webex/web-sdk | Draft | 2026-11-16 |
| Each of the 23 manifest modules | Module | One spec per module, at the Start here path in the Module registry below | @webex/web-client, @webex/web-sdk | Draft | 2026-11-16 |
| Migrate existing docs into SDD | ADR | `docs/adr/0001-migrate-existing-docs-into-sdd.md` | @webex/web-client, @webex/web-sdk | Accepted | 2026-11-16 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/aiEnableRequest/` | Host approval workflow for enabling AI Assistant | Partial | `src/aiEnableRequest/docs/README.md` |
| `src/annotation/` | Annotation data-channel state and commands | Partial | `src/annotation/docs/README.md` |
| `src/breakouts/` | Breakout sessions, rosters, host operations, and events | Partial | `src/breakouts/docs/README.md` |
| `src/controls-options-manager/` | Derivation and mutation of meeting control capabilities | Partial | `src/controls-options-manager/docs/README.md` |
| `src/hashTree/` | Incremental Locus dataset synchronization | Partial | `src/hashTree/docs/README.md` |
| `src/interceptors/` | Locus routing/retry and data-channel authentication middleware | Partial | `src/interceptors/docs/README.md` |
| `src/interpretation/` | Simultaneous-interpretation language and handoff workflows | Partial | `src/interpretation/docs/README.md` |
| `src/locus-info/` | Normalized Locus full, delta, and hash-tree state | Partial | `src/locus-info/docs/README.md` |
| `src/media/` | Media connection construction and readiness | Partial | `src/media/docs/README.md` |
| `src/meeting/` | One meeting's lifecycle, media, controls, state, and events | Partial | `src/meeting/docs/README.md` |
| `src/meeting-info/` | Destination resolution and validated meeting metadata | Partial | `src/meeting-info/docs/README.md` |
| `src/meetings/` | Registered plugin, meeting discovery, registration, and collection coordination | Partial | `src/meetings/docs/README.md` |
| `src/member/` | Individual participant projection | Partial | `src/member/docs/README.md` |
| `src/members/` | Participant roster, mutations, and member events | Partial | `src/members/docs/README.md` |
| `src/metrics/` | Behavioral metric normalization and submission | Partial | `src/metrics/docs/README.md` |
| `src/multistream/` | Remote media groups and send/receive slot management | Partial | `src/multistream/docs/README.md` |
| `src/personal-meeting-room/` | Personal Meeting Room lookup and claim | Partial | `src/personal-meeting-room/docs/README.md` |
| `src/reachability/` | Cluster/protocol media reachability probing | Partial | `src/reachability/docs/README.md` |
| `src/reactions/` | Reaction catalogs, wire values, and normalized reaction data | Partial | `src/reactions/docs/README.md` |
| `src/reconnection-manager/` | Bounded media recovery and meeting rejoin | Partial | `src/reconnection-manager/docs/README.md` |
| `src/recording-controller/` | Meeting recording action orchestration | Partial | `src/recording-controller/docs/README.md` |
| `src/roap/` | ROAP signaling and TURN discovery | Partial | `src/roap/docs/README.md` |
| `src/webinar/` | Webinar practice-session and webcast controls | Partial | `src/webinar/docs/README.md` |

All 23 modules are flat siblings with no submodules. Each stays `Partial`: coverage scores are not
yet measured, and promotion waits for coverage review and independent validation of these specs.

`src/common/`, `src/e2ee/`, and `src/transcription/` are not manifest modules and have no module
specification yet; they are unspecced, and specifying them is a follow-up. Until then, read their
code and the architecture document, and treat code as the source of truth there.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn build:src`, `yarn test:unit`, and `yarn test:style`, plus the affected module specs |
| A stable code, package, or component boundary | Its module spec | Focused `yarn test:unit` runs of the module's suites (narrowed with `--targets`, see [Getting started](../getting-started.md#tests)) plus affected contracts |
| A public API, event, request, or package contract | The contract index in `docs/architecture.md`, the owning module spec, and the native definition (`package.json`, `src/index.ts`, `src/constants.ts`, or the owning request file) | Build, lint, and the owning module's unit suites; `yarn test:browser` when service integration changes |

For any `src/{module}/` task, load its source-local spec from the registry and cross-check current code
whenever its manifest state is `Partial` or `Untracked`.

Task routing:

| If the task is… | Load |
|---|---|
| Understanding the package | `docs/architecture.md` |
| Changing a public export, method, event, or request | the contract index in `docs/architecture.md`, owning module spec, and the rules in `AGENTS.md` |
| Changing tokens, identity, participant data, transcripts, or media | the security section of `docs/architecture.md` and the owning module spec |
| Changing lifecycle, Locus, or roster state | `meeting`, `meetings`, `locus-info`, or `members` spec as applicable |
| Changing WebRTC setup or recovery | affected `media`, `multistream`, `roap`, `reachability`, or `reconnection-manager` spec |
| Changing an in-meeting capability | owning feature spec plus `meeting` integration points |
| Changing request middleware or telemetry | `interceptors` or `metrics` spec and security rules |
| Adding or changing an implementation convention | the matching pattern in `AGENTS.md`, 5. Code Style and Patterns |

Phase-based loading:

| Phase | Load |
|---|---|
| Orient | `AGENTS.md` and this registry |
| Specify | affected module spec, the contract index in `docs/architecture.md`, and applicable security/rule sections |
| Build | affected module spec plus relevant patterns in `AGENTS.md` and tests |
| Verify | focused tests, build and lint, coverage review, and independent validation evidence |

No package-local incident or RCA index exists. Commit and PR history are excluded from
current-behavior evidence.

## Module and contract registration

Each module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json` (`src/<module>/docs/README.md`). Register every module and submodule in the Module
registry above in manifest tree order.

Contracts are registered in `.sdd/manifest.json` `contract_catalog` and indexed in
[`docs/architecture.md`](../architecture.md#public-and-consumer-surfaces) with a stable ID,
publication state, native source, and owning module. The published SDK surface is `package.json`
(built from `src/index.ts`); the Locus, site-preference, meeting-info, and ROAP HTTP surfaces are
internal clients whose native source is their request code, so no OpenAPI document applies. This page
provides navigation and ownership rather than a copied contract.
