# Epic — SDK V2 Granular Agent State

> Start here → package [`AGENTS.md`](../../../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../../../docs/specs/README.md). This epic delivers a slice of the design [`feature-design.md`](../../design/feature-design.md); its child tasks are [`task-t1.md`](./task-t1.md) to [`task-t4.md`](./task-t4.md), each with an implementation plan.
> Context-efficiency: this epic maps design sections to tasks; it does not restate the design.

## Metadata
| Field | Value |
|---|---|
| Epic title | SDK V2 Granular Agent State |
| Parent feature | [`../../design/feature-design.md`](../../design/feature-design.md) (and [`../../spec/feature-spec.md`](../../spec/feature-spec.md)) |
| Service group / capability | `@webex/contact-center` per-channel agent state (V2) and session lifecycle signals |
| Tracker / Epic key | [WXCC-15791](https://jira-eng-sjc12.cisco.com/jira/browse/WXCC-15791) |
| Status | in-progress (T1–T3 committed on `feature/WXCC-15791-Support-Granular-Agent-State`; T4 in the working tree) |
| created_by / approved_by / date | SDD intake / pending / 2026-09-21, revised 2026-11-19 |
| Generated from | `epic` @ SDLC template library `0.2.0` |

## Scope — the slice of the design this epic delivers
All SDK work for the feature:
- V2 types, the four request builders, and V2 events;
- session version from the re-read profile flag, pinned per session, server wins on reload;
- V2 routing for login, state change, logout, and reload;
- channel validation, the V2→V1 bridge, the two getters, and per-channel recovery with telephony deferral;
- the refresh and reconnect boundary (connection and session-not-found events, cleanup, listener identity);
- unit tests and the sample-app reference UI.

It lands as one PR.

## Mapped Design Sections
| Feature design section | What this epic delivers from it |
|---|---|
| Functional-Block Decomposition: V2 request builders, Flag resolver | T1 |
| Functional-Block Decomposition: Session version pin, Request router, Channel validator, Channel state store, WebSocket V2 handlers, V2→V1 bridge, Recovery, Public getters | T2 |
| Functional-Block Decomposition: Session lifecycle events, Cleanup | T4 |
| Object-Model Changes | T1 (types), T2 (`AgentStateControlStatus`, `SetStateResponse`) |
| Interface & Contract Definitions, [`contracts/`](../../design/contracts/) | T1, T2, T4 |
| Sequence Diagrams Flow 1–Flow 2 and the linked module-spec flows, HA & Failure-Condition Matrix | T2 (Flow 1, Flow 2 reload and recovery, state change, channel events), T4 (Flow 2 connection events and session not found, logout and deregister) |
| Test Strategy | T3 (tests for T1, T2), T4 (its own tests) |
| UX Design & Traceability (sample spec) | T3, T4 |

## Summary of Changes (per service / module)
- **`src/services/agent`:** V2 types, `stationLoginV2`, `stateChangeV2`, `logoutV2`, `reloadV2`; new `aggregate.ts`; 7 new `AGENT_EVENTS`.
- **`src/services/config`:** V2 `CC_AGENT_EVENTS`; `manageChannelAvailability` and optional profile fields; `parseAgentConfigs` mapping.
- **`src/services/core`:** V2 AQM error IDs in `Err.ts`.
- **`src` (`cc.ts`, `index.ts`, `types.ts`):** V2 routing, pin, handlers, recovery, getters, lifecycle events, exports.
- **`test/unit/spec`, `docs/samples/contact-center`:** unit tests and reference UI.

## Baseline vs This Epic
| Capability | Already shipped (baseline, `next`) | Added by this epic |
|---|---|---|
| Agent-wide V1 state, login, logout | yes | — |
| Automated relogin on refresh and reconnect (`silentRelogin`) | yes (V1 only, silent on `AGENT_NOT_FOUND`) | V2 reload, pinning, per-channel recovery, session-not-found event |
| Connection loss handling | yes (log only, TODOs for events) | `agent:connectionLost`, `agent:connectionReconnected`, stable listener reference |
| Per-channel V2 state, events, bridge, getters | — | this epic |

## Child Tasks
| Task | One-line | PR-sized? | Task doc | Tracker key |
|---|---|---|---|---|
| T1 | V2 types, request builders, event constants, profile flag parsing | yes | [`task-t1.md`](./task-t1.md) | WXCC-15791 |
| T2 | `cc.ts` V2 orchestration and the `aggregate.ts` bridge | yes | [`task-t2.md`](./task-t2.md) | WXCC-15791 |
| T3 | Unit tests for T1 and T2, and the sample-app V2 UI | yes | [`task-t3.md`](./task-t3.md) | WXCC-15791 |
| T4 | Session lifecycle: connection and session-not-found events, cleanup, listener identity, sample status | yes | [`task-t4.md`](./task-t4.md) | WXCC-15791 |

## Sequencing & Dependencies
| Task / epic | Depends on | Parallel-safe with | Wave |
|---|---|---|---|
| T1 | — | — | 1 |
| T2 | T1 | — | 2 |
| T3 | T1, T2 | T4 (separate test blocks and sample sections) | 3 |
| T4 | T2 (`silentRelogin`, `clearV2LocalState`) | T3 | 3 |

## Rollout Order
1. Merge with every agent's flag `false`; V1 behavior unchanged.
2. Backend confirms V2 endpoints and notifications (Q-1); enable the flag for test agents.
3. Widgets adopt the getters and V2 events; pilot tenants.
4. GA per tenant. Rollback: set the flag `false` (applies at next login).

## Exit Criteria
- [x] V2 types, builders, and events exported; `manageChannelAvailability` parsed (T1).
- [x] V2 routing, pin, bridge, getters, and recovery implemented; V1 behavior unchanged (T2).
- [x] Unit tests for every requirement except the sample (R-14); 4 suites, 278 tests green (T3, T4).
- [x] Connection, reconnect, and session-not-found events emitted; listener removed on deregister (T4).
- [ ] Q-1 and Q-2 closed; reviewer sign-off in the design.
- [ ] Package 85% coverage gate re-measured in CI.

## References
- Feature design: [`../../design/feature-design.md`](../../design/feature-design.md) · Feature spec: [`../../spec/feature-spec.md`](../../spec/feature-spec.md) · Test plan: [`../../test-strategy.md`](../../test-strategy.md)
- Child tasks: [`task-t1.md`](./task-t1.md), [`task-t2.md`](./task-t2.md), [`task-t3.md`](./task-t3.md), [`task-t4.md`](./task-t4.md) · Implementation plans: [`implementation-plan-t1.md`](./implementation-plan-t1.md) to [`implementation-plan-t4.md`](./implementation-plan-t4.md)
