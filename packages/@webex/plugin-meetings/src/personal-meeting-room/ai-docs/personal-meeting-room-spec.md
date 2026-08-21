<!-- sdd-generated-metadata
doc_kind: module-spec
generated_from: module-spec@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# PERSONAL MEETING ROOM — SPEC

> Start here → root [`AGENTS.md`](../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md). This is the canonical source-local spec for `src/personal-meeting-room/`.

## Metadata

| Field | Value |
|---|---|
| Module id | `personal-meeting-room` |
| Source path(s) | `src/personal-meeting-room/` |
| Parent spec | — |
| Doc kind | Module spec |
| Coverage score | 86% assessed 2026-08-18; 12/14 mandatory fields present; all critical fields present, two noncritical detail gaps remain |
| Generated from | `module-spec` @ SDLC template library `0.2.2` |
| generated_by / approved_by / updated_at | codex / repository user / 2026-08-18T15:33:39Z |
| Validation status | not-run |

## Evidence Rules

Requirements cite current source and mirrored tests. Current code wins over retained prose when they conflict; commit and PR history are excluded. Missing evidence stays a gap.

## Source Material Register

| Source material | Scope | Decision | Detail location or disposition |
|---|---|---|---|
| Retained package consumer documentation | overview / API / behavior / tests | used and verified; PMR retrieval/claim usage was placed in the public surface and use cases |
| Current source and mirrored tests | implementation / tests | verified | requirements, flows, failures, and test strategy below |

## Overview

For orientation, start at `src/personal-meeting-room/index.ts`; supporting files under `src/personal-meeting-room/` separate request, parsing, collection, type, or utility concerns from parent orchestration. The module is composed by `Meeting`, `Meetings`, or the package entry as applicable. Remote Webex services/Locus remain authoritative, and all local state is scoped to the SDK, plugin, meeting, or operation lifetime.

## Purpose / Responsibility

Retrieves a user's Personal Meeting Room information and performs the claim operation through the Webex service boundary.

## Stack

TypeScript/JavaScript in the Node 22.14 Yarn workspace; Webex core/plugin abstractions and Mocha/Sinon/`@webex/test-helper-chai` tests.

## Folder / Package Structure

```text
src/personal-meeting-room/
├── index.ts — primary behavior/entry point
├── request.ts — supporting request, type, utility, or constant behavior
└── ai-docs/personal-meeting-room-spec.md — canonical module specification
```

## Key Files (source of truth)

| File | Holds |
|---|---|
| `src/personal-meeting-room/index.ts` | Primary lifecycle and module surface |
| `src/personal-meeting-room/request.ts` | Supporting transport, types, constants, or normalization |
| `test/unit/spec/personal-meeting-room/personal-meeting-room.js` | Mirrored behavioral tests |

## Public Surface

| Contract ID | Type | Surface | Purpose | Compatibility / deprecation | Schema / detail link | Root index |
|---|---|---|---|---|---|---|
| `personal-meeting-room.1` | SDK / in-process / remote | fetch the current user's Personal Meeting Room | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/personal-meeting-room/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `personal-meeting-room.2` | SDK / in-process / remote | normalize PMR meeting information | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/personal-meeting-room/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `personal-meeting-room.3` | SDK / in-process / remote | claim the PMR using current identity/request context | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/personal-meeting-room/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |

Compatibility notes:
- Prefer additive fields/options and preserve current rejection/event/cleanup semantics. Internal helpers are not public merely because they are exported within the source directory.

## Requires (dependencies)

Webex host/request access, user/device identity, PMR service discovery, meeting-info normalization, and request errors.

## Requirements

| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| `PERSONAL-MEETING-ROOM-R-001` | fetch the current user's Personal Meeting Room. | Retrieves a user's Personal Meeting Room information and performs the claim operation through the Webex service boundary. | `src/personal-meeting-room/index.ts` | `test/unit/spec/personal-meeting-room/personal-meeting-room.js` | none | PRESENT |
| `PERSONAL-MEETING-ROOM-R-002` | normalize PMR meeting information. | Consumers need deterministic behavior across meeting and remote updates. | `src/personal-meeting-room/index.ts`, `src/personal-meeting-room/request.ts` | `test/unit/spec/personal-meeting-room/personal-meeting-room.js` | inspect sibling tests for operation-specific cases | PRESENT |
| `PERSONAL-MEETING-ROOM-R-003` | Invalid, rejected, or terminal operations preserve the established failure signal and release module-owned transient resources. | Hidden failure or leaked state corrupts later meeting behavior. | `src/personal-meeting-room/index.ts` | `test/unit/spec/personal-meeting-room/personal-meeting-room.js` | verify every early exit during focused changes | PRESENT |

## Design Overview

The primary controller/data module owns normalization and observable state while supporting files isolate request, type, constant, collection, or utility concerns. Capability and remote response data are checked before state changes. Async completion emits/returns one established outcome; cleanup handles listeners, timers, locks, channels, or transient requests owned by the module.

## Data Flow

```mermaid
flowchart LR
  Caller[Meeting/Meetings/consumer] --> Entry[src/personal-meeting-room/index.ts]
  Entry --> Support[src/personal-meeting-room/request.ts]
  Support --> Boundary[Webex service, Locus, or channel]
  Boundary --> Normalize[validate and normalize]
  Normalize --> State[in-memory module state]
  State --> Output[result / scoped event]
  Boundary -. rejection .-> Error[established error]
  Error --> Cleanup[release transient resources]
```

## Sequence Diagram(s)

Sequence coverage:

The operation groups below share the same caller → module → supporting dependency → Webex/input ordering and the same rejection/cleanup contract, so one combined diagram covers their common sequence; operation-specific state and guards are stated in the requirements and use cases.

| Operation group | Diagram | Failure / recovery coverage |
|---|---|---|
| fetch the current user's Personal Meeting Room | Read/derive or initialize | invalid/capability rejection |
| normalize PMR meeting information | Mutate or react | remote rejection/timeout and cleanup |

```mermaid
sequenceDiagram
  participant C as Caller
  participant M as Personal Meeting Room
  participant D as Dependency
  participant W as Webex or input source
  C->>M: invoke or deliver update
  M->>D: validate/prepare
  D->>W: request or consume input
  alt accepted
    W-->>D: payload
    D-->>M: normalized result
    M-->>C: result or scoped event
  else invalid, rejected, or timed out
    W--xD: failure
    D--xM: established error
    M->>M: idempotent cleanup
    M--xC: rejection/error event
  end
```

## Class / Component Relationships

```mermaid
classDiagram
  class Caller
  class PersonalMeetingRoom
  class SupportingDependency
  class WebexBoundary
  Caller --> PersonalMeetingRoom
  PersonalMeetingRoom --> SupportingDependency
  SupportingDependency --> WebexBoundary
```

The module owns its projection/controller and composes supporting requests, types, constants, collections, or utilities. The Webex boundary remains authoritative.

## Use Cases

- **UC-1 Primary:** the parent/consumer requests fetch the current user's Personal Meeting Room; the module validates or derives data and returns/emits the normalized outcome. Evidence: `src/personal-meeting-room/index.ts`, `test/unit/spec/personal-meeting-room/personal-meeting-room.js`.
- **UC-2 Change:** the parent/consumer triggers normalize PMR meeting information; capability/current state is checked, the dependency is invoked, and accepted state is exposed once. Evidence: `src/personal-meeting-room/index.ts`, `src/personal-meeting-room/request.ts`.

## State Model

The plugin retains current PMR information and request helper state for the owning SDK instance.

## Business Rules & Invariants

- PMR data comes from the service response; claim uses current authenticated identity and never fabricates room ownership. Enforced under `src/personal-meeting-room/`.

## Concurrency & Reactive Flow

- Remote/event/promise/timer callbacks may interleave. Preserve current identity/sequence guards, allow only the intended in-flight operation, and make listener/timer/channel cleanup idempotent.

## State Machine

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Active: initialize or accepted input
  Active --> Active: valid update
  Active --> Pending: async mutation or approval
  Pending --> Active: accepted
  Pending --> Failed: rejected or timed out
  Active --> Closed: cleanup
  Failed --> Closed: cleanup
  Closed --> [*]
```

Exact state values/guards remain in `src/personal-meeting-room/index.ts`; this diagram groups the externally meaningful lifecycle.

## Error Handling & Failure Modes

| Condition | Signal | Caller recovery |
|---|---|---|
| missing capability, identity, URL, or invalid options | validation/established rejection | refresh state or correct input; do not retry unchanged |
| service/channel/request rejection | propagated request or module error | branch on error; retry only through existing bounded policy |
| timeout, role change, or teardown race | rejected/ignored stale result with cleanup | re-read current meeting state and invoke again only if still eligible |

## Pitfalls

- A PMR is meeting metadata, not an already joined Meeting. Consumers must still create/join through Meetings.
- Verify both typed constants/enums and raw wire values before changing a logical condition in this legacy package.

## Test-Case Strategy (module)

Start with the mirrored suite and sibling files in the same test directory. Cover successful derivation/mutation plus invalid capability/input, remote rejection, stale event, and cleanup. Use Sinon, `calledOnceWithExactly`, and fake timers for retry/lock/token/channel timing.

| Behavior / Requirement | Existing test evidence | Gap |
|---|---|---|
| `PERSONAL-MEETING-ROOM-R-001` | `test/unit/spec/personal-meeting-room/personal-meeting-room.js` | inspect sibling tests for full operation matrix |
| `PERSONAL-MEETING-ROOM-R-002` | `test/unit/spec/personal-meeting-room/personal-meeting-room.js` | verify rejected and role/capability-change branches |
| `PERSONAL-MEETING-ROOM-R-003` | `test/unit/spec/personal-meeting-room/personal-meeting-room.js` | verify cleanup on all early exits |

## Traceability

- Repo architecture: [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md) · Registry: [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md)
- Coverage state and contracts baseline: `../../../.sdd/manifest.json`
