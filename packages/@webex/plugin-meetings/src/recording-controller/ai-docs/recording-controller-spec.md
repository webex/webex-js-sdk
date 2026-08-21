<!-- sdd-generated-metadata
doc_kind: module-spec
generated_from: module-spec@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# RECORDING CONTROLLER — SPEC

> Start here → root [`AGENTS.md`](../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md). This is the canonical source-local spec for `src/recording-controller/`.

## Metadata

| Field | Value |
|---|---|
| Module id | `recording-controller` |
| Source path(s) | `src/recording-controller/` |
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
| No routed legacy module spec | overview / API / behavior / tests | none; generated from current recording controller/util/enums and tests |
| Current source and mirrored tests | implementation / tests | verified | requirements, flows, failures, and test strategy below |

## Overview

For orientation, start at `src/recording-controller/index.ts`; supporting files under `src/recording-controller/` separate request, parsing, collection, type, or utility concerns from parent orchestration. The module is composed by `Meeting`, `Meetings`, or the package entry as applicable. Remote Webex services/Locus remain authoritative, and all local state is scoped to the SDK, plugin, meeting, or operation lifetime.

## Purpose / Responsibility

Converts consumer recording actions into validated meeting requests and applies the returned recording state.

## Stack

TypeScript/JavaScript in the Node 22.14 Yarn workspace; Webex core/plugin abstractions and Mocha/Sinon/`@webex/test-helper-chai` tests.

## Folder / Package Structure

```text
src/recording-controller/
├── index.ts — primary behavior/entry point
├── util.ts — supporting request, type, utility, or constant behavior
└── ai-docs/recording-controller-spec.md — canonical module specification
```

## Key Files (source of truth)

| File | Holds |
|---|---|
| `src/recording-controller/index.ts` | Primary lifecycle and module surface |
| `src/recording-controller/util.ts` | Supporting transport, types, constants, or normalization |
| `test/unit/spec/recording-controller/index.js` | Mirrored behavioral tests |

## Public Surface

| Contract ID | Type | Surface | Purpose | Compatibility / deprecation | Schema / detail link | Root index |
|---|---|---|---|---|---|---|
| `recording-controller.1` | SDK / in-process / remote | start, pause, resume, or stop recording | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/recording-controller/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `recording-controller.2` | SDK / in-process / remote | select recording type/action payload | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/recording-controller/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `recording-controller.3` | SDK / in-process / remote | propagate request outcome and refreshed Locus state | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/recording-controller/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |

Compatibility notes:
- Prefer additive fields/options and preserve current rejection/event/cleanup semantics. Internal helpers are not public merely because they are exported within the source directory.

## Requires (dependencies)

Meeting request access, Locus URL/state, recording action/type enums, capability state, and utility validation.

## Requirements

| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| `RECORDING-CONTROLLER-R-001` | start, pause, resume, or stop recording. | Converts consumer recording actions into validated meeting requests and applies the returned recording state. | `src/recording-controller/index.ts` | `test/unit/spec/recording-controller/index.js` | none | PRESENT |
| `RECORDING-CONTROLLER-R-002` | select recording type/action payload. | Consumers need deterministic behavior across meeting and remote updates. | `src/recording-controller/index.ts`, `src/recording-controller/util.ts` | `test/unit/spec/recording-controller/index.js` | inspect sibling tests for operation-specific cases | PRESENT |
| `RECORDING-CONTROLLER-R-003` | Invalid, rejected, or terminal operations preserve the established failure signal and release module-owned transient resources. | Hidden failure or leaked state corrupts later meeting behavior. | `src/recording-controller/index.ts` | `test/unit/spec/recording-controller/index.js` | verify every early exit during focused changes | PRESENT |

## Design Overview

The primary controller/data module owns normalization and observable state while supporting files isolate request, type, constant, collection, or utility concerns. Capability and remote response data are checked before state changes. Async completion emits/returns one established outcome; cleanup handles listeners, timers, locks, channels, or transient requests owned by the module.

## Data Flow

```mermaid
flowchart LR
  Caller[Meeting/Meetings/consumer] --> Entry[src/recording-controller/index.ts]
  Entry --> Support[src/recording-controller/util.ts]
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
| start, pause, resume, or stop recording | Read/derive or initialize | invalid/capability rejection |
| select recording type/action payload | Mutate or react | remote rejection/timeout and cleanup |

```mermaid
sequenceDiagram
  participant C as Caller
  participant M as Recording Controller
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
  class RecordingController
  class SupportingDependency
  class WebexBoundary
  Caller --> RecordingController
  RecordingController --> SupportingDependency
  SupportingDependency --> WebexBoundary
```

The module owns its projection/controller and composes supporting requests, types, constants, collections, or utilities. The Webex boundary remains authoritative.

## Use Cases

- **UC-1 Primary:** the parent/consumer requests start, pause, resume, or stop recording; the module validates or derives data and returns/emits the normalized outcome. Evidence: `src/recording-controller/index.ts`, `test/unit/spec/recording-controller/index.js`.
- **UC-2 Change:** the parent/consumer triggers select recording type/action payload; capability/current state is checked, the dependency is invoked, and accepted state is exposed once. Evidence: `src/recording-controller/index.ts`, `src/recording-controller/util.ts`.

## State Model

The controller references its meeting and derives current recording/capability state; remote recording service/Locus remains authoritative.

## Business Rules & Invariants

- Only supported action/type combinations are sent; recording state changes only from accepted response/Locus data; privileged capability remains enforced. Enforced under `src/recording-controller/`.

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

Exact state values/guards remain in `src/recording-controller/index.ts`; this diagram groups the externally meaningful lifecycle.

## Error Handling & Failure Modes

| Condition | Signal | Caller recovery |
|---|---|---|
| missing capability, identity, URL, or invalid options | validation/established rejection | refresh state or correct input; do not retry unchanged |
| service/channel/request rejection | propagated request or module error | branch on error; retry only through existing bounded policy |
| timeout, role change, or teardown race | rejected/ignored stale result with cleanup | re-read current meeting state and invoke again only if still eligible |

## Pitfalls

- Action names and recording types are separate enums. Conflating them produces a syntactically valid request with the wrong server meaning.
- Verify both typed constants/enums and raw wire values before changing a logical condition in this legacy package.

## Test-Case Strategy (module)

Start with the mirrored suite and sibling files in the same test directory. Cover successful derivation/mutation plus invalid capability/input, remote rejection, stale event, and cleanup. Use Sinon, `calledOnceWithExactly`, and fake timers for retry/lock/token/channel timing.

| Behavior / Requirement | Existing test evidence | Gap |
|---|---|---|
| `RECORDING-CONTROLLER-R-001` | `test/unit/spec/recording-controller/index.js` | inspect sibling tests for full operation matrix |
| `RECORDING-CONTROLLER-R-002` | `test/unit/spec/recording-controller/index.js` | verify rejected and role/capability-change branches |
| `RECORDING-CONTROLLER-R-003` | `test/unit/spec/recording-controller/index.js` | verify cleanup on all early exits |

## Traceability

- Repo architecture: [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md) · Registry: [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md)
- Coverage state and contracts baseline: `../../../.sdd/manifest.json`
