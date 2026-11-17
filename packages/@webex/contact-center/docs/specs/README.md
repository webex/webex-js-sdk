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
updated_at: 2026-11-17T03:03:58Z
validation_status: pass-with-warnings
-->

# Specification registry

Use this page to find the canonical package architecture and every instantiated module specification
plus native contract for `@webex/contact-center`. Keep technical facts in one owning document and use
this page only for navigation, ownership, status, and change/test routing. This registry mirrors
`.sdd/manifest.json`, which stays authoritative.

Start with the [package architecture](../architecture.md). No service specification exists because
this package is a library: `package.json` has no start script or deployment descriptor
(`layout.artifact_decisions` in `.sdd/manifest.json`).

## Document roles

| Document | Canonical ownership |
| -------- | ------------------- |
| [Package architecture](../architecture.md) | Package boundaries, resource inventory, interactions, dependency topology, cross-cutting architecture, the contract index, domain language, and the security architecture |
| [Getting started](../getting-started.md) | Prerequisites, install, build, and the test router with the manifest commands |
| Module specifications | Stable behavior and design at each manifest-routed `docs/README.md` beside the module code |
| [ADR](../adr/index.md) | A durable decision, its deciders, rationale, consequences, and supersession lineage |
| [Package agent instructions](../../AGENTS.md) | Agent rules, the development workflow, coding patterns, and the review checklist |

## Instantiated specification registry

| Resource | Role | Canonical path | Owner | Status | Last verified |
| -------- | ---- | -------------- | ----- | ------ | ------------- |
| Package | Architecture | `docs/architecture.md` | @webex/web-sdk | Active | 2026-11-16 |
| Contact Center public plugin | Module | `src/docs/README.md` | @webex/web-sdk | Active | 2026-11-16 |
| Metrics | Module | `src/metrics/docs/README.md` | @webex/web-sdk | Active | 2026-11-16 |
| Services composition | Module | `src/services/docs/README.md` | @webex/web-sdk | Active | 2026-11-16 |
| Agent | Module | `src/services/agent/docs/README.md` | @webex/web-sdk | Active | 2026-11-16 |
| Config | Module | `src/services/config/docs/README.md` | @webex/web-sdk | Active | 2026-11-16 |
| Core | Module | `src/services/core/docs/README.md` | @webex/web-sdk | Active | 2026-11-16 |
| Task | Module | `src/services/task/docs/README.md` | @webex/web-sdk | Active | 2026-11-16 |
| Task state machine | Module | `src/services/task/state-machine/docs/README.md` | @webex/web-sdk | Active | 2026-11-16 |
| Utils | Module | `src/utils/docs/README.md` | @webex/web-sdk | Active | 2026-11-16 |
| Spec source policy | ADR | `docs/adr/0001-spec-source-policy.md` | @webex/web-sdk | Superseded | 2026-11-16 |
| Consult and transfer list policy | ADR | `docs/adr/0002-consult-transfer-list-policy.md` | @webex/web-sdk | Accepted | 2026-11-16 |
| Repo-standards migration | ADR | `docs/adr/0003-repo-standards-migration.md` | @webex/web-sdk | Accepted | 2026-11-16 |

### Module registry

| Module | Responsibility | Manifest coverage state | Start here |
| --- | --- | --- | --- |
| `src/` | Own the published Webex Contact Center SDK plugin surface, registration lifecycle, public method delegation, and application-facing event routing. | Partial | `src/docs/README.md` |
| ↳ `src/metrics/` | Own timing, taxonomy, queuing, payload preparation, and submission for Contact Center behavioral, operational, and business telemetry. | Partial | `src/metrics/docs/README.md` |
| ↳ `src/services/` | Own composition and bootstrap order for backend request and realtime collaborators (the Services singleton), plus the direct REST data, user preference, AI assistant, and WebRTC service classes that ContactCenter constructs. | Partial | `src/services/docs/README.md` |
| ↳ ↳ `src/services/agent/` | Own agent login, logout, state-change, buddy-agent, and reload request contracts; ContactCenter uses reload for silent relogin and stationLogin for device updates. | Partial | `src/services/agent/docs/README.md` |
| ↳ ↳ `src/services/config/` | Own retrieval and aggregation of remote organization, agent, team, profile, auxiliary-code, dial-plan, and feature configuration. | Partial | `src/services/config/docs/README.md` |
| ↳ ↳ `src/services/core/` | Own authenticated HTTP, realtime WebSocket lifecycle, AQM request correlation, reconnect/keepalive behavior, and shared error normalization. | Partial | `src/services/core/docs/README.md` |
| ↳ ↳ `src/services/task/` | Own task creation, media-specific behavior, call-control operations, lifecycle orchestration, task events, and integration with the task state machine. | Partial | `src/services/task/docs/README.md` |
| ↳ ↳ ↳ `src/services/task/state-machine/` | Own deterministic task lifecycle states, transition guards/actions, typed internal events, and state-derived UI-control availability. | Partial | `src/services/task/state-machine/docs/README.md` |
| ↳ `src/utils/` | Own shared pagination contracts and the bounded in-memory page cache used by Contact Center data services. | Partial | `src/utils/docs/README.md` |

All nine modules remain `Partial` in `.sdd/manifest.json`; coverage review is pending. Independent
validation on 2026-11-17 passed with warnings (0 Blocking, 0 Important, 4 Minor). No coverage promotion was performed.

Three documentation-only correction records from July 2026 (a validator drift fix, a residual-warning
completion, and a conformance and fidelity remediation) are folded into the nine module specifications.

## Change and verification routing

| Change affects | Load and update | Verification route |
| -------------- | --------------- | ------------------ |
| Package boundaries or cross-cutting architecture | `docs/architecture.md` and applicable ADRs | `yarn workspace @webex/contact-center build:src`, `yarn workspace @webex/contact-center test:unit`, and `yarn workspace @webex/contact-center test:style`, plus the affected module specs |
| A stable code, package, or component boundary | Its module spec from the Module registry | Module tests under `test/unit/spec`, plus affected contracts |
| A public API, event, or exported type | The owning module spec, the contract index in `docs/architecture.md`, `src/index.ts`, and `.sdd/manifest.json` `contract_catalog` | `yarn workspace @webex/contact-center build` for declarations, then `yarn workspace @webex/contact-center test:unit`; `test/unit/spec/index.ts` covers the root exports |
| Consult and transfer destination lists or controls | ADR-0002, the Contact Center, Services, Utils, Task, and Task state machine specs | `test/unit/spec/cc.ts`, `test/unit/spec/services/Queue.ts`, `test/unit/spec/services/EntryPoint.ts`, `test/unit/spec/services/AddressBook.ts`, `test/unit/spec/services/task/state-machine/uiControlsComputer.ts` |
| Task state or lifecycle transitions | The Task and Task state machine module specs | `test/unit/spec/services/task/state-machine/TaskStateMachine.ts`, `test/unit/spec/services/task/TaskManager.ts` |
| Transport, reconnect, or recovery | The Core module spec and the security architecture in `docs/architecture.md` | `test/unit/spec/services/core/aqm-reqs.ts`, `test/unit/spec/services/core/websocket/connection-service.ts`, `test/unit/spec/cc.ts` |
| A new feature or defect | The affected module specs, then the Working Method in `AGENTS.md` | The verification route of each affected row above |

## Module and contract registration

Each module specification is generated at the exact `modules[].canonical_spec` path recorded in
`.sdd/manifest.json`. Register every module and submodule in the Module registry above in manifest
tree order; a new module needs a manifest entry, its module spec, and its contracts.

Contracts are registered in `.sdd/manifest.json` `contract_catalog` with a stable ID, publication
state, native source, and owning module, and indexed in the
[package architecture](../architecture.md#public-and-consumer-surfaces). The published surface is the
npm package (`contact-center-sdk`, native source `package.json`) and its event enums; the Contact
Center REST and WebSocket contracts are external and consumed, so the package has no OpenAPI document.
This page provides navigation and ownership rather than a copied contract.
