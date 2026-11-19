# Test Strategy — WXCC-15791: Granular Agent State Control V2

> Start here → package [`AGENTS.md`](../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../docs/specs/README.md) · system [`docs/architecture.md`](../../../docs/architecture.md). This plan proves the spec [`feature-spec.md`](spec/feature-spec.md) and the design [`feature-design.md`](design/feature-design.md).
> Context-efficiency: module-level verification lives in each module spec's Verification section; this file maps the feature's requirements to tests.

## Metadata

| Field | Value |
|---|---|
| Feature / ticket key | WXCC-15791 |
| Feature Spec | [`spec/feature-spec.md`](spec/feature-spec.md) |
| Feature Design | [`design/feature-design.md`](design/feature-design.md) |
| Generated from | `test-strategy` @ SDLC template library `0.2.0` |

## References
- Feature Spec: [`spec/feature-spec.md`](spec/feature-spec.md) (acceptance criteria, change class contract-affecting)
- Package architecture: [`docs/architecture.md`](../../../docs/architecture.md) · contracts: [`design/contracts/`](design/contracts/)
- Suites: `test/unit/spec/cc.ts`, `test/unit/spec/services/agent/aggregate.ts`, `test/unit/spec/services/agent/index.ts`, `test/unit/spec/services/config/Util.ts`

## Test Config Variables
| Variable | Possible values |
|---|---|
| `agentProfile.manageChannelAvailability` | `true` / `false` / absent |
| Pinned session version | `V1` / `V2` / unpinned |
| Reload response type | `AgentReloginSuccess` / `AgentChannelReloginSuccess` / `AGENT_NOT_FOUND` |
| `loginOption` (device type) | `BROWSER` / `EXTENSION` / `AGENT_DN` |
| Browser voice ready (`isVoiceReady`) | `true` / `false` |
| `allowAutomatedRelogin` | `true` / `false` |
| Channel capacity (`loginChannelsMap`) | with / without entries per channel |

## Use Cases → Tests
All tests are in `test/unit/spec/cc.ts` unless a suite is named.

| # | Use case / acceptance criterion | Positive case | Negative case (must NOT fire when it shouldn't) | Status |
|---|---|---|---|---|
| R-1 | Per-channel `setAgentState` | `routes the requested channels to stateChangeV2`; `selects every selectable channel with capacity when none are given` | `drops channelType and uses the V1 request on a V1 session` | pass |
| R-2 | `getChannelStates()` | `returns copies so callers cannot mutate SDK state`; `handleChannelStateChanged` map tests | `{}` after `clearV2LocalState` (`should reset channelStatesMap and loginChannelsMap`) | pass |
| R-4 | `getAgentStateControl()` | `reports the profile flag before login and after logout`; server-wins pin cases | `returns undefined declared before register()` | pass |
| R-5 | Channel state events | `should update channelStatesMap with V2 event data`; `should emit AGENT_CHANNEL_STATE_CHANGE` | `should ignore events for another agent`; `should ignore the event when session is not V2`; `should ignore when pinnedVersion is undefined (no session)`; `should ignore unknown channelType and not update channelStatesMap` | pass |
| R-6 | Channel failure event | `should emit AGENT_CHANNEL_STATE_CHANGE_FAILED for a channel failure` | — (no guard by design) | pass |
| R-7 | Channel relogin | `should pin session to V2`; `should restore channelStatesMap from data`; `should reset lastEmittedV1 from restored channel states`; `should emit AGENT_CHANNEL_RELOGIN_SUCCESS` | — | pass |
| R-8 | V2→V1 bridge | `aggregate.ts`: `projectAggregate` (any Available wins, primary-channel aux code), `bridgeStateChangeSuccess`; `cc.ts`: `should bridge to V1 AGENT_STATE_CHANGE and AGENT_STATE_CHANGE_SUCCESS when aggregate changes` | `should not emit V1 events when aggregate state did not change (dedup)`; `aggregate.ts` `shouldBridgeChannelState` rejects non-bridgeable states; `shouldEmitLegacyEvent` false when unchanged | pass |
| R-9 | Login version from re-read flag, no fallback | `profile flag refresh before login`: `routes to V1 when the re-fetched profile flag is false`; early pin `should pin V2 and seed channels when manageChannelAvailability is true` | `should reject without a V1 fallback when V2 login times out`; `should rethrow non-timeout V2 login errors without falling back to V1`; `keeps the cached flag when the re-fetch fails` | pass |
| R-10 | Eligibility `=== true` | `config/Util.ts`: `maps manageChannelAvailability true to true` | `false → false`, `undefined → false`; early pin `should pin V1 when manageChannelAvailability is false / undefined` | pass |
| R-11 | Channel validation | — | `rejects a channel without capacity before sending a request` | pass |
| R-12 | Server wins; reload and logout routing | `reloads on /v2 when unpinned and the flag is true, /v1 when the flag is false`; `reloads by the pinned version over the flag`; `pins V2 with declared true when the flag is true and the server returns V2`; `stationLogout` `routes by the flag when no session is pinned, and by the pin when set` | `pins V1 when the flag is true but the server returns V1`; `pins V2 when the flag is false but the server returns V2` | pass |
| R-13 | Recovery and telephony deferral | `silentRelogin V2 recovery`: `recovers only disconnected channels and defers telephony while browser voice is not ready`; `recovers telephony immediately when the device is not BROWSER`; `should fire setAgentState for deferred channels after timeout`; `should emit AGENT_CHANNEL_RECOVERY_DEFERRED before scheduling` | `should not fire setAgentState if session changed before timeout`; `... if session is no longer V2`; `should not fire if telephony is no longer in disconnect state`; `applies the voice-ready check only when telephony is requested`; `skips disconnected channels that are not selectable or have no capacity` | pass |
| R-14 | Sample app | Manual (sample spec) | Manual | manual |
| R-15 | Connection events | `emits connection lost without a relogin`; `emits reconnected before running the silent relogin`; `emits reconnected even when automated relogin is disabled` | `emits nothing for a keepalive with no state change` | pass |
| R-16 | Session not found | `clears the session and marks the agent logged out on AGENT_NOT_FOUND`; `should handle AGENT_NOT_FOUND error silently` | `does not emit session-not-found when the reload succeeds` | pass |
| R-17 | Cleanup and listener identity | `clearV2LocalState` (4: timer, maps, bridge memory, pin); `clears the V2 session on a logout success for this session only`; `clears the V2 session only for a current-session multi-login close`; `registers the same handler reference that deregister removes` | Logout success or multi-login close for another session keeps the pin (same tests) | pass |

## Contract Tests
| Scenario / interface | Consumer | Producer | CI stage |
|---|---|---|---|
| `stationLoginV2`, `stateChangeV2`, `logoutV2`, `reloadV2` builder paths, method, binds, error IDs (`services/agent/index.ts`, 4 tests) | SDK | Backend V2 API | PR unit |
| V2 notification shapes consumed by handlers (fixtures in `cc.ts`) | SDK | Backend WebSocket | PR unit |
| Profile flag mapping (`services/config/Util.ts`, 3 tests) | SDK | Desktop-login API | PR unit |
| Backend-side confirmation of paths and payloads (Q-1) | SDK | Backend | not automated |

## Integration Tests
| Scenario | Suite | Automated | In CI |
|---|---|---|---|
| Login, set channels, reconnect, and reload against a V2 backend | none | no | no |

## System / E2E Tests
| Scenario | Suite | Tags | CI stage |
|---|---|---|---|
| V2 agent: login, per-channel state, refresh, reconnect, logout through the sample app | not written (`cc_playwright` has no V2 suite) | — | — |

## Resiliency Tests
| Failure injected | Expected behavior | Suite | In CI |
|---|---|---|---|
| V2 login AQM timeout | Reject, no V1 call | `cc.ts` `stationLogin` | yes |
| Flag re-read failure | Cached flag used | `cc.ts` `profile flag refresh before login` | yes |
| Reload `AGENT_NOT_FOUND` | State cleared, logged out, event | `cc.ts` `session version pin (server wins)` | yes |
| Other reload error | Rethrown | `cc.ts` `should handle errors during silent relogin` | yes |
| Socket lost and reconnected | Events in order, relogin when enabled | `cc.ts` `handleConnectionLost` | yes |
| Browser voice not ready on reconnect | Telephony deferred, others recovered | `cc.ts` `silentRelogin V2 recovery` | yes |
| Timer after logout or manual change | No-op | `cc.ts` `scheduleTelephonyRecovery` | yes |
| No bridgeable channel | No V1 emit | `aggregate.ts` | yes |

## QA Dependencies
| Dependency (team / service / env / data) | Needed for | Ready? |
|---|---|---|
| Tenant with `manageChannelAvailability` per agent | Manual and E2E V2 runs | no (Q-1) |
| Backend V2 endpoints in integration env | Integration and E2E | no (Q-1) |

## E2E Framework & Location
- Framework: Playwright · Test directory: `cc_playwright/` (root `playwright.config.ts`, suites per `USER_SETS`) · Tag convention: suite per user set · Runs in CI: `yarn workspace @webex/contact-center test:e2e` (not in PR unit CI). No V2 suite yet.

## Coverage Summary
| Test type | Scenarios | Automated | In CI | Status |
|---|---|---|---|---|
| Unit: `aggregate.ts` | 25 | yes | yes | green |
| Unit: `cc.ts` V2 granular block (channel events 9, channel relogin 4, cleanup 4, getters 3, timer 6, seeding 5, V2 `setAgentState` 5, V2 recovery 2) | 38 | yes | yes | green |
| Unit: `cc.ts` login, logout, reload, lifecycle (no fallback 2, flag re-read 2, logout routing 1, early pin 3, own-session logout 1, server wins 7, listeners 2, connection events 4) | 22 | yes | yes | green |
| Unit: agent builders (`reloadV2`, `stationLoginV2`, `stateChangeV2`, `logoutV2`) | 4 | yes | yes | green |
| Unit: profile flag mapping | 3 | yes | yes | green |
| Integration / E2E | 0 | no | no | gap |
| Package coverage gate | 85% global (`jest.config.js`) | yes | yes | met: 96.2% lines, 89.4% branches, 92.1% functions (2026-11-19) |

Last run: 5 suites, 286 tests, all passing (`npx jest test/unit/spec/cc.ts test/unit/spec/services/agent/aggregate.ts test/unit/spec/services/agent/index.ts test/unit/spec/services/config/Util.ts test/unit/spec/index.ts --coverage=false`). Full package: 43 suites, 1534 tests; coverage 96.2% lines, 89.4% branches, 92.1% functions (gate 85%).

## Gaps / Risks
| Gap | Impact | Mitigation |
|---|---|---|
| No integration or E2E test against a V2 backend | Path or payload drift found late | Confirm Q-1; add a `cc_playwright` V2 suite before GA |
| Cross-channel ordering not asserted | Out-of-order UI updates | Backend does not guarantee order; the map is per channel |
| Sample app is manual-only | UI regressions | Sample spec checklist |
