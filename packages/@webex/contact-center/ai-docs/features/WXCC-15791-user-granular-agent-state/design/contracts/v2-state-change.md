# Contract — V2 login, state change, and logout

> Start here → package [`AGENTS.md`](../../../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../../../docs/specs/README.md). This contract belongs to the design [`feature-design.md`](../feature-design.md); the standing catalog is the contract index in [`docs/architecture.md`](../../../../../docs/architecture.md) (`contact-center-sdk`, `wxcc-api-gateway`).
> Context-efficiency: exact types live in the TypeScript sources linked below; this file pins routing and failure behavior.

## Metadata
| Field | Value |
|---|---|
| Interface | `stationLogin` → `stationLoginV2` / `stationLogin`; `setAgentState({channelType?})` → `stateChangeV2` / `stateChange`; `stationLogout` → `logoutV2` / `logout` |
| Kind | network API (AQM: HTTP request completed by a WebSocket notification) plus the public SDK methods |
| Change type | new (V2 builders); modify (`setAgentState` argument, login routing, logout routing) |
| Producer | Backend (`wcc-api-gateway`); SDK `src/cc.ts`, `src/services/agent/index.ts` |
| Consumer(s) | Applications calling `webex.cc` |
| Canonical schema / API source | `src/services/agent/index.ts` (builders), `src/services/agent/types.ts` (`StateChange`, `ChannelStateChangeRequest`, `ChannelType`), `src/services/core/Err.ts` (error IDs), `src/types.ts` (`SetStateResponse`) |
| Feature | [`../feature-design.md`](../feature-design.md) |
| Generated from | `contract` @ SDLC template library `0.2.0` |

## Summary
Login chooses V1 or V2 once from the profile flag and pins it. State change and logout route by the pin, and logout falls back to the flag when nothing is pinned. A V2 state change targets a list of channels.

## Definition
- **Canonical source:** the builders and types listed in Metadata.
- **Endpoints:**

| Builder | Method and path | Success notification (`data.type`) | Failure notification / error ID |
|---|---|---|---|
| `stationLoginV2` | `POST /v2/agents/login` | `AgentStationLoginSuccess` | `AgentStationLoginFailed` → `Service.aqm.agent.stationLoginV2Failed`; HTTP error → `Service.aqm.agent.stationLoginV2` |
| `stationLogin` (V1) | `POST /v1/agents/login` | same | `Service.aqm.agent.stationLoginFailed` |
| `stateChangeV2` | `PUT /v2/agents/session/state` | `AgentChannelStateChanged` (outer `AgentRequestEvent`, `RoutingMessage`, or `AgentChannelStateChange`) | `AgentChannelStateChangeFailed` → `Service.aqm.agent.stateChangeV2` |
| `stateChange` (V1) | `PUT /v1/agents/session/state` | `AgentStateChangeSuccess` | `Service.aqm.agent.stateChange` |
| `logoutV2` | `POST /v2/agents/logout` | `AgentLogoutSuccess` | `AgentLogoutFailed` → `Service.aqm.agent.logoutV2` |
| `logout` (V1) | `POST /v1/agents/logout` | same | `Service.aqm.agent.logout` |

- **Login routing (`stationLogin`):**
  1. The existing dial-number check runs first.
  2. `refreshManageChannelAvailability()` re-reads `agentProfile.manageChannelAvailability` from the user desktop-login API. If that call fails, the cached value is kept.
  3. `manageChannelAvailability === true` → `stationLoginV2`, else `stationLogin`. There is no fallback in either direction.
  4. The `AgentStationLoginSuccess` WebSocket handler pins the same version before emitting `agent:stationLoginSuccess`, and seeds `loginChannelsMap` and `channelStatesMap` on V2. The promise path then pins and seeds again (idempotent).
- **State change request (`ChannelStateChangeRequest`, V2):** `{channelType: ChannelType[], state, auxCodeId, reason?: lastStateChangeReason, agentId: data.agentId ?? agentConfig.agentId}`.
- **State change routing (`setAgentState`):**
  - Pinned V2:
    1. `channels = data.channelType` when non-empty, else every selectable channel (`telephony`, `chat`, `email`, `social`) with at least one entry in `loginChannelsMap`.
    2. `assertChannelsSelectable` validates `channels`.
    3. When `state === 'Available'` and `channels` includes `telephony`, the browser voice-ready check runs.
    4. Then `stateChangeV2` is sent.
  - V1 or unpinned: the voice-ready check runs for any Available request; `channelType` is removed and `stateChange` is sent.
- **Response:** the V2 promise resolves with the first matching `AgentChannelStateChanged` (`SetStateResponse` includes it); the V1 promise resolves with `StateChangeSuccess`.
- **Logout routing (`stationLogout`):** `shouldRouteV2()` uses the pin when set, else the flag. On success the SDK deregisters the browser line and runs `clearV2LocalState`.

## Error / Failure Catalog
| Condition | Code / signal | Meaning | Consumer action |
|---|---|---|---|
| V2 login rejected or AQM timeout (`TIMEOUT_REQ`, 20000 ms) | rejected promise, `Service.aqm.agent.stationLoginV2Failed` / `stationLoginV2` | No session created; no V1 retry | Show the error; retry later; admin can set the flag `false` |
| Flag re-read fails | warning log only | Cached flag used | none |
| V2 state change: empty list, channel not selectable, or no capacity | rejected promise, `details.type: 'SDK_VALIDATION_ERROR'`, `data.reason` names invalid and selectable channels | No request sent | Fix the channel list |
| Available with telephony while browser voice is not ready | `SDK_VALIDATION_ERROR`, reason `VOICE_CONNECTION_ERROR.NOT_READY` | No request sent | Wait for `voice:connectionStateChange`, or request non-telephony channels |
| Backend rejects a channel | `agent:channelStateChangeFailed` and rejected promise `Service.aqm.agent.stateChangeV2` | That channel did not change | Show the reason |
| State change AQM timeout | rejected promise | Outcome unknown | Read `getChannelStates()`; retry |
| Logout fails | rejected promise, `Service.aqm.agent.logoutV2` / `logout` | Session still active; V2 state kept | Retry |

## Backward Compatibility
- **Compatible?** mostly — `channelType` is optional and ignored on V1; V1 agents see no change. A V2 login failure now rejects instead of retrying on V1.
- **Consumer transition / deprecation:** none for V1. V2 consumers handle login errors like V1 login errors. Semver minor.

## Delivery & Ordering Guarantees
- The V2 state-change promise settles on the **first** matching channel notification. It does not wait for all requested channels, and it does not filter by `channelType`. Per-channel results come from `agent:channelStateChange` and `agent:channelStateChangeFailed`.
- Not idempotent at the SDK level; repeating a request repeats the HTTP call.

## Versioning
- URI version `/v1` vs `/v2`, chosen per session: login by the flag, then state change and logout by the pin (logout uses the flag when unpinned). Switching versions needs a logout and a new login.

## Validation
- `test/unit/spec/services/agent/index.ts`: `stationLoginV2`, `stateChangeV2`, `logoutV2` (path, method, binds, error IDs).
- `test/unit/spec/cc.ts`:
  - `stationLogin`: rejects without a V1 fallback when V2 login times out; rethrows non-timeout V2 errors.
  - `profile flag refresh before login`: routes to V1 when the re-read flag is false; keeps the cached flag on failure.
  - `stationLogout`: routes by the flag when unpinned and by the pin when set.
  - `setAgentState on a V2 session` (5): requested channels; auto-select; rejects a channel without capacity; voice check only for telephony; V1 drops `channelType`.
  - Early pin: `should pin V2 and seed channels when manageChannelAvailability is true`, and the V1 and absent-flag cases.

## References
- Feature design: [`../feature-design.md`](../feature-design.md) · Standing catalog: [`docs/architecture.md`](../../../../../docs/architecture.md) · Owning module specs: [`src/docs/README.md`](../../../../../src/docs/README.md), [`src/services/agent/docs/README.md`](../../../../../src/services/agent/docs/README.md) · Baseline: [`.sdd/manifest.json`](../../../../../.sdd/manifest.json)
- Related: [`v2-events.md`](v2-events.md), [`v2-reload.md`](v2-reload.md)
