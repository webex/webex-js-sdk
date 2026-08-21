<!-- sdd-generated-metadata
doc_kind: module-spec
generated_from: module-spec@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-18T15:33:39Z
validation_status: not-run
-->
# INTERPRETATION — SPEC

> Start here → root [`AGENTS.md`](../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md). This is the canonical source-local spec for `src/interpretation/`.

## Metadata

| Field | Value |
|---|---|
| Module id | `interpretation` |
| Source path(s) | `src/interpretation/` |
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
| Retained simultaneous-interpretation guide | overview / API / behavior / tests | used and verified; attendee, host, interpreter, language, and handoff flows were placed into requirements, state, use cases, and failures |
| Current source and mirrored tests | implementation / tests | verified | requirements, flows, failures, and test strategy below |

## Overview

For orientation, start at `src/interpretation/index.ts`; supporting files under `src/interpretation/` separate request, parsing, collection, type, or utility concerns from parent orchestration. The module is composed by `Meeting`, `Meetings`, or the package entry as applicable. Remote Webex services/Locus remain authoritative, and all local state is scoped to the SDK, plugin, meeting, or operation lifetime.

## Purpose / Responsibility

Owns simultaneous-interpretation language state, interpreter collections, direction changes, and interpreter handoff request/approval workflows.

## Stack

TypeScript/JavaScript in the Node 22.14 Yarn workspace; Webex core/plugin abstractions and Mocha/Sinon/`@webex/test-helper-chai` tests.

## Folder / Package Structure

```text
src/interpretation/
├── index.ts — primary behavior/entry point
├── siLanguage.ts — supporting request, type, utility, or constant behavior
└── ai-docs/interpretation-spec.md — canonical module specification
```

## Key Files (source of truth)

| File | Holds |
|---|---|
| `src/interpretation/index.ts` | Primary lifecycle and module surface |
| `src/interpretation/siLanguage.ts` | Supporting transport, types, constants, or normalization |
| `test/unit/spec/interpretation/index.ts` | Mirrored behavioral tests |

## Public Surface

| Contract ID | Type | Surface | Purpose | Compatibility / deprecation | Schema / detail link | Root index |
|---|---|---|---|---|---|---|
| `interpretation.1` | SDK / in-process / remote | query supported languages and expose interpretation state | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/interpretation/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `interpretation.2` | SDK / in-process / remote | change attendee/interpreter language direction | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/interpretation/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `interpretation.3` | SDK / in-process / remote | request, accept, decline, and apply interpreter handoffs | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/interpretation/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |

Compatibility notes:
- Prefer additive fields/options and preserve current rejection/event/cleanup semantics. Internal helpers are not public merely because they are exported within the source directory.

## Requires (dependencies)

Parent Meeting/Locus state, approval URL, interpretation collections/types, member/self identity, request access, and scoped events.

## Requirements

| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| `INTERPRETATION-R-001` | query supported languages and expose interpretation state. | Owns simultaneous-interpretation language state, interpreter collections, direction changes, and interpreter handoff request/approval workflows. | `src/interpretation/index.ts` | `test/unit/spec/interpretation/index.ts` | none | PRESENT |
| `INTERPRETATION-R-002` | change attendee/interpreter language direction. | Consumers need deterministic behavior across meeting and remote updates. | `src/interpretation/index.ts`, `src/interpretation/siLanguage.ts` | `test/unit/spec/interpretation/index.ts` | inspect sibling tests for operation-specific cases | PRESENT |
| `INTERPRETATION-R-003` | Invalid, rejected, or terminal operations preserve the established failure signal and release module-owned transient resources. | Hidden failure or leaked state corrupts later meeting behavior. | `src/interpretation/index.ts` | `test/unit/spec/interpretation/index.ts` | verify every early exit during focused changes | PRESENT |

## Design Overview

The primary controller/data module owns normalization and observable state while supporting files isolate request, type, constant, collection, or utility concerns. Capability and remote response data are checked before state changes. Async completion emits/returns one established outcome; cleanup handles listeners, timers, locks, channels, or transient requests owned by the module.

## Data Flow

```mermaid
flowchart LR
  Caller[Meeting/Meetings/consumer] --> Entry[src/interpretation/index.ts]
  Entry --> Support[src/interpretation/siLanguage.ts]
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
| query supported languages and expose interpretation state | Read/derive or initialize | invalid/capability rejection |
| change attendee/interpreter language direction | Mutate or react | remote rejection/timeout and cleanup |

```mermaid
sequenceDiagram
  participant C as Caller
  participant M as Interpretation
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
  class Interpretation
  class SupportingDependency
  class WebexBoundary
  Caller --> Interpretation
  Interpretation --> SupportingDependency
  SupportingDependency --> WebexBoundary
```

The module owns its projection/controller and composes supporting requests, types, constants, collections, or utilities. The Webex boundary remains authoritative.

## Use Cases

- **UC-1 Primary:** the parent/consumer requests query supported languages and expose interpretation state; the module validates or derives data and returns/emits the normalized outcome. Evidence: `src/interpretation/index.ts`, `test/unit/spec/interpretation/index.ts`.
- **UC-2 Change:** the parent/consumer triggers change attendee/interpreter language direction; capability/current state is checked, the dependency is invoked, and accepted state is exposed once. Evidence: `src/interpretation/index.ts`, `src/interpretation/siLanguage.ts`.

## State Model

Supported languages, interpreters, self interpretation/direction, host/meeting enablement, management capability, and handoff listeners are meeting scoped.

## Business Rules & Invariants

- Direction and handoff actions require current language/interpreter/self data; only the intended approver/requester transition is applied; cleanup removes approval listeners. Enforced under `src/interpretation/`.

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

Exact state values/guards remain in `src/interpretation/index.ts`; this diagram groups the externally meaningful lifecycle.

## Error Handling & Failure Modes

| Condition | Signal | Caller recovery |
|---|---|---|
| missing capability, identity, URL, or invalid options | validation/established rejection | refresh state or correct input; do not retry unchanged |
| service/channel/request rejection | propagated request or module error | branch on error; retry only through existing bounded policy |
| timeout, role change, or teardown race | rejected/ignored stale result with cleanup | re-read current meeting state and invoke again only if still eligible |

## Pitfalls

- Host-enabled, meeting-enabled, and self-interpreter state are distinct. Collapsing them yields incorrect controls and handoff eligibility.
- Verify both typed constants/enums and raw wire values before changing a logical condition in this legacy package.

## Module Do's / Don'ts

- DO preserve the module's current role/capability/state gate and mirrored tests.
- DON'T bypass the owning request, collection, event scope, lock, or cleanup helper.

## Test-Case Strategy (module)

Start with the mirrored suite and sibling files in the same test directory. Cover successful derivation/mutation plus invalid capability/input, remote rejection, stale event, and cleanup. Use Sinon, `calledOnceWithExactly`, and fake timers for retry/lock/token/channel timing.

| Behavior / Requirement | Existing test evidence | Gap |
|---|---|---|
| `INTERPRETATION-R-001` | `test/unit/spec/interpretation/index.ts` | inspect sibling tests for full operation matrix |
| `INTERPRETATION-R-002` | `test/unit/spec/interpretation/index.ts` | verify rejected and role/capability-change branches |
| `INTERPRETATION-R-003` | `test/unit/spec/interpretation/index.ts` | verify cleanup on all early exits |

## Traceability

- Repo architecture: [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md) · Registry: [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md)
- Coverage state and contracts baseline: `../../../.sdd/manifest.json`
