<!-- sdd-generated-metadata
doc_kind: module-spec
generated_from: module-spec@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# MULTISTREAM — SPEC

> Start here → root [`AGENTS.md`](../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md). This is the canonical source-local spec for `src/multistream/`.

## Metadata

| Field | Value |
|---|---|
| Module id | `multistream` |
| Source path(s) | `src/multistream/` |
| Parent spec | — |
| Doc kind | Module spec |
| Coverage score | 93% assessed 2026-08-18; 13/14 mandatory fields present; all critical fields present, one noncritical detail gap remains |
| Generated from | `module-spec` @ SDLC template library `0.2.2` |
| generated_by / approved_by / updated_at | codex / repository user / 2026-08-18T15:33:39Z |
| Validation status | not-run |

## Evidence Rules

Requirements cite current implementation and mirrored unit-test paths. Current code wins over retained prose when they conflict; commit and PR history are excluded by repository-owner decision. Missing test evidence is stated as a gap rather than inferred.

## Source Material Register

| Source material | Scope | Decision | Detail location or disposition |
|---|---|---|---|
| No routed legacy module spec | overview / API / behavior / tests | none; generated from current slot/remote-media managers and tests |
| Current source and mirrored tests | implementation / tests | verified | requirements, flows, failures, and test strategy below |

## Overview

For orientation, start at `src/multistream/remoteMediaManager.ts`; supporting files under `src/multistream/` separate request, parsing, collection, type, or utility concerns from parent orchestration. The module is composed by `Meeting`, `Meetings`, or the package entry as applicable. Remote Webex services/Locus remain authoritative, and all local state is scoped to the SDK, plugin, meeting, or operation lifetime.

## Purpose / Responsibility

Maps multistream media-core slots to stable remote-media objects/groups and arbitrates send/receive requests.

## Stack

TypeScript/JavaScript in the Node 22.14 Yarn workspace; Webex core/plugin abstractions and Mocha/Sinon/`@webex/test-helper-chai` tests. Build target: `yarn workspace @webex/plugin-meetings build:src`.

## Folder / Package Structure

```text
src/multistream/
├── remoteMediaManager.ts — primary behavior/entry point
├── receiveSlotManager.ts — request, parser, utility, or supporting behavior
└── ai-docs/multistream-spec.md — canonical module specification
```

## Key Files (source of truth)

| File | Holds |
|---|---|
| `src/multistream/remoteMediaManager.ts` | Primary lifecycle and public/internal surface |
| `src/multistream/receiveSlotManager.ts` | Supporting transport, parser, or state behavior |
| `test/unit/spec/multistream/remoteMediaManager.ts` | Mirrored behavioral tests |
| `src/constants.ts` | Shared meeting/event/wire constants where consumed |

## Public Surface

| Contract ID | Type | Surface | Purpose | Compatibility / deprecation | Schema / detail link | Root index |
|---|---|---|---|---|---|---|
| `multistream.1` | SDK / in-process / remote | manage receive slots and remote-media groups | Preserve the module responsibility through a focused operation group | Consumer-visible methods/events are semver-sensitive when reachable from package objects | `src/multistream/remoteMediaManager.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `multistream.2` | SDK / in-process / remote | map member/CSI/layout requests to media-core | Preserve the module responsibility through a focused operation group | Consumer-visible methods/events are semver-sensitive when reachable from package objects | `src/multistream/remoteMediaManager.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `multistream.3` | SDK / in-process / remote | manage send slots and media request ordering | Preserve the module responsibility through a focused operation group | Consumer-visible methods/events are semver-sensitive when reachable from package objects | `src/multistream/remoteMediaManager.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |

Compatibility notes:
- Prefer additive options and payload fields. Preserve method/event names, rejection semantics, and cleanup timing; route public changes through `src/index.ts` or the documented owning object.

## Requires (dependencies)

internal-media-core multistream connection, member CSI data, codecs, event callbacks, and Meeting media state.

## Requirements

| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| `MULTISTREAM-R-001` | manage receive slots and remote-media groups. | Maps multistream media-core slots to stable remote-media objects/groups and arbitrates send/receive requests. | `src/multistream/remoteMediaManager.ts` | `test/unit/spec/multistream/remoteMediaManager.ts` | none | PRESENT |
| `MULTISTREAM-R-002` | map member/CSI/layout requests to media-core. | Callers need deterministic observable behavior across async Webex inputs. | `src/multistream/remoteMediaManager.ts`, `src/multistream/receiveSlotManager.ts` | `test/unit/spec/multistream/remoteMediaManager.ts` | additional edge cases may live in sibling tests | PRESENT |
| `MULTISTREAM-R-003` | Failures reject/emit the established signal and release module-owned listeners, timers, or transient objects. | Hidden failure or leaked state causes later meeting operations to behave incorrectly. | `src/multistream/remoteMediaManager.ts` | `test/unit/spec/multistream/remoteMediaManager.ts` | verify sibling test files for operation-specific cleanup | PRESENT |
| `MULTISTREAM-R-004` | RemoteMedia identity remains stable while tracks/receive slots and member CSI mappings change. | Consumers keep references to remote media across layout and transport updates. | `src/multistream/remoteMedia.ts`, `src/multistream/remoteMediaManager.ts` | `test/unit/spec/multistream/remoteMedia.ts`, `test/unit/spec/multistream/remoteMediaManager.ts` | none | PRESENT |
| `MULTISTREAM-R-005` | Receive-slot allocation/release maintains one active mapping and detaches old listeners/tracks. | Slot reuse must not deliver another participant's media through a stale object. | `src/multistream/receiveSlot.ts`, `src/multistream/receiveSlotManager.ts` | `test/unit/spec/multistream/receiveSlot.ts`, `test/unit/spec/multistream/receiveSlotManager.ts` | none | PRESENT |
| `MULTISTREAM-R-006` | Media request arbitration and send-slot management preserve the latest supported layout/send intent. | Concurrent layout/member changes should not apply obsolete stream requests. | `src/multistream/mediaRequestManager.ts`, `src/multistream/sendSlotManager.ts` | `test/unit/spec/multistream/mediaRequestManager.ts`, `test/unit/spec/multistream/sendSlotManager.ts` | none | PRESENT |

## Design Overview

The primary entry point coordinates domain state and delegates transport/parsing to supporting files so those boundaries remain testable. Inputs are normalized before client state or events change. Async results preserve the established error signal, while teardown owns every listener, timer, or transient object allocated by this module.

## Data Flow

```mermaid
flowchart LR
  Caller[Meeting/Meetings/consumer] --> Entry[src/multistream/remoteMediaManager.ts]
  Entry --> Support[src/multistream/receiveSlotManager.ts]
  Support --> Remote[Webex host/service/event input]
  Remote --> Normalize[validate and normalize]
  Normalize --> State[in-memory module state]
  State --> Output[result / scoped event / callback]
  Remote -. failure .-> Error[reject or established error event]
  Error --> Cleanup[release transient resources]
```

## Sequence Diagram(s)

Sequence coverage:

The operation groups below share the same caller → module → supporting dependency → Webex/input ordering and the same rejection/cleanup contract, so one combined diagram covers their common sequence; operation-specific state and guards are stated in the requirements and use cases.

| Operation group | Diagram | Failure / recovery coverage |
|---|---|---|
| manage receive slots and remote-media groups | Primary operation | validation/service rejection and cleanup branch |
| map member/CSI/layout requests to media-core | Async update | stale/error input is rejected or ignored according to current code |

```mermaid
sequenceDiagram
  participant C as Caller
  participant M as Multistream
  participant D as Supporting dependency
  participant W as Webex/input source
  C->>M: invoke operation
  M->>D: validate/prepare
  D->>W: request or consume event
  alt accepted response/update
    W-->>D: payload
    D-->>M: normalized result
    M-->>C: result or scoped event
  else rejected, timeout, or invalid input
    W--xD: error/invalid payload
    D--xM: established failure
    M->>M: cleanup transient state
    M--xC: rejection/error event
  end
```

## Class / Component Relationships

```mermaid
classDiagram
  class Caller
  class Multistream
  class SupportingDependency
  class WebexHost
  Caller --> Multistream
  Multistream --> SupportingDependency
  SupportingDependency --> WebexHost
```

The primary module object owns its client state and composes/invokes supporting request, parser, collection, or utility code. The Webex host/service remains the authority for remote state.

## Use Cases

- **UC-1 Primary operation:** a consumer or parent module invokes manage receive slots and remote-media groups; the module validates/delegates, normalizes the result, updates state where applicable, and returns or emits the established outcome. Evidence: `src/multistream/remoteMediaManager.ts`, `test/unit/spec/multistream/remoteMediaManager.ts`.
- **UC-2 Async/change operation:** the parent or remote input triggers map member/CSI/layout requests to media-core; the module reconciles it with current state and exposes one scoped result. Evidence: `src/multistream/remoteMediaManager.ts`, `src/multistream/receiveSlotManager.ts`.

## State Model

Receive/send slots, remote-media objects/groups, requested layouts, CSI mappings, and pending media requests live for the connection lifetime.

## Business Rules & Invariants

- A slot has one active owner/mapping; released slots detach tracks/listeners; request arbitration preserves the latest supported layout intent. Enforced by `src/multistream/remoteMediaManager.ts` and supporting code under `src/multistream/`.

## Concurrency & Reactive Flow

- Promise, event, media, and timer callbacks can interleave. Preserve existing sequence guards, make cleanup idempotent, and never start an unbounded retry/listener loop.
- Do not assume remote events are globally ordered unless the current parser/state code enforces ordering.

## State Machine

```mermaid
stateDiagram-v2
  [*] --> Idle
  Idle --> Active: initialize or accepted operation
  Active --> Active: valid update
  Active --> Recovering: transient failure where supported
  Recovering --> Active: recovery succeeds
  Recovering --> Failed: retry/guard exhausted
  Active --> Closed: cleanup or parent teardown
  Failed --> Closed: cleanup
  Closed --> [*]
```

State labels summarize the module lifecycle; exact guards and values remain in `src/multistream/remoteMediaManager.ts`.

## Protocol / Wire Format

- External payloads are parsed/serialized by files under `src/multistream/` and existing Webex/media dependencies. Preserve current field names, enum/raw values, sequence identifiers, and compatibility behavior; do not treat the normalized client model as the wire schema.

## Error Handling & Failure Modes

| Condition | Signal | Caller recovery |
|---|---|---|
| invalid options or unsupported state | established validation/error rejection | correct input/state; do not retry unchanged |
| Webex/service/media rejection | propagated typed/request/media error | branch on the established error; retry only where module policy is bounded |
| timeout, stale update, or teardown race | timeout/rejection/ignored stale update per current path | re-read current meeting state; allow cleanup/recovery manager to finish |

## Pitfalls

- Remote-media identity is not the same as a transient track or slot. Recreating objects on every update breaks consumer references.
- Public behavior may be reachable through a parent `Meeting`/`Meetings` object even when the source helper is not exported directly.

## Key Design Trade-off

- Stable remote-media objects are favored over exposing raw media-core slots, requiring explicit mapping and lifecycle management.

## Test-Case Strategy (module)

Use the mirrored suite as the first characterization boundary. Cover each public operation with a successful result/state/event and a rejected/invalid branch; use fake timers for timeout/retry logic; assert listener/resource cleanup for async modules; keep request/parser fixtures representative without secrets.

| Behavior / Requirement | Existing test evidence | Gap |
|---|---|---|
| `MULTISTREAM-R-001` | `test/unit/spec/multistream/remoteMediaManager.ts` | confirm sibling operation tests during focused changes |
| `MULTISTREAM-R-002` | `test/unit/spec/multistream/remoteMediaManager.ts` | verify out-of-order/rejection edge where applicable |
| `MULTISTREAM-R-003` | `test/unit/spec/multistream/remoteMediaManager.ts` | verify cleanup on every early-exit path |
| `MULTISTREAM-R-004` | `test/unit/spec/multistream/remoteMedia.ts`, `test/unit/spec/multistream/remoteMediaManager.ts` | none |
| `MULTISTREAM-R-005` | `test/unit/spec/multistream/receiveSlot.ts`, `test/unit/spec/multistream/receiveSlotManager.ts` | verify rapid slot reuse |
| `MULTISTREAM-R-006` | `test/unit/spec/multistream/mediaRequestManager.ts`, `test/unit/spec/multistream/sendSlotManager.ts` | verify stale request suppression |

## Traceability

- Repo architecture: [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md) · Registry: [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md)
- Coverage state and contracts baseline: `../../../.sdd/manifest.json`
