# Contract — Reload, recovery, and session lifecycle events

> Start here → package [`AGENTS.md`](../../../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../../../docs/specs/README.md). This contract belongs to the design [`feature-design.md`](../feature-design.md); the standing catalog is the contract index in [`docs/architecture.md`](../../../../../docs/architecture.md) (`contact-center-agent-events`, `wxcc-api-gateway`).
> Context-efficiency: exact types live in the TypeScript sources linked below; this file pins routing, recovery, and event behavior.

## Metadata
| Field | Value |
|---|---|
| Interface | `routingAgent.reloadV2` / `reload` used by `silentRelogin`; events `agent:connectionLost`, `agent:connectionReconnected`, `agent:reloginSessionNotFound`, `agent:channelRecoveryDeferred` |
| Kind | network API (AQM) and event |
| Change type | new (`reloadV2`, the four events); modify (`silentRelogin` routing, pinning, recovery) |
| Producer | Backend (`wcc-api-gateway`); SDK `src/cc.ts` |
| Consumer(s) | Applications (`@webex/cc-widgets`, custom desktops, the sample app) |
| Canonical schema / API source | `src/services/agent/index.ts` (`reload`, `reloadV2`), `src/services/agent/types.ts` (`AGENT_EVENTS`, `AgentChannelReloginSuccess`, `ReloginSuccess`) |
| Feature | [`../feature-design.md`](../feature-design.md) |
| Generated from | `contract` @ SDLC template library `0.2.0` |

## Summary
The SDK runs the automated relogin after `register()` (page refresh) and after a socket reconnect when `allowAutomatedRelogin` is `true` (default). The relogin reloads the session on the right version, pins the server's version, restores channel state, and returns disconnected channels to Available. Four events tell the application what happened. Recovery policy stays with the application: retries, showing the login screen, and banners.

## Definition
- **Canonical source:** the builders and types listed in Metadata.
- **Endpoints:**

| Builder | Method and path | Success binds (`data.type`) | Failure |
|---|---|---|---|
| `reloadV2` | `POST /v2/agents/reload`, body `{}` | `AgentReloginSuccess` or `AgentChannelReloginSuccess` | `AgentReloginFailed` → `Service.aqm.agent.reload` |
| `reload` | `POST /v1/agents/reload`, body `{}` | same | same |

- **Routing:** `shouldRouteV2()` uses the pin when set, else `manageChannelAvailability === true`. After a refresh nothing is pinned, so the flag decides.
- **Pinning (server wins):** the response `data.type` decides, whatever endpoint was called:
  - `AgentChannelReloginSuccess` → pin V2;
  - `AgentReloginSuccess` → pin V1.
  The WebSocket handlers for the same notifications pin the same way.
- **V2 response handling:**
  1. Set `currentTeamId` and apply the device type.
  2. Replace `channelStatesMap` from `agentChannelStateDetailMap` and `loginChannelsMap` from `channelsMap`.
  3. Disconnected channels are those whose `stateChangeReason === 'agent-wss-disconnect'`, limited to selectable channels (`telephony`, `chat`, `email`, `social`) with capacity in `channelsMap`, so one invalid channel cannot reject the whole request.
  4. On `BROWSER` with `isVoiceReady()` false, recover the non-telephony channels now and defer telephony. Otherwise recover all of them now.
  5. "Recover" means `setAgentState({state: 'Available', auxCodeId: '0', lastStateChangeReason: 'agent-wss-disconnect', agentId, channelType})`.
  6. Set the V1 fields on `agentConfig` from the bridge, then `isAgentLoggedIn = true`.
- **V1 response handling (existing):** pin V1, then restore the timestamps, team, and device. When `lastStateChangeReason === 'agent-wss-disconnect'`, request Available on V1. Then `isAgentLoggedIn = true`. Channel maps are not touched; the getters return `{}` because the session is V1.
- **Telephony deferral (`scheduleTelephonyRecovery`):**
  1. Clear any earlier timer, remember the session id, emit `agent:channelRecoveryDeferred {channelTypes, agentId}`, and start a 60000 ms timer.
  2. When the timer fires, it sends Available for telephony only if all of these hold: still pinned V2, the same `agentSessionId`, and telephony's `stateChangeReason` is still `agent-wss-disconnect`.
  3. `clearV2LocalState` cancels the timer. That runs on logout, deregister, an own-session remote logout or multi-login close, and session not found.
- **Session lifecycle events:**

| Constant | String | Payload | Emitted when |
|---|---|---|---|
| `AGENT_CONNECTION_LOST` | `agent:connectionLost` | `{}` | ConnectionService reports `isConnectionLost` |
| `AGENT_CONNECTION_RECONNECTED` | `agent:connectionReconnected` | `{}` | ConnectionService reports `isSocketReconnected`, before the relogin; also when `allowAutomatedRelogin` is `false` |
| `AGENT_RELOGIN_SESSION_NOT_FOUND` | `agent:reloginSessionNotFound` | `{agentId}` | The reload fails with `AGENT_NOT_FOUND` |
| `AGENT_CHANNEL_RECOVERY_DEFERRED` | `agent:channelRecoveryDeferred` | `{channelTypes: ChannelType[], agentId}` | Telephony recovery is deferred |

- **Session not found:** the SDK runs `clearV2LocalState()`, sets `agentConfig.isAgentLoggedIn = false`, and emits the event. `silentRelogin` then returns normally, so `register()` resolves with `isAgentLoggedIn` falsy.

## Error / Failure Catalog
| Condition | Code / signal | Meaning | Consumer action |
|---|---|---|---|
| No server session | `agent:reloginSessionNotFound {agentId}`; `isAgentLoggedIn` false | The agent is logged out on the server (also fires when the agent never logged in) | Clear session UI and show station login. On page load the event can fire before listeners attach, so also check the `register()` result |
| Other reload failure | `Service.aqm.agent.reload`; `register()` rejects; on reconnect the error is not caught | Session not restored | On register: show the error and retry. On reconnect: listen for `agent:connectionReconnected` and re-check |
| Recovery state change fails | error log; no throw | That channel stays idle | Agent sets the state manually |
| Deferred telephony: voice still not ready | error log (`NOT_READY`) | Telephony stays idle | Agent sets it when voice is ready |
| Timer fires after logout or a manual change | no-op | Guards held | none |
| Socket lost | `agent:connectionLost` | Notifications stopped | Show "reconnecting"; avoid state calls |
| Automated relogin off | `agent:connectionReconnected` only | SDK will not reload | App decides (for example `register()` again) |

## Backward Compatibility
- **Compatible?** yes — the events are additive. Relogin behavior on V1 sessions matches `next`. V2 adds pinning, map restore, and per-channel recovery.
- **Consumer transition / deprecation:** none required. Apps that previously had no signal for a lost session can listen for `agent:reloginSessionNotFound`. Semver minor.

## Delivery & Ordering Guarantees
- On a reconnect, `agent:connectionReconnected` is emitted before any reload request. Then exactly one of these follows: the relogin events (`agent:reloginSuccess` or `agent:channelReloginSuccess` from the WebSocket), `agent:reloginSessionNotFound`, or an error.
- Keepalive status messages emit nothing.
- `handleConnectionLost` is one stable arrow-function reference. `deregister()` removes the same listener that `register()` added, so repeated register and deregister cycles do not stack reloads.

## Versioning
- `/v1` vs `/v2` reload chosen by pin, else flag. Either endpoint can return either response type; the response type is authoritative.

## Validation
- `test/unit/spec/services/agent/index.ts`: `reload`, `reloadV2`.
- `test/unit/spec/cc.ts`:
  - `silentRelogin` › `session version pin (server wins)` (7): routing by flag when unpinned; pin over flag; `AGENT_NOT_FOUND` clears and emits; no emit on success; the three server-wins pin cases.
  - `silentRelogin V2 recovery` (2): BROWSER without voice recovers chat and defers telephony; EXTENSION recovers both at once.
  - `scheduleTelephonyRecovery` (6): deferred event, fires after the timeout, no-op when the session changed, unpinned, or no longer disconnected; clears an earlier timer.
  - `handleConnectionLost` (4): lost; reconnected before the relogin; reconnected with relogin off; keepalive emits nothing.
  - `setupEventListeners()` (2): registration and same handler reference on deregister.
- Not covered: an end-to-end reconnect against a backend (no integration suite).

## References
- Feature design: [`../feature-design.md`](../feature-design.md) · Standing catalog: [`docs/architecture.md`](../../../../../docs/architecture.md) · Owning module specs: [`src/docs/README.md`](../../../../../src/docs/README.md) (Recovery), [`src/services/agent/docs/README.md`](../../../../../src/services/agent/docs/README.md) (Recovery reload; Refresh and reconnect: SDK vs application) · Baseline: [`.sdd/manifest.json`](../../../../../.sdd/manifest.json)
- Related: [`v2-events.md`](v2-events.md), [`v2-state-change.md`](v2-state-change.md)
