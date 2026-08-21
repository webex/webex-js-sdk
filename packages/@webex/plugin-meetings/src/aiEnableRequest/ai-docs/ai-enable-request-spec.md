<!-- sdd-generated-metadata
doc_kind: module-spec
generated_from: module-spec@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-21T06:10:05Z
validation_status: not-run
-->
# AI ENABLE REQUEST — SPEC

> Start here → root [`AGENTS.md`](../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md). This is the canonical source-local spec for `src/aiEnableRequest/`.

## Metadata

| Field | Value |
|---|---|
| Module id | `aiEnableRequest` |
| Source path(s) | `src/aiEnableRequest/` |
| Parent spec | — |
| Doc kind | Module spec |
| Coverage score | 86% assessed 2026-08-21; 12/14 mandatory fields present; all critical fields present; one Important outcome-detail gap and one polish gap remain |
| Generated from | `module-spec` @ SDLC template library `0.2.2` |
| generated_by / approved_by / updated_at | codex / repository user / 2026-08-21T06:10:05Z |
| Validation status | not-run |

## Evidence Rules

Requirements cite current source and mirrored tests. Current code wins over retained prose when they conflict; commit and PR history are excluded. Missing evidence stays a gap.

## Source Material Register

| Source material | Scope | Decision | Detail location or disposition |
|---|---|---|---|
| Retained AI Assistant enable-request guide | overview / API / behavior / tests | used and verified; event catalog, initiator/approver operations, and example workflow were moved into requirements, sequence, state, and use cases |
| Current source and mirrored tests | implementation / tests | verified | requirements, flows, failures, and test strategy below |

## Overview

`src/aiEnableRequest/` contains 3 direct source/reference file(s) and has 2 mirrored unit-test file(s). This spec separates its public operations, runtime data movement, component ownership, state applicability, and verification boundary.

## Purpose / Responsibility

Owns the meeting-scoped approval workflow used when a participant requests host approval to enable AI Assistant.

## Stack

TypeScript/JavaScript in the Node 22.14 Yarn workspace; Webex core/plugin abstractions and Mocha/Sinon/`@webex/test-helper-chai` tests.

## Folder / Package Structure

```text
src/aiEnableRequest/
├── README.md — retained legacy reference input
├── index.ts — module facade/controller or primary exports
├── utils.ts — normalization/helper functions
└── ai-docs/ai-enable-request-spec.md — canonical module specification
```

## Key Files (source of truth)

| File | Holds |
|---|---|
| `src/aiEnableRequest/README.md` | retained legacy reference input |
| `src/aiEnableRequest/index.ts` | module facade/controller or primary exports |
| `src/aiEnableRequest/utils.ts` | normalization/helper functions |
| `test/unit/spec/aiEnableRequest/index.ts` and 1 sibling test file(s) | mirrored characterization/unit coverage |

## Public Surface

| Contract ID | Type | Surface | Purpose | Compatibility / deprecation | Schema / detail link | Root index |
|---|---|---|---|---|---|---|
| `aiEnableRequest.1` | SDK / in-process / remote | select the eligible AI-enablement approver | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/aiEnableRequest/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `aiEnableRequest.2` | SDK / in-process / remote | request AI Assistant enablement approval | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/aiEnableRequest/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `aiEnableRequest.3` | SDK / in-process / remote | accept, decline, or decline-all approval requests and emit outcomes | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/aiEnableRequest/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |

Compatibility notes:
- Prefer additive fields/options and preserve current rejection/event/cleanup semantics. Internal helpers are not public merely because they are exported within the source directory.

## Requires (dependencies)

Meeting self/host/cohost identity and policy, Locus/approval URLs, request access, Mercury/approval events, and scoped event utilities.

## Requirements

| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| `AI-ENABLE-REQUEST-R-001` | select the eligible AI-enablement approver. | Owns the meeting-scoped approval workflow used when a participant requests host approval to enable AI Assistant. | `src/aiEnableRequest/index.ts` | `test/unit/spec/aiEnableRequest/index.ts` | none | PRESENT |
| `AI-ENABLE-REQUEST-R-002` | request AI Assistant enablement approval. | Consumers need deterministic behavior across meeting and remote updates. | `src/aiEnableRequest/index.ts`, `src/aiEnableRequest/utils.ts` | `test/unit/spec/aiEnableRequest/index.ts` | inspect sibling tests for operation-specific cases | PRESENT |
| `AI-ENABLE-REQUEST-R-003` | HTTP rejections propagate through the returned promise, while unrelated Mercury approval events are ignored and the single listener is installed only once. | Callers must receive the actual module failure outcome without false cleanup or event guarantees. | `src/aiEnableRequest/` | `test/unit/spec/aiEnableRequest/index.ts` | none | PRESENT |

## Design Overview

AIEnableRequest owns one Mercury approval listener and the HTTP writes to the current Locus approval URL. `utils.ts` only selects an eligible approver from roster data; it is not a transport.

## Data Flow

```mermaid
flowchart LR
  Roster[Meeting roster] --> Selector[utils.ts: approver selection]
  Caller[Meeting / consumer] --> Controller[index.ts: approval workflow]
  Selector --> Controller
  Mercury[Mercury approval events] --> Controller
  Controller --> Approval[HTTP request to approvalUrl]
  Controller --> Event[APPROVAL_REQUEST_ARRIVED]
```

## Sequence Diagram(s)

Sequence coverage:

| Operation group | Diagram | Failure coverage |
|---|---|---|
| UC-1 — primary operation | Primary operation sequence | accepted and rejected dependency outcomes |
| UC-2 — secondary/change operation | Secondary operation and failure sequence | missing approval URL/participant context, HTTP rejection, or a Mercury event for another Locus |

### Primary operation sequence

```mermaid
sequenceDiagram
  participant C as Meeting / consumer
  participant A as AIEnableRequest index.ts
  participant M as Mercury
  participant H as approvalUrl
  M-->>A: approval-request event
  A->>A: filter resourceType, locusUrl, and participant ids
  A-->>C: APPROVAL_REQUEST_ARRIVED when relevant
  C->>A: request / accept / decline
  A->>H: POST or PUT action payload
  H-->>A: response or rejection
  A-->>C: settle the request promise
```

### Secondary operation and failure sequence

```mermaid
sequenceDiagram
  participant C as Caller / current input owner
  participant M as AIEnableRequest
  C->>M: invoke the UC-2 operation
  M->>M: apply the current guard and ownership rules
  alt accepted current input
    M-->>C: documented result, state update, or scoped event
  else missing approval URL/participant context, HTTP rejection, or a Mercury event for another Locus
    M--xC: documented R-003 rejection, ignore, or cleanup outcome
  end
```

## Class / Component Relationships

```mermaid
classDiagram
  class Roster
  class Selector
  class Caller
  class Controller
  class Mercury
  class Approval
  class Event
  Roster --> Selector
  Caller --> Controller
  Selector --> Controller
  Mercury --> Controller
  Controller --> Approval
  Controller --> Event
```

The arrows identify ownership and delegation inside `src/aiEnableRequest/`; files that only declare types or constants are not presented as transports.

## Use Cases

- **UC-1:** Select a host or cohost from the current roster with `getAIEnablementApprover`, excluding the requesting participant. Evidence: `src/aiEnableRequest/`.
- **UC-2:** Filter Mercury approval events to this Locus and expose only requests relevant to the initiator, approver, or `DECLINED_ALL` observers. Evidence: `src/aiEnableRequest/`.

## State Model

Approval and Locus URLs, self participant id, listener registrations, and active request context are meeting scoped.

## Business Rules & Invariants

- Only an eligible host/cohost is selected; initiator and approver ids are preserved; accept/decline actions target the supplied approval request URL; cleanup removes listeners. Enforced under `src/aiEnableRequest/`.

## Concurrency & Reactive Flow

- Async work owned by `AIEnableRequest` may complete after a newer caller or remote input. Preserve the identity, sequence, and resource-owner guards in `src/aiEnableRequest/`; a late completion must not replay UC-2 for superseded state.

## Error Handling & Failure Modes

| Condition | Signal | Caller recovery |
|---|---|---|
| missing approval URL/participant context, HTTP rejection, or a Mercury event for another Locus | Follow the concrete rejection, ignore, state, or cleanup behavior in the module's R-003 requirement. | Resolve the named condition; retry only when another requirement defines a bound. |
| UC-1 succeeds | Return, update, callback, or scoped event identified by the Public Surface and primary sequence. | Continue from the owning module's accepted state. |

## Pitfalls

- The approver is derived from current meeting roster/roles. Caching it across host/cohost changes can send a request to an ineligible participant.
- Verify both typed constants/enums and raw wire values before changing a logical condition in this legacy package.

## Module Do's / Don'ts

- DO preserve this boundary: Select a host or cohost from the current roster with `getAIEnablementApprover`, excluding the requesting participant.
- DON'T move remote I/O or lifecycle ownership into a passive type, constant, catalog, or normalization file.

## Test-Case Strategy (module)

Use the current mirrored suites: `test/unit/spec/aiEnableRequest/index.ts`, `test/unit/spec/aiEnableRequest/utils.ts`. Characterize the two code-grounded use cases above and the listed failure condition; add cleanup or transition cases only for resources and state this module actually owns.

| Behavior / Requirement | Existing test evidence | Gap |
|---|---|---|
| `AI-ENABLE-REQUEST-R-001` | `test/unit/spec/aiEnableRequest/index.ts` | inspect sibling tests for full operation matrix |
| `AI-ENABLE-REQUEST-R-002` | `test/unit/spec/aiEnableRequest/index.ts` | verify the operation-specific invalid-input and rejection branches |
| `AI-ENABLE-REQUEST-R-003` | `test/unit/spec/aiEnableRequest/index.ts` | verify the concrete R-003 rejection, ignore, or cleanup outcome |

## Traceability

- Repo architecture: [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md) · Registry: [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md)
- Coverage state and contracts baseline: `../../../.sdd/manifest.json`
