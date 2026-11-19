# Task — T2: `cc.ts` V2 orchestration and the V2→V1 bridge

> Start here → package [`AGENTS.md`](../../../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../../../docs/specs/README.md). This task sits under its epic [`epic.md`](./epic.md) ↔ its plan [`implementation-plan-t2.md`](./implementation-plan-t2.md); it implements part of [`feature-design.md`](../../design/feature-design.md).
> Context-efficiency: this task names files and checks; behavior lives in the design and contracts.

## Metadata
| Field | Value |
|---|---|
| Task title | `cc.ts` V2 orchestration and the V2→V1 bridge |
| Parent epic | [`./epic.md`](./epic.md) |
| Parent feature | [`../../design/feature-design.md`](../../design/feature-design.md) (and [`../../spec/feature-spec.md`](../../spec/feature-spec.md)) |
| Task type | API |
| Target repo(s) / module(s) | `webex/webex-js-sdk` · `@webex/contact-center` (`src/cc.ts`, `src/types.ts`, `src/services/agent/aggregate.ts`) |
| Tracker key | [WXCC-15791](https://jira-eng-sjc12.cisco.com/jira/browse/WXCC-15791) |
| State | ready_for_merge |
| created_by / approved_by / date | SDD intake / pending / 2026-09-21, revised 2026-11-19 |
| Generated from | `task` @ SDLC template library `0.2.0` |

## Source Mapping
- Implements: Feature Architecture → Functional-Block Decomposition. The blocks are: Flag resolver, Session version pin, Request router, Channel validator, Channel state store, WebSocket V2 handlers, V2→V1 bridge, Recovery, and Public getters.
- Also implements Sequence Diagrams Flow 1 (V1 / V2 selection) and Flow 2 (reload and recovery parts), plus the state-change and channel-event flows linked from the coverage table.

## Primary Code Touchpoints
- `src/services/agent/aggregate.ts` (new): `shouldBridgeChannelState`, `projectAggregate`, `shouldEmitLegacyEvent`, `bridgeStateChangeSuccess`, `BridgedV1StateChange`.
- `src/cc.ts`:
  - **State:** `pinnedVersion`, `channelStatesMap`, `loginChannelsMap`, `lastEmittedV1`, `telephonyRecoveryTimer`.
  - **Methods:** `refreshManageChannelAvailability`, `isV2Eligible`, `pinSessionVersion`, `isV2Session`, `shouldRouteV2`, `clearSessionVersion`, `clearV2LocalState`, `selectDefaultChannels`, `seedChannelStates`, `assertChannelsSelectable`, `selectDisconnectedChannels`, `splitTelephonyRecovery`, `scheduleTelephonyRecovery`, `restoreV2AgentConfigFromChannels`, `handleChannelStateChanged`, `handleChannelReloginSuccess`.
  - **V2 branches in:** `stationLogin`, `setAgentState`, `stationLogout`, `silentRelogin`, and `handleWebsocketMessage` (early pin and the V2 cases).
  - **Public getters:** `getChannelStates`, `getAgentStateControl`.
- `src/types.ts`: `AgentStateControlStatus`, `SetStateResponse` includes `AgentChannelStateChanged` (the getters are declared on the class only, like most public methods; `IContactCenter` is unchanged).

## Ownership Boundary
- Owns: `src/services/agent/aggregate.ts`; `src/types.ts` V2 additions; every V2 method and branch in `src/cc.ts` listed above.
- Must NOT touch (owned by another task):
  - `src/cc.ts` `handleConnectionLost`, `setupEventListeners`, the `AGENT_NOT_FOUND` branch of `silentRelogin`, and the `AgentLogoutSuccess` cleanup → T4;
  - types and builders → T1;
  - tests → T3.

## Multi-Repo Scope
N/A — single target repo (`webex/webex-js-sdk`, manifest `packages/@webex/contact-center/.sdd/manifest.json`).

## Dependencies / Execution Stream
| This task | Depends on (blocked-by) | Parallel-safe with | Wave / stream |
|---|---|---|---|
| T2 | T1 | — | 2 |

## Acceptance Criteria
- [x] `stationLogin` re-reads the flag and logs in on V2 or V1 with no fallback; the WebSocket handler and the promise path pin the same version.
- [x] `setAgentState` on V2 defaults, validates, applies the telephony-only voice check, and sends `stateChangeV2`; on V1 it drops `channelType`.
- [x] `stationLogout` and `silentRelogin` route by pin, else flag; the reload pins from the response type.
- [x] V2 reload restores the maps, recovers `agent-wss-disconnect` channels, and defers telephony on `BROWSER` without voice.
- [x] Channel events follow the three guards; the bridge emits V1 events only on a projection change.
- [x] `getChannelStates` returns copies or `{}`; `getAgentStateControl` returns `{declared, active}`.

## Verifier Exit Criteria
- [x] V1 unit tests pass unmodified.
- [x] No V1 retry anywhere in `stationLogin`.
- [x] Every `setTimeout` path for telephony is cleared by `clearV2LocalState`.
- [x] No new `console.*` calls; logging uses `LoggerProxy`.

## Traceability
| Requirement / rule id | Code symbol (class.method / file) | Test that proves it |
|---|---|---|
| R-1, R-11 | `ContactCenter.setAgentState`, `assertChannelsSelectable` | `setAgentState on a V2 session` (5) |
| R-2, R-4 | `getChannelStates`, `getAgentStateControl` | `getChannelStates`, `getAgentStateControl` |
| R-5, R-6, R-7 | `handleChannelStateChanged`, `handleWebsocketMessage`, `handleChannelReloginSuccess` | `handleChannelStateChanged` (9), `handleChannelReloginSuccess` (4) |
| R-8 | `aggregate.ts` | `aggregate.ts` (25) |
| R-9, R-10 | `stationLogin`, `refreshManageChannelAvailability`, early pin | `stationLogin` no-fallback (2), `profile flag refresh before login` (2), early pin (3) |
| R-12 | `shouldRouteV2`, `silentRelogin`, `stationLogout` | `session version pin (server wins)`, `stationLogout` routing |
| R-13 | `splitTelephonyRecovery`, `scheduleTelephonyRecovery` | `silentRelogin V2 recovery` (2), `scheduleTelephonyRecovery` (6) |

## Coverage Expectation
- Changed-line coverage within the package 85% global gate; evidence: CI coverage report.

## Cross-Cutting Prompts
- **Logging:** the login version decision, a failed flag re-read, recovery requests and deferral, a pin mismatch on `AgentChannelReloginSuccess`, and unknown channel types, all through `LoggerProxy`.
- **Metrics:** existing station-login and state-change metrics; no new names.
- **Security:** other agents' channel events ignored.
- **Idempotency:** the early pin and the promise pin set the same value; the timer is cleared before it is rescheduled.
- **Rollout:** profile flag only.

## Non-Goals / Out-of-Scope
- Lifecycle events and listener identity (T4).
- Application recovery policy (retries, login screen).
- Switching versions in the middle of a session.

## Feature-Flag & Rollout Assumptions
- Flag: `agentProfile.manageChannelAvailability` · default: off · assumption: backend V2 endpoints exist where the flag is on (Q-1).

## References
- Epic: [`./epic.md`](./epic.md) · Implementation plan: [`./implementation-plan-t2.md`](./implementation-plan-t2.md)
- Feature design: [`../../design/feature-design.md`](../../design/feature-design.md) · Coverage/contracts baseline: [`.sdd/manifest.json`](../../../../../.sdd/manifest.json)
