<!-- sdd-generated-metadata
doc_kind: module-spec
generated_from: module-spec@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# RECONNECTION MANAGER — SPEC

> Start here → root [`AGENTS.md`](../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md). This is the canonical source-local spec for `src/reconnection-manager/`.

## Metadata

| Field | Value |
|---|---|
| Module id | `reconnection-manager` |
| Source path(s) | `src/reconnection-manager/` |
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
| No routed legacy module spec | overview / API / behavior / tests | none; generated from current recovery state machine and tests |
| Current source and mirrored tests | implementation / tests | verified | requirements, flows, failures, and test strategy below |

## Overview

For orientation, start at `src/reconnection-manager/index.ts`; supporting files under `src/reconnection-manager/` separate request, parsing, collection, type, or utility concerns from parent orchestration. The module is composed by `Meeting`, `Meetings`, or the package entry as applicable. Remote Webex services/Locus remain authoritative, and all local state is scoped to the SDK, plugin, meeting, or operation lifetime.

## Purpose / Responsibility

Coordinates bounded network/media recovery, escalating from reconnecting media to rejoining the meeting when required.

## Stack

TypeScript/JavaScript in the Node 22.14 Yarn workspace; Webex core/plugin abstractions and Mocha/Sinon/`@webex/test-helper-chai` tests. Build target: `yarn workspace @webex/plugin-meetings build:src`.

## Folder / Package Structure

```text
src/reconnection-manager/
├── index.ts — primary behavior/entry point
├── index.ts — request, parser, utility, or supporting behavior
└── ai-docs/reconnection-manager-spec.md — canonical module specification
```

## Key Files (source of truth)

| File | Holds |
|---|---|
| `src/reconnection-manager/index.ts` | Primary lifecycle and public/internal surface |
| `src/reconnection-manager/index.ts` | Supporting transport, parser, or state behavior |
| `test/unit/spec/reconnection-manager/index.js` | Mirrored behavioral tests |
| `src/constants.ts` | Shared meeting/event/wire constants where consumed |

## Public Surface

| Contract ID | Type | Surface | Purpose | Compatibility / deprecation | Schema / detail link | Root index |
|---|---|---|---|---|---|---|
| `reconnection-manager.1` | SDK / in-process | start/reset/inspect reconnection state | Preserve the module responsibility through a focused operation group | Consumer-visible methods/events are semver-sensitive when reachable from package objects | `src/reconnection-manager/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `reconnection-manager.2` | SDK / in-process | retry media reconnection with timers | Preserve the module responsibility through a focused operation group | Consumer-visible methods/events are semver-sensitive when reachable from package objects | `src/reconnection-manager/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `reconnection-manager.3` | SDK / in-process | rejoin the meeting and restore sharing when escalation is required | Preserve the module responsibility through a focused operation group | Consumer-visible methods/events are semver-sensitive when reachable from package objects | `src/reconnection-manager/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |

Compatibility notes:
- Prefer additive options and payload fields. Preserve method/event names, rejection semantics, and cleanup timing; route public changes through `src/index.ts` or the documented owning object.

## Requires (dependencies)

Meeting lifecycle/media methods, network state callbacks, timers, retry configuration, logging, events, and metrics.

## Requirements

| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| `RECONNECTION-MANAGER-R-001` | start/reset/inspect reconnection state. | Coordinates bounded network/media recovery, escalating from reconnecting media to rejoining the meeting when required. | `src/reconnection-manager/index.ts` | `test/unit/spec/reconnection-manager/index.js` | none | PRESENT |
| `RECONNECTION-MANAGER-R-002` | retry media reconnection with timers. | Callers need deterministic observable behavior across async Webex inputs. | `src/reconnection-manager/index.ts`, `src/reconnection-manager/index.ts` | `test/unit/spec/reconnection-manager/index.js` | additional edge cases may live in sibling tests | PRESENT |
| `RECONNECTION-MANAGER-R-003` | Failures reject/emit the established signal and release module-owned listeners, timers, or transient objects. | Hidden failure or leaked state causes later meeting operations to behave incorrectly. | `src/reconnection-manager/index.ts` | `test/unit/spec/reconnection-manager/index.js` | verify sibling test files for operation-specific cleanup | PRESENT |
| `RECONNECTION-MANAGER-R-004` | At most one reconnection run is active; attempt counters/timers are bounded and reset on success or terminal failure. | Concurrent network/media callbacks must not launch duplicate media negotiations or meeting joins. | `src/reconnection-manager/index.ts` | `test/unit/spec/reconnection-manager/index.js` | none | PRESENT |
| `RECONNECTION-MANAGER-R-005` | Recovery first reconnects media where allowed, then escalates to meeting rejoin and restores prior sharing only after successful rejoin. | The least disruptive recovery should run first while preserving supported user intent after escalation. | `src/reconnection-manager/index.ts` | `test/unit/spec/reconnection-manager/index.js` | none | PRESENT |

## Design Overview

The primary entry point coordinates domain state and delegates transport/parsing to supporting files so those boundaries remain testable. Inputs are normalized before client state or events change. Async results preserve the established error signal, while teardown owns every listener, timer, or transient object allocated by this module.

## Data Flow

```mermaid
flowchart LR
  Caller[Meeting/Meetings/consumer] --> Entry[src/reconnection-manager/index.ts]
  Entry --> Support[src/reconnection-manager/index.ts]
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
| start/reset/inspect reconnection state | Primary operation | validation/service rejection and cleanup branch |
| retry media reconnection with timers | Async update | stale/error input is rejected or ignored according to current code |

```mermaid
sequenceDiagram
  participant C as Caller
  participant M as Reconnection Manager
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
  class ReconnectionManager
  class SupportingDependency
  class WebexHost
  Caller --> ReconnectionManager
  ReconnectionManager --> SupportingDependency
  SupportingDependency --> WebexHost
```

The primary module object owns its client state and composes/invokes supporting request, parser, collection, or utility code. The Webex host/service remains the authority for remote state.

## Use Cases

- **UC-1 Primary operation:** a consumer or parent module invokes start/reset/inspect reconnection state; the module validates/delegates, normalizes the result, updates state where applicable, and returns or emits the established outcome. Evidence: `src/reconnection-manager/index.ts`, `test/unit/spec/reconnection-manager/index.js`.
- **UC-2 Async/change operation:** the parent or remote input triggers retry media reconnection with timers; the module reconciles it with current state and exposes one scoped result. Evidence: `src/reconnection-manager/index.ts`, `src/reconnection-manager/index.ts`.

## State Model

Reconnection status, attempt counters, timers, in-flight promise, sharing intent, and last recovery mode are meeting scoped.

## Business Rules & Invariants

- Only one recovery run is active; retries are bounded; success and terminal failure clear timers/state; rejoin restores only supported prior intent. Enforced by `src/reconnection-manager/index.ts` and supporting code under `src/reconnection-manager/`.

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

State labels summarize the module lifecycle; exact guards and values remain in `src/reconnection-manager/index.ts`.

## Error Handling & Failure Modes

| Condition | Signal | Caller recovery |
|---|---|---|
| invalid options or unsupported state | established validation/error rejection | correct input/state; do not retry unchanged |
| Webex/service/media rejection | propagated typed/request/media error | branch on the established error; retry only where module policy is bounded |
| timeout, stale update, or teardown race | timeout/rejection/ignored stale update per current path | re-read current meeting state; allow cleanup/recovery manager to finish |

## Pitfalls

- Network and media events can request recovery concurrently. Starting a second timer/promise produces duplicate joins and stale completion callbacks.
- Public behavior may be reachable through a parent `Meeting`/`Meetings` object even when the source helper is not exported directly.

## Key Design Trade-off

- Escalating recovery favors continuity over immediate failure, with bounded delay and more lifecycle complexity.

## Test-Case Strategy (module)

Use the mirrored suite as the first characterization boundary. Cover each public operation with a successful result/state/event and a rejected/invalid branch; use fake timers for timeout/retry logic; assert listener/resource cleanup for async modules; keep request/parser fixtures representative without secrets.

| Behavior / Requirement | Existing test evidence | Gap |
|---|---|---|
| `RECONNECTION-MANAGER-R-001` | `test/unit/spec/reconnection-manager/index.js` | confirm sibling operation tests during focused changes |
| `RECONNECTION-MANAGER-R-002` | `test/unit/spec/reconnection-manager/index.js` | verify out-of-order/rejection edge where applicable |
| `RECONNECTION-MANAGER-R-003` | `test/unit/spec/reconnection-manager/index.js` | verify cleanup on every early-exit path |
| `RECONNECTION-MANAGER-R-004` | `test/unit/spec/reconnection-manager/index.js` | verify concurrent triggers and exhausted retries |
| `RECONNECTION-MANAGER-R-005` | `test/unit/spec/reconnection-manager/index.js` | verify sharing restoration only after rejoin |

## Traceability

- Repo architecture: [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md) · Registry: [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md)
- Coverage state and contracts baseline: `../../../.sdd/manifest.json`
