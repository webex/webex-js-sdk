<!-- sdd-generated-metadata
doc_kind: module-spec
generated_from: module-spec@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# MEETINGS — SPEC

> Start here → root [`AGENTS.md`](../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md). This is the canonical source-local spec for `src/meetings/`.

## Metadata

| Field | Value |
|---|---|
| Module id | `meetings` |
| Source path(s) | `src/meetings/` |
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
| Retained package consumer documentation | overview / API / behavior / tests | used and verified; creation, registration, collection, PMR, and event behavior moved into requirements/use cases; examples remain in the retained guide |
| Current source and mirrored tests | implementation / tests | verified | requirements, flows, failures, and test strategy below |

## Overview

For orientation, start at `src/meetings/index.ts`; supporting files under `src/meetings/` separate request, parsing, collection, type, or utility concerns from parent orchestration. The module is composed by `Meeting`, `Meetings`, or the package entry as applicable. Remote Webex services/Locus remain authoritative, and all local state is scoped to the SDK, plugin, meeting, or operation lifetime.

## Purpose / Responsibility

Owns the registered plugin lifecycle, meeting discovery, registration, realtime routing, and the top-level meeting collection.

## Stack

TypeScript/JavaScript in the Node 22.14 Yarn workspace; Webex core/plugin abstractions and Mocha/Sinon/`@webex/test-helper-chai` tests. Build target: `yarn workspace @webex/plugin-meetings build:src`.

## Folder / Package Structure

```text
src/meetings/
├── index.ts — primary behavior/entry point
├── request.ts — request, parser, utility, or supporting behavior
└── ai-docs/meetings-spec.md — canonical module specification
```

## Key Files (source of truth)

| File | Holds |
|---|---|
| `src/meetings/index.ts` | Primary lifecycle and public/internal surface |
| `src/meetings/request.ts` | Supporting transport, parser, or state behavior |
| `test/unit/spec/meetings/index.js` | Mirrored behavioral tests |
| `src/constants.ts` | Shared meeting/event/wire constants where consumed |

## Public Surface

| Contract ID | Type | Surface | Purpose | Compatibility / deprecation | Schema / detail link | Root index |
|---|---|---|---|---|---|---|
| `meetings.1` | SDK / in-process / remote | create/get meeting and collection lookup | Preserve the module responsibility through a focused operation group | Consumer-visible methods/events are semver-sensitive when reachable from package objects | `src/meetings/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `meetings.2` | SDK / in-process / remote | register/unregister device and Mercury lifecycle | Preserve the module responsibility through a focused operation group | Consumer-visible methods/events are semver-sensitive when reachable from package objects | `src/meetings/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `meetings.3` | SDK / in-process / remote | reachability, preferences, PMR, and active-meeting synchronization | Preserve the module responsibility through a focused operation group | Consumer-visible methods/events are semver-sensitive when reachable from package objects | `src/meetings/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |

Compatibility notes:
- Prefer additive options and payload fields. Preserve method/event names, rejection semantics, and cleanup timing; route public changes through `src/index.ts` or the documented owning object.

## Requires (dependencies)

Webex core host, device and Mercury plugins, meeting-info services, Meeting construction, reachability, and metrics.

## Requirements

| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| `MEETINGS-R-001` | create/get meeting and collection lookup. | Owns the registered plugin lifecycle, meeting discovery, registration, realtime routing, and the top-level meeting collection. | `src/meetings/index.ts` | `test/unit/spec/meetings/index.js` | none | PRESENT |
| `MEETINGS-R-002` | register/unregister device and Mercury lifecycle. | Callers need deterministic observable behavior across async Webex inputs. | `src/meetings/index.ts`, `src/meetings/request.ts` | `test/unit/spec/meetings/index.js` | additional edge cases may live in sibling tests | PRESENT |
| `MEETINGS-R-003` | Failures reject/emit the established signal and release module-owned listeners, timers, or transient objects. | Hidden failure or leaked state causes later meeting operations to behave incorrectly. | `src/meetings/index.ts` | `test/unit/spec/meetings/index.js` | verify sibling test files for operation-specific cleanup | PRESENT |
| `MEETINGS-R-004` | Registration executes device, Mercury, reachability/site, and synchronization steps with separately observable status. | A caller must distinguish the failing prerequisite and must not treat partial registration as ready. | `src/meetings/index.ts`, `src/meetings/meetings.types.ts` | `test/unit/spec/meetings/index.js` | none | PRESENT |
| `MEETINGS-R-005` | Mercury/Locus events resolve an existing meeting by supported keys before creating or routing a new object. | Stable meeting identity prevents duplicate Meeting objects and misrouted realtime updates. | `src/meetings/index.ts`, `src/meetings/collection.ts` | `test/unit/spec/meetings/index.js`, `test/unit/spec/meetings/collection.js` | none | PRESENT |
| `MEETINGS-R-006` | Reachability, geo hints, site preferences, PMR, and active-meeting queries delegate to their current request/controller boundaries. | Central plugin access must preserve host credentials, service discovery, and established response/error behavior. | `src/meetings/index.ts`, `src/meetings/request.ts` | `test/unit/spec/meetings/request.js` | none | PRESENT |

## Design Overview

The primary entry point coordinates domain state and delegates transport/parsing to supporting files so those boundaries remain testable. Inputs are normalized before client state or events change. Async results preserve the established error signal, while teardown owns every listener, timer, or transient object allocated by this module.

## Data Flow

```mermaid
flowchart LR
  Caller[Meeting/Meetings/consumer] --> Entry[src/meetings/index.ts]
  Entry --> Support[src/meetings/request.ts]
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
| create/get meeting and collection lookup | Primary operation | validation/service rejection and cleanup branch |
| register/unregister device and Mercury lifecycle | Async update | stale/error input is rejected or ignored according to current code |

```mermaid
sequenceDiagram
  participant C as Caller
  participant M as Meetings
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
  class Meetings
  class SupportingDependency
  class WebexHost
  Caller --> Meetings
  Meetings --> SupportingDependency
  SupportingDependency --> WebexHost
```

The primary module object owns its client state and composes/invokes supporting request, parser, collection, or utility code. The Webex host/service remains the authority for remote state.

## Use Cases

- **UC-1 Primary operation:** a consumer or parent module invokes create/get meeting and collection lookup; the module validates/delegates, normalizes the result, updates state where applicable, and returns or emits the established outcome. Evidence: `src/meetings/index.ts`, `test/unit/spec/meetings/index.js`.
- **UC-2 Async/change operation:** the parent or remote input triggers register/unregister device and Mercury lifecycle; the module reconciles it with current state and exposes one scoped result. Evidence: `src/meetings/index.ts`, `src/meetings/request.ts`.

## State Model

Registration progress, meeting collection entries, sync state, and listener handles are held in memory for the plugin lifetime.

## Business Rules & Invariants

- A realtime event is routed to its corresponding meeting before a new meeting is created; unregister removes host listeners and registration state. Enforced by `src/meetings/index.ts` and supporting code under `src/meetings/`.

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

State labels summarize the module lifecycle; exact guards and values remain in `src/meetings/index.ts`.

## Error Handling & Failure Modes

| Condition | Signal | Caller recovery |
|---|---|---|
| invalid options or unsupported state | established validation/error rejection | correct input/state; do not retry unchanged |
| Webex/service/media rejection | propagated typed/request/media error | branch on the established error; retry only where module policy is bounded |
| timeout, stale update, or teardown race | timeout/rejection/ignored stale update per current path | re-read current meeting state; allow cleanup/recovery manager to finish |

## Pitfalls

- Registration is multi-step. Treating device registration, Mercury setup, and active-meeting sync as one opaque call loses the failing stage and can leak listeners.
- Public behavior may be reachable through a parent `Meeting`/`Meetings` object even when the source helper is not exported directly.

## Host Integration & Theming

The Webex SDK host supplies initialized request/device/Mercury/media capabilities and exposes this behavior through `webex.meetings` or its Meeting objects. The module renders no UI and has no theme contract.

## Key Design Trade-off

- Central coordination favors consistent event routing and one meeting collection at the cost of a large orchestrator; feature behavior stays in child modules.

## Test-Case Strategy (module)

Use the mirrored suite as the first characterization boundary. Cover each public operation with a successful result/state/event and a rejected/invalid branch; use fake timers for timeout/retry logic; assert listener/resource cleanup for async modules; keep request/parser fixtures representative without secrets.

| Behavior / Requirement | Existing test evidence | Gap |
|---|---|---|
| `MEETINGS-R-001` | `test/unit/spec/meetings/index.js` | confirm sibling operation tests during focused changes |
| `MEETINGS-R-002` | `test/unit/spec/meetings/index.js` | verify out-of-order/rejection edge where applicable |
| `MEETINGS-R-003` | `test/unit/spec/meetings/index.js` | verify cleanup on every early-exit path |
| `MEETINGS-R-004` | `test/unit/spec/meetings/index.js` | verify each registration-step rejection |
| `MEETINGS-R-005` | `test/unit/spec/meetings/index.js`, `test/unit/spec/meetings/collection.js` | verify alternate-key collision cases |
| `MEETINGS-R-006` | `test/unit/spec/meetings/request.js` | none |

## Traceability

- Repo architecture: [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md) · Registry: [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md)
- Coverage state and contracts baseline: `../../../.sdd/manifest.json`
