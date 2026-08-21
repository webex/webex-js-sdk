<!-- sdd-generated-metadata
doc_kind: module-spec
generated_from: module-spec@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# REACHABILITY — SPEC

> Start here → root [`AGENTS.md`](../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md). This is the canonical source-local spec for `src/reachability/`.

## Metadata

| Field | Value |
|---|---|
| Module id | `reachability` |
| Source path(s) | `src/reachability/` |
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
| No routed legacy module spec | overview / API / behavior / tests | none; generated from current cluster/probe/request code and tests |
| Current source and mirrored tests | implementation / tests | verified | requirements, flows, failures, and test strategy below |

## Overview

For orientation, start at `src/reachability/index.ts`; supporting files under `src/reachability/` separate request, parsing, collection, type, or utility concerns from parent orchestration. The module is composed by `Meeting`, `Meetings`, or the package entry as applicable. Remote Webex services/Locus remain authoritative, and all local state is scoped to the SDK, plugin, meeting, or operation lifetime.

## Purpose / Responsibility

Discovers media clusters, probes protocol reachability with peer connections, determines NAT characteristics, and reports results.

## Stack

TypeScript/JavaScript in the Node 22.14 Yarn workspace; Webex core/plugin abstractions and Mocha/Sinon/`@webex/test-helper-chai` tests. Build target: `yarn workspace @webex/plugin-meetings build:src`.

## Folder / Package Structure

```text
src/reachability/
├── index.ts — primary behavior/entry point
├── clusterReachability.ts — request, parser, utility, or supporting behavior
└── ai-docs/reachability-spec.md — canonical module specification
```

## Key Files (source of truth)

| File | Holds |
|---|---|
| `src/reachability/index.ts` | Primary lifecycle and public/internal surface |
| `src/reachability/clusterReachability.ts` | Supporting transport, parser, or state behavior |
| `test/unit/spec/reachability/index.ts` | Mirrored behavioral tests |
| `src/constants.ts` | Shared meeting/event/wire constants where consumed |

## Public Surface

| Contract ID | Type | Surface | Purpose | Compatibility / deprecation | Schema / detail link | Root index |
|---|---|---|---|---|---|---|
| `reachability.1` | SDK / in-process / remote | fetch and normalize candidate clusters | Preserve the module responsibility through a focused operation group | Consumer-visible methods/events are semver-sensitive when reachable from package objects | `src/reachability/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `reachability.2` | SDK / in-process / remote | run UDP/TCP/TLS reachability probes | Preserve the module responsibility through a focused operation group | Consumer-visible methods/events are semver-sensitive when reachable from package objects | `src/reachability/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `reachability.3` | SDK / in-process / remote | return/report reachability and NAT results | Preserve the module responsibility through a focused operation group | Consumer-visible methods/events are semver-sensitive when reachable from package objects | `src/reachability/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |

Compatibility notes:
- Prefer additive options and payload fields. Preserve method/event names, rejection semantics, and cleanup timing; route public changes through `src/index.ts` or the documented owning object.

## Requires (dependencies)

Webex reachability services, browser RTCPeerConnection, STUN/TURN candidates, timers, and metrics/request access.

## Requirements

| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| `REACHABILITY-R-001` | fetch and normalize candidate clusters. | Discovers media clusters, probes protocol reachability with peer connections, determines NAT characteristics, and reports results. | `src/reachability/index.ts` | `test/unit/spec/reachability/index.ts` | none | PRESENT |
| `REACHABILITY-R-002` | run UDP/TCP/TLS reachability probes. | Callers need deterministic observable behavior across async Webex inputs. | `src/reachability/index.ts`, `src/reachability/clusterReachability.ts` | `test/unit/spec/reachability/index.ts` | additional edge cases may live in sibling tests | PRESENT |
| `REACHABILITY-R-003` | Failures reject/emit the established signal and release module-owned listeners, timers, or transient objects. | Hidden failure or leaked state causes later meeting operations to behave incorrectly. | `src/reachability/index.ts` | `test/unit/spec/reachability/index.ts` | verify sibling test files for operation-specific cleanup | PRESENT |
| `REACHABILITY-R-004` | Each cluster/protocol probe settles once, closes its peer connection/timer, and contributes an explicit reachable/unreachable result. | ICE events and timeouts race; deterministic cleanup and aggregation prevent false success and leaks. | `src/reachability/clusterReachability.ts`, `src/reachability/reachabilityPeerConnection.ts` | `test/unit/spec/reachability/clusterReachability.ts` | none | PRESENT |
| `REACHABILITY-R-005` | The aggregate report preserves IP version, NAT/protocol/cluster outcomes, previous-report context, and trigger. | The backend and media selection need comparable current results rather than a single boolean. | `src/reachability/index.ts`, `src/reachability/reachability.types.ts`, `src/reachability/request.ts` | `test/unit/spec/reachability/index.ts`, `test/unit/spec/reachability/request.js` | none | PRESENT |

## Design Overview

The primary entry point coordinates domain state and delegates transport/parsing to supporting files so those boundaries remain testable. Inputs are normalized before client state or events change. Async results preserve the established error signal, while teardown owns every listener, timer, or transient object allocated by this module.

## Data Flow

```mermaid
flowchart LR
  Caller[Meeting/Meetings/consumer] --> Entry[src/reachability/index.ts]
  Entry --> Support[src/reachability/clusterReachability.ts]
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
| fetch and normalize candidate clusters | Primary operation | validation/service rejection and cleanup branch |
| run UDP/TCP/TLS reachability probes | Async update | stale/error input is rejected or ignored according to current code |

```mermaid
sequenceDiagram
  participant C as Caller
  participant M as Reachability
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
  class Reachability
  class SupportingDependency
  class WebexHost
  Caller --> Reachability
  Reachability --> SupportingDependency
  SupportingDependency --> WebexHost
```

The primary module object owns its client state and composes/invokes supporting request, parser, collection, or utility code. The Webex host/service remains the authority for remote state.

## Use Cases

- **UC-1 Primary operation:** a consumer or parent module invokes fetch and normalize candidate clusters; the module validates/delegates, normalizes the result, updates state where applicable, and returns or emits the established outcome. Evidence: `src/reachability/index.ts`, `test/unit/spec/reachability/index.ts`.
- **UC-2 Async/change operation:** the parent or remote input triggers run UDP/TCP/TLS reachability probes; the module reconciles it with current state and exposes one scoped result. Evidence: `src/reachability/index.ts`, `src/reachability/clusterReachability.ts`.

## State Model

Cluster/protocol probe state, peer connections, timers, partial results, and cached report data exist for one reachability run.

## Business Rules & Invariants

- Each probe settles once and closes its peer connection/timer; unsupported or failed protocols are reported rather than inferred reachable. Enforced by `src/reachability/index.ts` and supporting code under `src/reachability/`.

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

State labels summarize the module lifecycle; exact guards and values remain in `src/reachability/index.ts`.

## Protocol / Wire Format

- External payloads are parsed/serialized by files under `src/reachability/` and existing Webex/media dependencies. Preserve current field names, enum/raw values, sequence identifiers, and compatibility behavior; do not treat the normalized client model as the wire schema.

## Error Handling & Failure Modes

| Condition | Signal | Caller recovery |
|---|---|---|
| invalid options or unsupported state | established validation/error rejection | correct input/state; do not retry unchanged |
| Webex/service/media rejection | propagated typed/request/media error | branch on the established error; retry only where module policy is bounded |
| timeout, stale update, or teardown race | timeout/rejection/ignored stale update per current path | re-read current meeting state; allow cleanup/recovery manager to finish |

## Pitfalls

- Browser ICE callbacks and timeout can race. Cleanup must be idempotent and partial results must not be presented as a complete success.
- Public behavior may be reachable through a parent `Meeting`/`Meetings` object even when the source helper is not exported directly.

## Key Design Trade-off

- Parallel probes reduce startup time but require per-probe isolation and deterministic aggregation.

## Test-Case Strategy (module)

Use the mirrored suite as the first characterization boundary. Cover each public operation with a successful result/state/event and a rejected/invalid branch; use fake timers for timeout/retry logic; assert listener/resource cleanup for async modules; keep request/parser fixtures representative without secrets.

| Behavior / Requirement | Existing test evidence | Gap |
|---|---|---|
| `REACHABILITY-R-001` | `test/unit/spec/reachability/index.ts` | confirm sibling operation tests during focused changes |
| `REACHABILITY-R-002` | `test/unit/spec/reachability/index.ts` | verify out-of-order/rejection edge where applicable |
| `REACHABILITY-R-003` | `test/unit/spec/reachability/index.ts` | verify cleanup on every early-exit path |
| `REACHABILITY-R-004` | `test/unit/spec/reachability/clusterReachability.ts` | verify callback/timeout races |
| `REACHABILITY-R-005` | `test/unit/spec/reachability/index.ts`, `test/unit/spec/reachability/request.js` | verify partial/mixed protocol reports |

## Traceability

- Repo architecture: [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md) · Registry: [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md)
- Coverage state and contracts baseline: `../../../.sdd/manifest.json`
