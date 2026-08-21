<!-- sdd-generated-metadata
doc_kind: module-spec
generated_from: module-spec@0.2.2
generator_plugin: repo-annotation@1.0.5+codex.20260818094939
generated_by: codex
approved_by: repository user
updated_at: 2026-08-21T06:10:05Z
validation_status: not-run
-->
# CONTROLS OPTIONS MANAGER — SPEC

> Start here → root [`AGENTS.md`](../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md) · system [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md). This is the canonical source-local spec for `src/controls-options-manager/`.

## Metadata

| Field | Value |
|---|---|
| Module id | `controls-options-manager` |
| Source path(s) | `src/controls-options-manager/` |
| Parent spec | — |
| Doc kind | Module spec |
| Coverage score | 93% assessed 2026-08-21; 13/14 mandatory fields present; all critical and Important fields present; one noncritical polish gap remains |
| Generated from | `module-spec` @ SDLC template library `0.2.2` |
| generated_by / approved_by / updated_at | codex / repository user / 2026-08-21T06:10:05Z |
| Validation status | not-run |

## Evidence Rules

Requirements cite current source and mirrored tests. Current code wins over retained prose when they conflict; commit and PR history are excluded. Missing evidence stays a gap.

## Source Material Register

| Source material | Scope | Decision | Detail location or disposition |
|---|---|---|---|
| No routed legacy module spec | overview / API / behavior / tests | none; generated from current manager/types/enums/constants/utilities and tests |
| Current source and mirrored tests | implementation / tests | verified | requirements, flows, failures, and test strategy below |

## Overview

`src/controls-options-manager/` contains 5 direct source/reference file(s) and has 2 mirrored unit-test file(s). This spec separates its public operations, runtime data movement, component ownership, state applicability, and verification boundary.

## Purpose / Responsibility

Derives typed control availability/current settings from Locus controls and builds valid mutations for audio, hand, reactions, sharing, video, annotation, remote desktop, and polling/QA.

## Stack

TypeScript/JavaScript in the Node 22.14 Yarn workspace; Webex core/plugin abstractions and Mocha/Sinon/`@webex/test-helper-chai` tests.

## Folder / Package Structure

```text
src/controls-options-manager/
├── constants.ts — module constants and wire values
├── enums.ts — declared action/control enum values
├── index.ts — module facade/controller or primary exports
├── types.ts — module type declarations
├── util.ts — normalization/helper functions
└── ai-docs/controls-options-manager-spec.md — canonical module specification
```

## Key Files (source of truth)

| File | Holds |
|---|---|
| `src/controls-options-manager/constants.ts` | module constants and wire values |
| `src/controls-options-manager/enums.ts` | declared action/control enum values |
| `src/controls-options-manager/index.ts` | module facade/controller or primary exports |
| `src/controls-options-manager/types.ts` | module type declarations |
| `src/controls-options-manager/util.ts` | normalization/helper functions |
| `test/unit/spec/controls-options-manager/index.js` and 1 sibling test file(s) | mirrored characterization/unit coverage |

## Public Surface

| Contract ID | Type | Surface | Purpose | Compatibility / deprecation | Schema / detail link | Root index |
|---|---|---|---|---|---|---|
| `controls-options-manager.1` | SDK / in-process / remote | normalize Locus control options into typed properties | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/controls-options-manager/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `controls-options-manager.2` | SDK / in-process / remote | query whether a control can be set/unset and its enabled state | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/controls-options-manager/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |
| `controls-options-manager.3` | SDK / in-process / remote | build/apply valid control-setting request bodies | Focused operation group owned by this module | Preserve methods/events/wire values reachable from package objects | `src/controls-options-manager/index.ts` | [CONTRACTS](../../../ai-docs/CONTRACTS.md) |

Compatibility notes:
- Prefer additive fields/options and preserve current return and rejection semantics. Internal helpers are not public merely because they are exported within the source directory.

## Requires (dependencies)

Locus controls, control/setting enums, constants, utility normalization, parent meeting request access, and role/capability state.

## Requirements

| ID | WHAT | WHY | Source Evidence | Test / Example Evidence | Assumptions / Gaps | Confidence |
|---|---|---|---|---|---|---|
| `CONTROLS-OPTIONS-MANAGER-R-001` | normalize Locus control options into typed properties. | Derives typed control availability/current settings from Locus controls and builds valid mutations for audio, hand, reactions, sharing, video, annotation, remote desktop, and polling/QA. | `src/controls-options-manager/index.ts` | `test/unit/spec/controls-options-manager/index.js` | none | PRESENT |
| `CONTROLS-OPTIONS-MANAGER-R-002` | query whether a control can be set/unset and its enabled state. | Consumers need deterministic behavior across meeting and remote updates. | `src/controls-options-manager/index.ts`, `src/controls-options-manager/util.ts` | `test/unit/spec/controls-options-manager/index.js` | inspect sibling tests for operation-specific cases | PRESENT |
| `CONTROLS-OPTIONS-MANAGER-R-003` | Invalid or unsupported control inputs return the module's current false/undefined/error result; the module allocates no async resource that requires cleanup. | Callers must receive the actual module failure outcome without false cleanup or event guarantees. | `src/controls-options-manager/` | `test/unit/spec/controls-options-manager/index.js` | none | PRESENT |

## Design Overview

This is an in-memory adapter: `util.ts` interprets raw Locus controls with the enums/constants/types, and `index.ts` exposes normalized properties plus request-body builders. It performs no network I/O and owns no listeners or timers.

## Data Flow

```mermaid
flowchart LR
  Locus[Raw Locus controls] --> Util[util.ts normalization]
  Util --> Manager[index.ts]
  Types[constants.ts / enums.ts / types.ts] --> Util
  Manager --> Query[availability and enabled-state queries]
  Manager --> Body[control-setting request body]
  Body --> Parent[Meeting request owner]
```

## Sequence Diagram(s)

Sequence coverage:

| Operation group | Diagram | Failure coverage |
|---|---|---|
| UC-1 — primary operation | Primary operation sequence | accepted and rejected dependency outcomes |
| UC-2 — secondary/change operation | Secondary operation and failure sequence | unknown control/setting, absent capability, or malformed Locus control data |

### Primary operation sequence

```mermaid
sequenceDiagram
  participant P as Meeting parent
  participant M as ControlsOptionsManager
  participant U as util.ts
  P->>M: update raw controls
  M->>U: normalize by control and setting maps
  U-->>M: typed control properties
  P->>M: query or build mutation
  M-->>P: boolean/current value or request body
```

### Secondary operation and failure sequence

```mermaid
sequenceDiagram
  participant C as Caller / current input owner
  participant M as ControlsOptionsManager
  C->>M: invoke the UC-2 operation
  M->>M: apply the current guard and ownership rules
  alt accepted current input
    M-->>C: documented result, state update, or scoped event
  else unknown control/setting, absent capability, or malformed Locus control data
    M--xC: documented R-003 rejection, ignore, or cleanup outcome
  end
```

## Class / Component Relationships

```mermaid
classDiagram
  class Locus
  class Util
  class Manager
  class Types
  class Query
  class Body
  class Parent
  Locus --> Util
  Util --> Manager
  Types --> Util
  Manager --> Query
  Manager --> Body
  Body --> Parent
```

The arrows identify ownership and delegation inside `src/controls-options-manager/`; files that only declare types or constants are not presented as transports.

## Use Cases

- **UC-1:** Translate raw Locus controls into typed availability and current-value properties. Evidence: `src/controls-options-manager/`.
- **UC-2:** Build only the control-setting fields supported by the current control capability map; the parent meeting owns transmission. Evidence: `src/controls-options-manager/`.

## State Model

Normalized control configuration/properties are refreshed from the current Locus projection.

## Business Rules & Invariants

- A setting can be changed only when its control advertises the matching capability; request body keys use the declared control/setting map. Enforced under `src/controls-options-manager/`.

## Error Handling & Failure Modes

| Condition | Signal | Caller recovery |
|---|---|---|
| unknown control/setting, absent capability, or malformed Locus control data | Follow the concrete rejection, ignore, state, or cleanup behavior in the module's R-003 requirement. | Resolve the named condition; retry only when another requirement defines a bound. |
| UC-1 succeeds | Return, update, callback, or scoped event identified by the Public Surface and primary sequence. | Continue from the owning module's accepted state. |

## Pitfalls

- Enabled state and can-set/can-unset are independent. Treating enabled as permission exposes invalid toggles.
- Verify both typed constants/enums and raw wire values before changing a logical condition in this legacy package.

## Test-Case Strategy (module)

Use the current mirrored suites: `test/unit/spec/controls-options-manager/index.js`, `test/unit/spec/controls-options-manager/util.js`. Characterize the two code-grounded use cases above and the listed failure condition; add cleanup or transition cases only for resources and state this module actually owns.

| Behavior / Requirement | Existing test evidence | Gap |
|---|---|---|
| `CONTROLS-OPTIONS-MANAGER-R-001` | `test/unit/spec/controls-options-manager/index.js` | inspect sibling tests for full operation matrix |
| `CONTROLS-OPTIONS-MANAGER-R-002` | `test/unit/spec/controls-options-manager/index.js` | verify the operation-specific invalid-input and rejection branches |
| `CONTROLS-OPTIONS-MANAGER-R-003` | `test/unit/spec/controls-options-manager/index.js` | verify the concrete R-003 rejection, ignore, or cleanup outcome |

## Traceability

- Repo architecture: [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md) · Registry: [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md)
- Coverage state and contracts baseline: `../../../.sdd/manifest.json`
