# Feature Spec — WXCC-15791: Granular Agent State Control V2

> **Navigation:** [AGENTS.md](../../../AGENTS.md) → [SPEC_INDEX.md](../../../SPEC_INDEX.md) → [ARCHITECTURE.md](../../../ARCHITECTURE.md)

> Start here → repo [`AGENTS.md`](../../../AGENTS.md) · router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md). Then design [`feature-design.md`](../design/feature-design.md) → contracts [`design/contracts/`](../design/contracts/) → tests [`test-strategy.md`](../test-strategy.md) → tasks [`tasks/sdk-v2-agent-state/epic.md`](../tasks/sdk-v2-agent-state/epic.md).
> Link to canonical docs; this spec captures product intent only.

## Metadata
| Field | Value |
|---|---|
| Feature / ticket key | WXCC-15791 |
| Title | Granular Agent State Control V2 |
| Status | implemented on feature branch (not GA; Q-1 still open) |
| Change class | contract-affecting |
| created_by / approved_by / date | SDD intake / — / 2026-09-21 |
| Generated from | `feature-spec` @ SDLC template library `0.2.0` |

## Problem & Goal (WHAT + WHY)
**What:** Let `@webex/contact-center` set, query, and observe per-channel (Voice/`telephony`, Chat, Email, Social) agent availability through a V2 routing API, while V1 agent-wide behavior is unchanged.
**Why:** The backend now supports granular per-channel availability (available on Chat while idle on Voice) plus channel-level recovery after a WebSocket disconnect. The SDK today exposes only agent-wide V1 state, forcing an all-or-nothing model. V2 unlocks per-channel scheduling for SDK consumers (widgets, custom desktops).

## Stakeholders & Open Questions
| Stakeholder / role | Interest | Sign-off needed? |
|---|---|---|
| SDK consumers (widgets, custom desktops) | Need a V2 public API to build per-channel UI | yes |
| `@webex/contact-center` maintainers | Own the V2 implementation | yes |

**Open questions:**
- **Q-1 Are the V2 endpoints final on the backend?** — owner: backend API team — blocks: GA sign-off (not implementation; paths are centralized in `services/agent/index.ts`) — status: open.

## Scope
**In scope:**
- V2 types, request builders (`stationLoginV2`, `stateChangeV2`, `logoutV2`), and V2 SDK/WebSocket events. (`reloadV2` was dropped; the unified `reload()` branches on the server-chosen response type.)
- Session-version resolution + pinning, V2-aware login/logout/reload routing, per-channel recovery, and the deterministic V2→V1 event bridge (`services/agent/aggregate.ts`).
- Public getters `getChannelStates()`, `getAgentStateControl()`, and an optional `channelType[]` on `setAgentState`.
- `manageChannelAvailability` profile parsing; sample-app panel; unit tests.

**Out of scope:**
- Backend V2 API implementation (SDK is a consumer).
- Widget/desktop UI (separate repos).
- Runtime V1↔V2 toggle mid-session (version is pinned at login).
- Telephony/WebRTC internals (owned by `@webex/calling`; SDK only manages the deferral boundary).

**Open decisions:** none.

## Requirements
| Req ID | Requirement (WHAT) | Rationale (WHY) | Acceptance | State |
|---|---|---|---|---|
| R-1 | `setAgentState` accepts optional `channelType[]`; when the session is V2 it always routes through `stateChangeV2` (auto-selecting all selectable channels when none given), else V1 `stateChange`. | Per-channel availability without breaking V1 callers. | V2 session + `channelType` → V2 request; omitted → auto-select; V1 session → V1 request. | Implemented |
| R-2 | `getChannelStates()` returns a copy of the per-channel state map; `{}` when not a V2 session. Each entry includes `totalChannelCount` (capacity). | Consumers render per-channel UI. | Populated after V2 login; `{}` before login / V1 / after logout. | Implemented |
| R-4 | `getAgentStateControl()` returns `{declared, active}`. `declared` is the profile-derived V2 eligibility (`manageChannelAvailability`); `active` is whether V2 is active for this session (`true` when pinned V2, `false` when pinned V1, `undefined` before login). | Consumers choose V1 vs V2 UI. | Correct values before/after login; reset on logout. | Implemented |
| R-5 | Emit `agent:channelStateChange` on a V2 `AgentChannelStateChanged`; ignored when not V2; replace `channelStatesMap[channelType]` before emit. | Real-time per-channel UI. | Event payload per contract; no emit on V1. | Implemented |
| R-6 | Emit `agent:channelStateChangeFailed` on a V2 state-change failure (unconditional). | Surface per-channel failures. | Payload `{channelType, reason, reasonCode:number, isClientInitiated?, eventTime?}`. | Implemented |
| R-7 | Emit `agent:channelReloginSuccess` on a V2 reload; replace channel-state + capacity maps and pin V2. | Refresh full map after reconnect. | Full `AgentChannelReloginSuccess` payload; no bridged V1 relogin. | Implemented |
| R-8 | Bridge V2→V1: project an agent-wide `stateChangeSuccess` from channel states. Any Available wins. Scalar fields (`auxCodeId`, timestamps, reason) come from the first channel in `telephony → chat → email → social` whose state equals that projected subStatus. Emit again when `subStatus` or that aux code changes. | Existing V1 consumers keep working, including an idle-code change that stays Idle. | Deterministic projection in `aggregate.ts`; no duplicate emits for the same subStatus and aux code; `null` when nothing bridgeable. | Implemented |
| R-9 | Pin the session version at login (V2 when `manageChannelAvailability === true`; else V1); fall back once to V1 on a V2-login AQM timeout. | Stable routing for the whole session. | Pinned once; V2-aware login/logout/reload routing; V1 fallback on timeout. | Implemented |
| R-10 | Resolve V2 eligibility from profile `manageChannelAvailability` (the backend's V2 rollout signal for the SDK; never rejects; defaults V1). | Pin needs eligibility before login. | `true` → V2; `false`/absent → V1. | Implemented |
| R-11 | Validate requested channels are selectable before a V2 state change; reject with an SDK validation error otherwise. | Prevent invalid requests. | Non-selectable channel → validation error, no request sent. | Implemented |
| R-12 | After reconnect, reload and request disconnected channels (`stateChangeReason === 'agent-wss-disconnect'`) back to Available. | Re-sync channel states after a disconnect. | Disconnected channels recovered via `setAgentState`. | Implemented |
| R-13 | On `BROWSER` devices, defer telephony recovery when `webCallingService.isVoiceReady()` is false. Phase 1 uses a stored 60 s timer. The callback changes state only when the same V2 session is still logged in and telephony is still `agent-wss-disconnect`. The timer is cleared on `stationLogout`, `deregister`, and a remote logout for this session. A V2 Available request is blocked by the voice-ready check only when the request includes `telephony`. | Telephony recovery needs an active line, and a late timer must not change a later session. | Non-telephony recovered immediately; telephony deferred only while the line is not ready; callback no-ops after logout or a manual state change. | Implemented |
| R-14 | Sample app exposes a V2-aware agent state UI: a pill showing the current state, hover preview of per-channel states, a state menu with "Set as Available/Idle (all channels)" and "Manage channel availability" panel with per-channel toggles and Cancel/Apply. Exercises every V2 API (`setAgentState`, `getChannelStates`, `getAgentStateControl`) and reflects live events. Only the 4 selectable channels (Voice, Chat, Email, Social) are rendered. | Reference implementation. | V2/V1 detection; per-channel controls; live updates from `agent:channelStateChange` events. | Implemented |

## Acceptance Criteria
- V1 consumers (`manageChannelAvailability:false`) see unchanged `agent:stateChange`/`agent:stateChangeSuccess` (R-8, R-9).
- V2 consumers call `setAgentState({channelType})` and receive per-channel `agent:channelStateChange` (R-1, R-5).
- `getChannelStates`/`getAgentStateControl` return correct values after V2 login and `{}`/reset otherwise (R-2, R-4).
- V2 events bridge to a V1 `StateChangeSuccess` with no duplicate emits (R-8).
- Reconnect recovers channels; telephony deferred on BROWSER (R-12, R-13).
- Invalid channel selection is rejected client-side (R-11).
- Existing V1 unit tests stay green; new code keeps the package's 85% coverage gate (AGENTS.md).

## Success & Guardrail Metrics
| Metric | Type | Baseline | Target / bound | How measured |
|---|---|---|---|---|
| V1 consumer regressions | guardrail | 0 | 0 | Existing unit suite green, unmodified |
| V2 operation outcome + duration | success | n/a | tracked | Existing `MetricsManager` state-change events. This change does not add `fallbackOccurred` or `channelCount` metrics. |
| Build / unit pass rate | guardrail | 100% | 100% | CI |

## Prior-Work Register
| Existing artifact | How it relates | Reuse / extend / supersede |
|---|---|---|
| `services/agent/index.ts` (routingAgent factory) | V1 request builders | extend (add V2 builders) |
| `cc.ts` `ContactCenter` plugin | V1 login/logout/state/reload + event router | extend (fold V2 logic as private methods) |
| `services/config` profile parsing | Supplies `manageChannelAvailability` | extend |

## Contracts Delta
**Provides:** ADDED getters `getChannelStates`/`getAgentStateControl`; MODIFIED `setAgentState` (optional `channelType[]`); ADDED events `agent:channelStateChange(Failed)` + `agent:channelReloginSuccess` + `agent:channelRecoveryDeferred`; ADDED exported types `ChannelType`, `AgentChannelTypeStates`, `AgentChannelStateChanged`, `AgentChannelStateChangeFailed`, `AgentChannelReloginSuccess`, `AgentStateControlStatus`, `ChannelStateChangeRequest`. (`SessionVersion` is internal — not exported from the public API; consumers use `getAgentStateControl().active` instead.) Schema: [`design/contracts/`](../design/contracts/).
**Requires:** ADDED profile field `manageChannelAvailability`.

## Impacted Modules / Repos
| Module / repo | Impact | Manifest coverage state |
|---|---|---|
| `src/services/agent` | V2 types + request builders + new `aggregate.ts` (V2→V1 bridge) | Partial |
| `src/cc.ts` | V2 public API, event dispatch, session pinning, eligibility/channels/recovery folded in as private methods | Partial |
| `src/services/config` | V2 event constants + `manageChannelAvailability` parsing | Partial |
| `docs/samples/contact-center` | V2 panel | — |

## Feasibility & Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| V2 endpoint paths change before GA | med | high | Endpoint constants centralized in `services/agent/index.ts` |
| Bridge emits duplicate V1 events | low | med | `aggregate.ts` tracks last emitted state; tests assert single emit |
| Telephony recovery fires before line ready | med | med | BROWSER telephony is deferred only while `isVoiceReady()` is false; the stored timer no-ops unless the same V2 session still has telephony in `agent-wss-disconnect` |
| `manageChannelAvailability` dropped in parsing | med | high | Field declared on `AgentProfile` and mapped in `parseAgentConfigs()` |

## Interaction / Scenario Matrix
| Scenario | Expected behavior | Covered by |
|---|---|---|
| V1 session `setAgentState` | V1 request; V1 events only | R-1, R-8 |
| V2 session, no `channelType` | Auto-select all selectable channels, V2 request | R-1 |
| Mixed channel states bridged | any Available → agent Available; all Idle → Idle | R-8 |
| Unchanged aggregate | No V1 emit | R-8 |
| Reconnect with disconnected telephony on BROWSER | Non-telephony immediate; telephony deferred | R-12, R-13 |
| Non-selectable channel requested | Client-side validation error | R-11 |

## Migration Expectations
No breaking changes. V1 consumers work unmodified (default V1; V2 bridged to V1; `setAgentState` new arg optional). `setAgentState` may resolve with `AgentChannelStateChanged` on a V2 session. Profile fields added beside `manageChannelAvailability` (`showUserDetailsMS`, `stateSynchronizationMS`, `showUserDetailsWebex`, `stateSynchronizationWebex`, `thresholdRules`, `active`, `systemDefault`, `createdTime`, `lastUpdatedTime`) are optional. Opt into V2 via profile `manageChannelAvailability:true` + subscribing to the V2 events. The session version is pinned solely based on the agent profile's `manageChannelAvailability` flag. Rollback: backend sets the profile flag false.

## Public API & Semver Impact
Additive only → **minor** bump. New exports listed in Contracts Delta; no existing export removed or changed.

## Spec State
| Section | State |
|---|---|
| Problem & Goal | complete |
| Stakeholders & Open Questions | complete |
| Scope | complete |
| Requirements | complete |
| Acceptance Criteria | complete |
| Success & Guardrail Metrics | complete |
| Prior-Work Register | complete |
| Contracts Delta | complete |
| Impacted Modules | complete |
| Conditional sections | complete |

## Change Log
| Date | Change | By | Why |
|---|---|---|---|
| 2026-09-21 | Initial draft (14 requirements) | SDD intake | Capture |
| 2026-11-16 | Lean rewrite: fold channels/version/recovery/eligibility into `cc.ts` private methods, keep only `aggregate.ts`; trim to the shipped surface | review follow-up | Match implementation, reduce duplication |
| 2026-11-16 | Final pre-commit pass: timer guard, voice-ready scoped to telephony, bridge aux code, `PUT`, optional profile fields, honest test list | review follow-up | Docs match the code that will be committed |
| 2026-11-18 | Doc-impl alignment: R-4 trimmed to 2-field `{declared, active}`; `reloadV2` removed from scope (unified `reload()` used); `AGENT_CHANNEL_RECOVERY_DEFERRED` event added to Contracts Delta | final review | Match actual implementation before commit |

## References
- Feature design: [`../design/feature-design.md`](../design/feature-design.md) · decomposition: [`../tasks/`](../tasks/)
- Test plan: [`../test-strategy.md`](../test-strategy.md) · intake: `.generated/run-records/intake-questionnaire.md`
- Jira: https://jira-eng-sjc12.cisco.com/jira/browse/WXCC-15791
- Consumers: `webex-widgets/ai-docs/features/WXCC-15791-user-granular-agent-state/` depends on the getters, V2 events, and `setAgentState({channelType})`.
