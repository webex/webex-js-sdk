<!-- sdd-generated-metadata
doc_kind: module-spec
generated_from: module-spec@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# ANNOTATION — SPEC

> Start here → root [`AGENTS.md`](../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md). This is the canonical source-local spec for `src/annotation/`.

## Metadata

| Field | Value |
|---|---|
| Module id | `annotation` |
| Source path(s) | `src/annotation/` |
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
| No routed legacy module spec | overview / API / behavior / tests | none; generated from current annotation controller/types/constants and tests |
| Current source and mirrored tests | implementation / tests | verified | requirements, flows, failures, and test strategy below |

## Overview

For orientation, start at `src/annotation/index.ts`; supporting files under `src/annotation/` separate request, parsing, collection, type, or utility concerns from parent orchestration. The module is composed by `Meeting`, `Meetings`, or the package entry as applicable. Remote Webex services/Locus remain authoritative, and all local state is scoped to the SDK, plugin, meeting, or operation lifetime.

## Purpose / Responsibility

Owns annotation capability state and the meeting data-channel commands/events used to start, stop, clear, and relay shared-content annotations.

## Stack

TypeScript/JavaScript in the Node 22.14 Yarn workspace; Webex core/plugin abstractions and Mocha/Sinon/`@webex/test-helper-chai` tests.

## Folder / Package Structure

```text
src/annotation/
├── index.ts — primary behavior/entry point
├── annotation.types.ts — supporting request, type, utility, or constant behavior
└── ai-docs/annotation-spec.md — canonical module specification
```

## Key Files (source of truth)

| File | Holds |
|---|---|
| `src/annotation/index.ts` | Primary lifecycle and module surface |
| `src/annotation/annotation.types.ts` | Supporting transport, types, constants, or normalization |
| `test/unit/spec/annotation/index.ts` | Mirrored behavioral tests |

## Public Surface

| Contract ID | Type | Surface | Purpose | Compatibility / deprecation | Schema / detail link | Root index |
|---|---|---|---|---|---|---|
| `annotation.1` | SDK / in-process / remote | derive annotation availability and role policy | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/annotation/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `annotation.2` | SDK / in-process / remote | send typed annotation commands over the meeting channel | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/annotation/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `annotation.3` | SDK / in-process / remote | receive and normalize annotation relay events | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/annotation/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |

Compatibility notes:
- Prefer additive fields/options and preserve current rejection/event/cleanup semantics. Internal helpers are not public merely because they are exported within the source directory.

## Requires (dependencies)

Meeting/Locus policy and sharing state, data channel, annotation constants/types, event scope, and participant identity.

## Requirements

| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| `ANNOTATION-R-001` | derive annotation availability and role policy. | Owns annotation capability state and the meeting data-channel commands/events used to start, stop, clear, and relay shared-content annotations. | `src/annotation/index.ts` | `test/unit/spec/annotation/index.ts` | none | PRESENT |
| `ANNOTATION-R-002` | send typed annotation commands over the meeting channel. | Consumers need deterministic behavior across meeting and remote updates. | `src/annotation/index.ts`, `src/annotation/annotation.types.ts` | `test/unit/spec/annotation/index.ts` | inspect sibling tests for operation-specific cases | PRESENT |
| `ANNOTATION-R-003` | Invalid, rejected, or terminal operations preserve the established failure signal and release module-owned transient resources. | Hidden failure or leaked state corrupts later meeting behavior. | `src/annotation/index.ts` | `test/unit/spec/annotation/index.ts` | verify every early exit during focused changes | PRESENT |

## Design Overview

The primary controller/data module owns normalization and observable state while supporting files isolate request, type, constant, collection, or utility concerns. Capability and remote response data are checked before state changes. Async completion emits/returns one established outcome; cleanup handles listeners, timers, locks, channels, or transient requests owned by the module.

## Data Flow

```mermaid
flowchart LR
  Caller[Meeting/Meetings/consumer] --> Entry[src/annotation/index.ts]
  Entry --> Support[src/annotation/annotation.types.ts]
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
| derive annotation availability and role policy | Read/derive or initialize | invalid/capability rejection |
| send typed annotation commands over the meeting channel | Mutate or react | remote rejection/timeout and cleanup |

```mermaid
sequenceDiagram
  participant C as Caller
  participant M as Annotation
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
  class Annotation
  class SupportingDependency
  class WebexBoundary
  Caller --> Annotation
  Annotation --> SupportingDependency
  SupportingDependency --> WebexBoundary
```

The module owns its projection/controller and composes supporting requests, types, constants, collections, or utilities. The Webex boundary remains authoritative.

## Use Cases

- **UC-1 Primary:** the parent/consumer requests derive annotation availability and role policy; the module validates or derives data and returns/emits the normalized outcome. Evidence: `src/annotation/index.ts`, `test/unit/spec/annotation/index.ts`.
- **UC-2 Change:** the parent/consumer triggers send typed annotation commands over the meeting channel; capability/current state is checked, the dependency is invoked, and accepted state is exposed once. Evidence: `src/annotation/index.ts`, `src/annotation/annotation.types.ts`.

## State Model

Current annotation status, channel/listener state, sharing resource context, policy, and active participant information are meeting scoped.

## Business Rules & Invariants

- Annotation actions require an active supported share, allowed policy/role, and valid channel; command and relay types use declared wire constants. Enforced under `src/annotation/`.

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

Exact state values/guards remain in `src/annotation/index.ts`; this diagram groups the externally meaningful lifecycle.

## Protocol / Wire Format

- Existing request/event/channel types and constants under `src/annotation/` own serialization and parsing. Preserve field names, enum/raw values, identity/routing fields, and compatibility; normalized client properties are not a replacement wire schema.

## Error Handling & Failure Modes

| Condition | Signal | Caller recovery |
|---|---|---|
| missing capability, identity, URL, or invalid options | validation/established rejection | refresh state or correct input; do not retry unchanged |
| service/channel/request rejection | propagated request or module error | branch on error; retry only through existing bounded policy |
| timeout, role change, or teardown race | rejected/ignored stale result with cleanup | re-read current meeting state and invoke again only if still eligible |

## Pitfalls

- Annotation availability depends on both share resource state and policy. Enabling from only one signal exposes controls that the server will reject.
- Verify both typed constants/enums and raw wire values before changing a logical condition in this legacy package.

## Test-Case Strategy (module)

Start with the mirrored suite and sibling files in the same test directory. Cover successful derivation/mutation plus invalid capability/input, remote rejection, stale event, and cleanup. Use Sinon, `calledOnceWithExactly`, and fake timers for retry/lock/token/channel timing.

| Behavior / Requirement | Existing test evidence | Gap |
|---|---|---|
| `ANNOTATION-R-001` | `test/unit/spec/annotation/index.ts` | inspect sibling tests for full operation matrix |
| `ANNOTATION-R-002` | `test/unit/spec/annotation/index.ts` | verify rejected and role/capability-change branches |
| `ANNOTATION-R-003` | `test/unit/spec/annotation/index.ts` | verify cleanup on all early exits |

## Traceability

- Repo architecture: [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md) · Registry: [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md)
- Coverage state and contracts baseline: `../../../.sdd/manifest.json`
