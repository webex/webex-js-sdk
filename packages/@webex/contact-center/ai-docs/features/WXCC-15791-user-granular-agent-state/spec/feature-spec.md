# Feature Spec — WXCC-15791: Granular Agent State Control V2

> Start here → package [`AGENTS.md`](../../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../../docs/specs/README.md) · system [`docs/architecture.md`](../../../../docs/architecture.md). Then this spec → design [`feature-design.md`](../design/feature-design.md) → test plan [`test-strategy.md`](../test-strategy.md).
> Context-efficiency: this spec owns product intent (WHAT and WHY). The technical solution is in the feature design, and exact interfaces are in [`design/contracts/`](../design/contracts/).

## Metadata
| Field | Value |
|---|---|
| Feature / ticket key | WXCC-15791 |
| Title | Granular Agent State Control V2 |
| Status | implementation-ready (implemented on `feature/WXCC-15791-Support-Granular-Agent-State`; GA blocked on Q-1) |
| Change class | contract-affecting |
| created_by / approved_by / date | SDD intake / pending / 2026-09-21, revised 2026-11-19 |
| Generated from | `feature-spec` @ SDLC template library `0.2.0` |

## Problem & Goal (WHAT + WHY)
**What:** Let `@webex/contact-center` consumers set, read, and observe agent availability per channel (Voice as `telephony`, Chat, Email, Social) through the V2 routing API, while V1 agent-wide behavior keeps working unchanged.

**Why:** The backend supports per-channel availability (for example, Available on Chat while Idle on Voice) and per-channel recovery after a WebSocket disconnect. The SDK only exposed one agent-wide V1 state, so widgets and custom desktops could not offer per-channel control. The agent profile flag `manageChannelAvailability` decides which model an agent uses.

## Stakeholders & Open Questions
| Stakeholder / role | Interest in this feature | Sign-off needed? |
|---|---|---|
| SDK consumers (`@webex/cc-widgets`, custom desktops) | Public V2 API to build per-channel UI | yes |
| `@webex/contact-center` maintainers | Own the implementation and the new public events | yes |
| WXCC backend routing team | Owns the V2 endpoints and notifications | yes (Q-1) |
| wxcc-desktop team | Reference behavior this SDK matches | no |

**Open questions:**
- **Q-1 Are the V2 endpoints and notification shapes final?** — owner: backend routing team — blocks: GA sign-off, not implementation (paths are centralized in `src/services/agent/index.ts`) — status: open.
- **Q-2 Are the new event names `agent:reloginSessionNotFound`, `agent:connectionLost`, `agent:connectionReconnected` approved?** — owner: SDK maintainers — blocks: merge — status: open.

## Scope
**In scope:**
- V2 types, request builders (`stationLoginV2`, `stateChangeV2`, `logoutV2`, `reloadV2`), and V2 WebSocket and SDK events.
- Choosing the session version at login from the profile flag, re-read before each login; pinning it for the session; routing state change, logout, and reload by that pin.
- Per-channel recovery after reconnect, including deferring telephony on `BROWSER` until the voice line is ready.
- The V2→V1 event bridge so V1 listeners keep working on a V2 session.
- Public getters `getChannelStates()` and `getAgentStateControl()`, and the optional `channelType[]` on `setAgentState`.
- Refresh and reconnect boundary: the SDK keeps running the automated relogin and tells the application about connection loss, reconnect, and a missing server session.
- Unit tests and the sample-app reference UI (its own spec: [`docs/samples/contact-center/ai-docs/features/WXCC-15791-granular-agent-state-sample/spec/feature-spec.md`](../../../../../../../docs/samples/contact-center/ai-docs/features/WXCC-15791-granular-agent-state-sample/spec/feature-spec.md)).

**Out of scope:**
- The backend V2 API itself (the SDK is a consumer).
- Widget and desktop UI (separate repositories).
- Switching between V1 and V2 in the middle of a session; a profile change applies at the next login.
- SDK feature flags or config overrides for V2; the profile flag is the only switch.
- Application recovery policy: reload retries, an automatic `stationLogin`, the login screen, and banners.
- WebRTC line internals (owned by `@webex/calling`).

**Open decisions:** none.

## Requirements
| Req ID | Requirement (WHAT) | Rationale (WHY) | Acceptance (how proven) | State |
|---|---|---|---|---|
| R-1 | `setAgentState` accepts an optional `channelType[]`. On a V2 session it always sends `PUT /v2/agents/session/state`, selecting every selectable channel that has capacity when none are given. On a V1 session it drops `channelType` and sends the V1 request. | Per-channel control without breaking V1 callers. | V2 + channels → V2 request with those channels; V2 + none → all channels with capacity; V1 → V1 request without `channelType`. | Verified |
| R-2 | `getChannelStates()` returns copies of the per-channel state entries, and `{}` when the session is not V2. | Consumers render per-channel UI and must not mutate SDK state. | Populated on a V2 session; `{}` before login, on V1, and after logout; mutating the result leaves SDK state unchanged. | Verified |
| R-3 | (Dropped) A separate channel-capacity getter. | Capacity is already in each entry as `totalChannelCount`. | — | Dropped |
| R-4 | `getAgentStateControl()` returns `{declared, active}`. `declared` is computed from the current profile `manageChannelAvailability` whenever a profile is loaded, and is `undefined` only before `register()`. `active` is `true` when the session is pinned V2, `false` when pinned V1, and `undefined` with no session. | Consumers choose the V1 or V2 UI and detect a flag change that has not applied yet. | Correct before login, during a session, and after logout. | Verified |
| R-5 | On a V2 `AgentChannelStateChanged` for this agent, replace that channel's entry and emit `agent:channelStateChange`. Ignore it when the session is not V2, when it is about another agent, or when the channel is not selectable. | Real-time per-channel UI; the AQM bind also matches routing messages for other agents. | Map updated and event emitted; no update or emit for V1, other agents, or unknown channels. | Verified |
| R-6 | Emit `agent:channelStateChangeFailed` for every V2 state-change failure. | Surface per-channel failures. | Payload `{channelType, reason, reasonCode, isClientInitiated?, eventTime?}`. | Verified |
| R-7 | On `AgentChannelReloginSuccess`, pin V2, replace the channel-state and capacity maps, and emit `agent:channelReloginSuccess`. | Refresh the full map after a reload. | Full payload emitted; no bridged V1 `agent:reloginSuccess` for a V2 reload. | Verified |
| R-8 | Bridge V2 to V1: project one agent-wide `agent:stateChange` and `agent:stateChangeSuccess` from the channel states. Any Available wins. Scalar fields come from the first channel in `telephony → chat → email → social` whose state equals the projected subStatus. Emit again only when the subStatus or that aux code changes. | Existing V1 listeners keep working, including an idle-code change that stays Idle. | Deterministic projection; no duplicate emits; nothing emitted when no channel is Available or Idle. | Verified |
| R-9 | Before each login, re-read `manageChannelAvailability` from the user desktop-login API (keep the cached value if that call fails). Log in on V2 when it is `true`, else V1, and pin that version. A V2 login failure, including an AQM timeout, rejects with no V1 retry. | One routing decision per session, the same as wxcc-desktop; a profile change applies on the next login without a new `register()`. | Flag re-read before the login request; V2 timeout rejects without a V1 call. | Verified |
| R-10 | V2 eligibility is `manageChannelAvailability === true`; absent or `false` means V1. | The profile flag is the backend's only V2 signal to the SDK. | `true` → V2; `false` or absent → V1. | Verified |
| R-11 | Before a V2 state change, reject requested channels that are not selectable or have no capacity with an SDK validation error, without sending a request. | Prevent invalid requests. | Error thrown, no request sent. | Verified |
| R-12 | A reload pins the version from the server's response type (the server keeps the session version). Reload and logout route by the pinned version, or by the profile flag when nothing is pinned (after a refresh). | The server decides the version of an existing session; the profile flag can differ until the agent signs in again. | `/v2` vs `/v1` reload and logout chosen by pin, else flag; V2 response pins V2 even when the flag is false, and the reverse. | Verified |
| R-13 | After a V2 reload, request Available for channels whose `stateChangeReason` is `agent-wss-disconnect`, limited to selectable channels with capacity. On `BROWSER`, when the voice line is not ready, defer telephony with a 60 s timer and emit `agent:channelRecoveryDeferred`. The timer only acts if the same V2 session is still logged in and telephony is still disconnected; logout, deregister, and a remote logout for this session cancel it. The voice-ready check on a V2 Available request applies only when the request includes `telephony`. | Telephony needs a working line, and a late timer must not change a later session. | Non-telephony recovered at once; telephony deferred only while the line is not ready; timer no-ops after logout or a manual change. | Verified |
| R-14 | The sample app shows a V2 agent-state UI with per-channel control, per-channel RONA alerts, telephony Available blocked while the voice line is down, a version-mismatch banner, and connection and session status. | Reference implementation for integrators. | See the sample spec. | Implemented |
| R-15 | The SDK keeps running the automated relogin on page refresh (`register()`) and on socket reconnect when `allowAutomatedRelogin` is set (default `true`). It emits `agent:connectionLost` when the socket drops and `agent:connectionReconnected` before the relogin, including when automated relogin is off. | Only the SDK can rebuild its session pin and channel map; applications still need to know about transport changes. | Events emitted in that order; no emit for keepalives. | Verified |
| R-16 | When the reload finds no server session (`AGENT_NOT_FOUND`), clear the session pin and channel state, set `isAgentLoggedIn` to `false`, and emit `agent:reloginSessionNotFound` with `{agentId}`. | On reconnect the application otherwise still believes the agent is logged in. | State cleared, flag false, event emitted once; not emitted on a successful reload. | Verified |
| R-17 | Clear the session pin, channel state, and telephony timer on `stationLogout`, `deregister`, and an `AgentLogoutSuccess` or `AgentMultiLoginCloseSession` for this session. `deregister()` removes the same `connectionLost` handler that `register()` added. | Stale state must not leak into a later session; duplicate handlers would repeat reloads and recovery requests. | State cleared on each path; handler identity matches. | Verified |

## Acceptance Criteria
- An agent whose profile flag is `false` sees unchanged V1 behavior and events (R-1, R-8, R-10).
- An agent whose profile flag is `true` logs in on V2, sets channels with `setAgentState({channelType})`, and receives `agent:channelStateChange` per channel plus bridged V1 events (R-1, R-5, R-8, R-9).
- A profile flag change takes effect on the next login without a new `register()` (R-9).
- After a refresh or reconnect, the SDK reloads with the right version, restores the channel map, and recovers disconnected channels; telephony on `BROWSER` waits for the line (R-12, R-13, R-15).
- When the server has no session, the application gets `agent:reloginSessionNotFound` and `isAgentLoggedIn` is `false` (R-16).
- Invalid channel selections are rejected without a request (R-11).
- `getChannelStates()` and `getAgentStateControl()` report the session correctly before login, during it, and after logout (R-2, R-4, R-17).
- Existing V1 unit tests pass unmodified (guardrail).

## Success & Guardrail Metrics
| Metric | Type (success / guardrail) | Baseline | Target / bound | How measured |
|---|---|---|---|---|
| V1 consumer regressions | guardrail | 0 | 0 | Existing unit suites pass unmodified |
| V2 state-change outcome and duration | success | n/a | tracked | Existing `AGENT_STATE_CHANGE_SUCCESS` / `_FAILED` metrics (no new metric names added) |
| Station login outcome | guardrail | current rate | no regression | Existing `STATION_LOGIN_SUCCESS` / `_FAILED` metrics; V2 login errors now surface instead of falling back |
| Unit pass rate | guardrail | 100% | 100% | CI (`yarn workspace @webex/contact-center test:unit`) |

## Prior-Work Register
| Existing artifact (path / feature / spec) | How it relates | Reuse / extend / supersede |
|---|---|---|
| `src/services/agent/index.ts` (`routingAgent`) | V1 request builders | extend with V2 builders |
| `src/cc.ts` (`ContactCenter`) | V1 login, logout, state, reload, and the WebSocket event router | extend with V2 branches and private helpers |
| `src/cc.ts` `silentRelogin` and `handleConnectionLost` (on `next`) | Automated relogin on refresh and reconnect | extend (V2 reload, pin, recovery, new events) |
| `src/services/config/Util.ts` `parseAgentConfigs` | Builds the `Profile` | extend with `manageChannelAvailability` |
| wxcc-desktop session flow | Reference for flag-only login, no V1 fallback, version-routed reload and logout | reuse as behavior reference |

## Contracts Delta
**Provides:**
- ADDED public methods `getChannelStates()` and `getAgentStateControl()`.
- MODIFIED `setAgentState`: optional `channelType[]`; on a V2 session it may resolve with `AgentChannelStateChanged`.
- ADDED events `agent:channelStateChange`, `agent:channelStateChangeFailed`, `agent:channelReloginSuccess`, `agent:channelRecoveryDeferred`, `agent:reloginSessionNotFound`, `agent:connectionLost`, `agent:connectionReconnected`.
- ADDED exported types `ChannelType`, `AgentChannelTypeStates`, `AgentChannelStateChanged`, `AgentChannelStateChangeFailed`, `AgentChannelReloginSuccess`, `ChannelStateChangeRequest`, `AgentStateControlStatus`. `SessionVersion` stays internal.
- ADDED `routingAgent` builders `stationLoginV2`, `stateChangeV2`, `logoutV2`, `reloadV2`.
- MODIFIED behavior: a V2 login failure no longer retries on V1.

**Requires:**
- ADDED backend endpoints `POST /v2/agents/login`, `PUT /v2/agents/session/state`, `POST /v2/agents/logout`, `POST /v2/agents/reload`, and notifications `AgentChannelStateChanged`, `AgentChannelStateChangeFailed`, `AgentChannelReloginSuccess`. Fallback: none; V2 is used only when the profile flag is `true`.
- ADDED profile field `agentProfile.manageChannelAvailability` from the user desktop-login API, re-read before each login; a failed re-read keeps the cached value.

Full schemas: [`design/contracts/`](../design/contracts/).

## Impacted Modules / Repos
| Module / repo | Impact | Manifest coverage state |
|---|---|---|
| `src/` (`cc.ts`, `index.ts`, `types.ts`) | V2 public API, session pinning, routing, recovery, event dispatch, new events, exports | Partial |
| `src/services/agent/` | V2 types and builders; new `aggregate.ts` (V2→V1 bridge); new `AGENT_EVENTS` | Partial |
| `src/services/config/` | V2 `CC_AGENT_EVENTS`; `manageChannelAvailability` on `AgentProfile` and `Profile` | Partial |
| `src/services/core/` | New AQM error IDs in `Err.ts` | Partial |
| `docs/samples/contact-center` | Reference UI | not in manifest |

## Feasibility & Risks
- **Feasibility:** implemented and unit-tested on the feature branch.
- **Spikes needed:** none.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| V2 endpoint paths or payloads change before GA (Q-1) | med | high | Paths centralized in `src/services/agent/index.ts`; contracts list the exact shapes |
| V2 login outage blocks agents with the flag on | low | high | Matches wxcc-desktop; rollback is the profile flag; error surfaces to the caller |
| Bridge emits duplicate V1 events | low | med | `aggregate.ts` compares subStatus and aux code with the last emit; tests assert one emit |
| Late telephony timer changes a later session | low | med | Timer checks session id, V2 pin, and telephony reason; cleared on logout paths |
| Server session version differs from the flag after a profile change | med | low | Server wins on reload; `getAgentStateControl()` exposes the mismatch; sample shows a banner |

## Interaction / Scenario Matrix
| Scenario / condition combination | Expected behavior | Covered by (Req / test) |
|---|---|---|
| Flag `false` × `setAgentState` with `channelType` | V1 request without `channelType` | R-1 / `setAgentState on a V2 session` |
| Flag `true` × no `channelType` | All selectable channels with capacity, V2 request | R-1 / same |
| Channel without capacity requested | Validation error, no request | R-11 / same |
| `BROWSER` voice not ready × Available on chat only | Allowed | R-13 / same |
| `BROWSER` voice not ready × Available including telephony | Rejected with voice-not-ready | R-13 / same |
| Flag changed between logins | New flag used at next login | R-9 / `profile flag refresh before login` |
| Flag re-read fails | Cached flag used | R-9 / same |
| V2 login timeout | Reject, no V1 call | R-9 / `stationLogin` |
| Refresh, server session V2, flag `false` | Reload on `/v1`, pin V2 from the response; `declared` false, `active` true | R-12 / `session version pin (server wins)` |
| Reconnect × server session gone | State cleared, `isAgentLoggedIn` false, `agent:reloginSessionNotFound` | R-16 / same |
| Reconnect × `allowAutomatedRelogin: false` | `agent:connectionReconnected` only, no reload | R-15 / `handleConnectionLost` |
| Channel event for another agent | Ignored | R-5 / `handleChannelStateChanged` |
| Mixed Available and Idle channels | Bridged Available | R-8 / `aggregate.ts` |
| Remote logout for this session | V2 state cleared before `agent:logoutSuccess` | R-17 / `handleWebsocketMessage events` |

## Product-Requested Data / Fields
| Field | Meaning / requirement |
|---|---|
| `AgentProfile.manageChannelAvailability` / `Profile.manageChannelAvailability` | `true` enables V2 for this agent; anything else means V1 |
| `AgentChannelTypeStates.totalChannelCount` | Channel capacity; replaces the dropped capacity getter (R-3) |
| `AgentStateControlStatus.declared` / `.active` | Profile intent vs the pinned session version |
| Other new optional `AgentProfile` fields (`showUserDetailsMS`, `stateSynchronizationMS`, `showUserDetailsWebex`, `stateSynchronizationWebex`, `thresholdRules`, `active`, `systemDefault`, `createdTime`, `lastUpdatedTime`) | Typed for completeness; the SDK does not read them |

## Migration Expectations
- No breaking change for V1 consumers: the new `setAgentState` argument is optional and V2 activity is bridged to V1 events.
- Consumers opt into V2 UI by reading `getAgentStateControl().active` and subscribing to the V2 events.
- One behavior change: a V2 login failure now rejects instead of retrying on V1.
- Rollback: the backend sets the profile flag to `false`; it applies at the agent's next login.

## Rollout & Flags
| Flag | Purpose | Default | New/Existing |
|---|---|---|---|
| `agentProfile.manageChannelAvailability` (backend profile) | Selects V2 per agent | `false` / absent → V1 | Existing backend field, newly read |
| `allowAutomatedRelogin` (SDK config) | Runs the relogin on refresh and reconnect | `true` | Existing |

## Serviceability
- Logs: the login version decision, a failed flag re-read, a V2 reload pin, recovery requests and deferral, a pin mismatch on `AgentChannelReloginSuccess`, unknown channel types, and `AGENT_NOT_FOUND`.
- Metrics: existing station-login, state-change, and WebSocket-event metrics; no new names.
- Events for applications: the seven new events in Contracts Delta.

## Documentation Obligations
- Module specs: `src/docs/README.md`, `src/services/agent/docs/README.md`, `src/services/config/docs/README.md`.
- Contract index in `docs/architecture.md`.
- Sample-app feature spec.
- Typedoc comments on the new public methods and events.

## Event Contract
- Consumed: `AgentChannelStateChanged`, `AgentChannelStateChangeFailed`, `AgentChannelReloginSuccess` (new); `AgentStationLoginSuccess`, `AgentReloginSuccess`, `AgentLogoutSuccess` (now also update the session pin).
- Published: the seven new `agent:*` events; `agent:stateChange` / `agent:stateChangeSuccess` are also produced by the bridge on V2 sessions.
- Cross-channel ordering is not guaranteed. Details: [`v2-events.md`](../design/contracts/v2-events.md), [`v2-reload.md`](../design/contracts/v2-reload.md).

## Public API & Semver Impact
- Additive exports and events, plus one behavior change (no V1 login fallback), which only affects agents with the V2 flag on. Semver: **minor**.
- API detail source: `src/index.ts`, `src/services/agent/types.ts`, typedoc.

## Spec State
| Section | State (complete / partial / pending / N/A) |
|---|---|
| Problem & Goal | complete |
| Stakeholders & Open Questions | complete (Q-1, Q-2 open) |
| Scope | complete |
| Requirements | complete |
| Acceptance Criteria | complete |
| Success & Guardrail Metrics | complete |
| Prior-Work Register | complete |
| Contracts Delta | complete |
| Impacted Modules | complete |
| Conditional sections (as triggered) | complete (Scale, Compliance, UI Flow, API Contract, and Cross-Package omitted: not perf-critical, no new security surface, no SDK UI, HTTP contracts are consumed and listed under Requires, single package) |

## Change Log
| Date | Change | By | Why |
|---|---|---|---|
| 2026-09-21 | Initial draft (14 requirements) | SDD intake | Capture |
| 2026-11-16 | Folded eligibility, channels, recovery, and version helpers into `cc.ts`; kept `aggregate.ts` | review follow-up | Match implementation |
| 2026-11-16 | Timer guard, voice check scoped to telephony, bridge aux code, `PUT` state change, optional profile fields | review follow-up | Match implementation |
| 2026-11-18 | R-4 trimmed to `{declared, active}`; `agent:channelRecoveryDeferred` added | final review | Match implementation |
| 2026-11-19 | wxcc-desktop parity: flag re-read before login, no V1 fallback, reload and logout routed by pin else flag, `reloadV2` restored; `declared` from the current profile | desktop comparison | Match wxcc-desktop |
| 2026-11-19 | Refresh and reconnect boundary: R-15, R-16, R-17; new connection and session-not-found events; `connectionLost` handler removed on deregister | SDK vs application review | Applications learn about session loss without the SDK owning recovery policy |
| 2026-11-19 | Rewritten to the template heading order; R-3 recorded as dropped; requirement states set from the unit-test inventory | doc review | Template conformance and traceability |

## References
- Feature design: [`../design/feature-design.md`](../design/feature-design.md) · decomposition: [`../tasks/sdk-v2-agent-state/epic.md`](../tasks/sdk-v2-agent-state/epic.md)
- Package architecture: [`docs/architecture.md`](../../../../docs/architecture.md) · module specs: [`src/docs/README.md`](../../../../src/docs/README.md), [`src/services/agent/docs/README.md`](../../../../src/services/agent/docs/README.md), [`src/services/config/docs/README.md`](../../../../src/services/config/docs/README.md)
- Test plan: [`../test-strategy.md`](../test-strategy.md) · intake: [`../.generated/run-records/intake-questionnaire.md`](../.generated/run-records/intake-questionnaire.md)
- Jira: [WXCC-15791](https://jira-eng-sjc12.cisco.com/jira/browse/WXCC-15791)
- Consumer: `webex-widgets/ai-docs/features/WXCC-15791-user-granular-agent-state/` uses the getters, V2 events, and `setAgentState({channelType})`.
