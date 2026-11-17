# Task — T2: `cc.ts` V2 Orchestration & V2→V1 Bridge

> **Navigation:** [AGENTS.md](../../../../AGENTS.md) → [SPEC_INDEX.md](../../../../SPEC_INDEX.md) → [ARCHITECTURE.md](../../../../ARCHITECTURE.md)

> Start here → repo [`AGENTS.md`](../../../../AGENTS.md). Under [`epic.md`](./epic.md) ↔ plan [`implementation-plan-t2.md`](./implementation-plan-t2.md); implements [`../../design/feature-design.md`](../../design/feature-design.md).

## Metadata
| Field | Value |
|---|---|
| Task title | `cc.ts` V2 orchestration & bridge |
| Parent epic | [`./epic.md`](./epic.md) |
| Task type | backend |
| Target repo(s) / module(s) | `webex/webex-js-sdk` · `@webex/contact-center` (`cc.ts`, `services/agent/aggregate.ts`) |
| Tracker key | WXCC-15791 |
| State | merged |
| Generated from | `task` @ SDLC template library `0.2.0` |

## Source Mapping
- Implements: Feature Design → Functional-Block Decomposition (plugin orchestration + `aggregate.ts`) + HA & Failure-Condition Matrix.

## Primary Code Touchpoints
- `src/services/agent/aggregate.ts` (new) — `projectAggregate`, `shouldEmitLegacyEvent`, `shouldBridgeChannelState`, `bridgeStateChangeSuccess` → flat `BridgedV1StateChange`.
- `src/cc.ts` — V2 getters (`getChannelStates`/`getAgentStateControl`); `setAgentState` V2 branch; private `isV2Eligible`, `pinSessionVersion`, `isV2Session`, `clearSessionVersion`, `selectDefaultChannels`, `seedChannelStates`, `assertChannelsSelectable`, `selectDisconnectedChannels`, `shouldDeferTelephonyRecovery`, `splitTelephonyRecovery`; version resolved inline in `stationLogin()`; V2-aware login/logout/reload routing; WebSocket V2 handlers.

## Ownership Boundary
- Owns: `cc.ts` V2 regions, `services/agent/aggregate.ts`.
- Must NOT touch: V2 types/builders/config parsing → owned by T1; tests/sample → T3.

## Multi-Repo Scope
| Target repo | Module | Why | Manifest / standing docs |
|---|---|---|---|
| `webex/webex-js-sdk` | `@webex/contact-center` | N/A — single target repo | `ai-docs/` |

## Dependencies / Execution Stream
| This task | Depends on | Parallel-safe with | Wave |
|---|---|---|---|
| T2 | T1 | — | 2 |

## Acceptance Criteria
- [ ] V2 session routes state change/login/logout/reload through V2; V1 unchanged.
- [ ] Getters return correct values (`{}`/reset when not V2).
- [ ] Channel changes bridge to a V1 event only when the aggregate changes; no bridgeable state → no emit.
- [ ] Reconnect recovers channels; BROWSER telephony deferred and guarded.

## Verifier Exit Criteria
- [ ] `aggregate.ts` output typed as `BridgedV1StateChange` (flat), build clean.
- [ ] V1 login fallback on AQM timeout pins V1.

## Traceability
| Requirement | Code symbol | Test |
|---|---|---|
| R-1 | `setAgentState` V2 branch | `cc.ts` |
| R-8 | `aggregate.projectAggregate`/`shouldEmitLegacyEvent` | `aggregate.ts` |
| R-9 | `isV2Eligible`/`pinSessionVersion` (version resolved inline in `stationLogin()`) | `cc.ts` |
| R-11 | `assertChannelsSelectable` | `cc.ts` |
| R-12/13 | `selectDisconnectedChannels`/`splitTelephonyRecovery` | `cc.ts` |

## Coverage Expectation
- Covered by T3 within the package 85% gate.

## Non-Goals

- Defining V2 types, request builders, or event constants (owned by T1).
- Writing unit tests or sample-app panel (owned by T3).
- Modifying V1 login/logout/state/reload code paths beyond the version branch.
- Implementing UI-layer or store-layer V2 logic (owned by widgets repo).
- Handling WebRTC line management; telephony deferral boundary is `@webex/calling`'s concern.

## Cross-Cutting Prompts

- **Observability**: Are logs/metrics emitted for this task's state transitions?
- **Error handling**: Are failures surfaced to the consumer (event/callback/UI)?
- **Backward compatibility**: Does this change break existing V1 consumers?
- **Security**: Does this task handle any PII or authentication tokens?
