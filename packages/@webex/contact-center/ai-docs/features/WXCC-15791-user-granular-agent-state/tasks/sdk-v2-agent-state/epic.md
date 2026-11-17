# Epic — SDK V2 Granular Agent State

> **Navigation:** [AGENTS.md](../../../../AGENTS.md) → [SPEC_INDEX.md](../../../../SPEC_INDEX.md) → [ARCHITECTURE.md](../../../../ARCHITECTURE.md)

> Start here → repo [`AGENTS.md`](../../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../../ai-docs/SPEC_INDEX.md). Delivers [`../../design/feature-design.md`](../../design/feature-design.md); child tasks → [`task-t1.md`](./task-t1.md), [`task-t2.md`](./task-t2.md), [`task-t3.md`](./task-t3.md).

## Metadata
| Field | Value |
|---|---|
| Epic title | SDK V2 Granular Agent State |
| Parent feature | [`../../design/feature-design.md`](../../design/feature-design.md) (and [`../../spec/feature-spec.md`](../../spec/feature-spec.md)) |
| Service group / capability | `@webex/contact-center` V2 per-channel agent state |
| Tracker / Epic key | WXCC-15791 |
| Status | ready |
| Generated from | `epic` @ SDLC template library `0.2.0` |

## Scope — the slice of the design this epic delivers
All SDK-side V2 support: V2 types + request builders + events, session-version resolution/pinning, V2-aware login/logout/reload routing, channel validation, per-channel recovery, the deterministic V2→V1 bridge, the three public getters, tests, and the sample-app panel. Lands as one PR.

## Mapped Design Sections
| Feature design section | What this epic delivers |
|---|---|
| Functional-Block Decomposition | request builders, `aggregate.ts`, folded `cc.ts` orchestration |
| Interface & Contract Definitions | V2 state-change / events / reload contracts |

## Summary of Changes (per service / module)
- **`services/agent`:** V2 types + request builders; new `aggregate.ts` bridge.
- **`services/config`:** V2 event constants + `manageChannelAvailability` parsing.
- **`cc.ts`:** V2 public API, pinning, eligibility/channels/recovery (private methods), WebSocket V2 dispatch.
- **tests + `docs/samples`:** unit tests + V2 panel.

## Baseline vs This Epic
| Capability | Already shipped (baseline) | Added by this epic |
|---|---|---|
| Agent-wide V1 state | yes | — |
| Per-channel V2 state, events, recovery, bridge | — | this epic |

## Child Tasks
| Task | One-line | PR-sized? | Task doc | Tracker key |
|---|---|---|---|---|
| T1 | V2 types, request builders, events, config/profile parsing | yes | [`task-t1.md`](./task-t1.md) | WXCC-15791 |
| T2 | `cc.ts` V2 orchestration + `aggregate.ts` bridge | yes | [`task-t2.md`](./task-t2.md) | WXCC-15791 |
| T3 | Unit tests + sample-app panel | yes | [`task-t3.md`](./task-t3.md) | WXCC-15791 |

## Sequencing & Dependencies
| Task | Depends on | Parallel-safe with | Wave |
|---|---|---|---|
| T1 | — | — | 1 |
| T2 | T1 | — | 2 |
| T3 | T1, T2 | — | 3 |

## Exit Criteria
- [ ] V2 types/builders/events exported; `manageChannelAvailability` parsed.
- [ ] V2 public API + bridge implemented; V1 behavior unchanged.
- [ ] `aggregate.ts` and `cc.ts` V2 paths covered; package 85% gate holds; build + unit suites green.
