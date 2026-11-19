# Contract — V2 agent events and state getters

> Start here → package [`AGENTS.md`](../../../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../../../docs/specs/README.md). This contract belongs to the design [`feature-design.md`](../feature-design.md); the standing catalog is the contract index in [`docs/architecture.md`](../../../../../docs/architecture.md) (`contact-center-agent-events`, `contact-center-cc-events`).
> Context-efficiency: exact types live in the TypeScript sources linked below; this file pins behavior.

## Metadata
| Field | Value |
|---|---|
| Interface | V2 WebSocket notifications → `AGENT_EVENTS` V2 events, the bridged V1 events, `getChannelStates()`, `getAgentStateControl()` |
| Kind | event (plus two SDK getters) |
| Change type | new (bridged V1 events: modify, new source) |
| Producer | Backend notification WebSocket; SDK `src/cc.ts` and `src/services/agent/aggregate.ts` |
| Consumer(s) | Applications (`@webex/cc-widgets` store, custom desktops, the sample app) |
| Canonical schema / API source | `src/services/agent/types.ts` (`AGENT_EVENTS`, `ChannelType`, `AgentChannelTypeStates`, `AgentChannelStateChanged`, `AgentChannelStateChangeFailed`, `AgentChannelReloginSuccess`); `src/services/config/types.ts` (`CC_AGENT_EVENTS`); `src/types.ts` (`AgentStateControlStatus`) |
| Feature | [`../feature-design.md`](../feature-design.md) |
| Generated from | `contract` @ SDLC template library `0.2.0` |

## Summary
On a V2 session the SDK keeps a per-channel state map from WebSocket notifications. It emits a V2 event for each notification, and projects one agent-wide V1 state so V1 listeners keep working. Two getters expose the map and the session's control status.

## Definition
- **Canonical source:** the TypeScript declarations listed in Metadata.
- **WebSocket (consumed), `CC_AGENT_EVENTS`:** outer type `AgentChannelStateChange`; inner `data.type` `AgentChannelStateChanged` or `AgentChannelStateChangeFailed`; `AgentChannelReloginSuccess` (reload response, see [`v2-reload.md`](v2-reload.md)).
- **SDK events (published).** Listeners receive the notification's inner `data`, as on V1:

| Constant | String | Payload | Emitted when |
|---|---|---|---|
| `AGENT_CHANNEL_STATE_CHANGE` | `agent:channelStateChange` | `AgentChannelStateChanged['data']` | A V2 channel notification for this agent and a selectable channel |
| `AGENT_CHANNEL_STATE_CHANGE_FAILED` | `agent:channelStateChangeFailed` | `AgentChannelStateChangeFailed['data']` = `{channelType, reason, reasonCode, isClientInitiated?, eventTime?}` | Every `AgentChannelStateChangeFailed` notification (no guards) |
| `AGENT_CHANNEL_RELOGIN_SUCCESS` | `agent:channelReloginSuccess` | `AgentChannelReloginSuccess['data']` | Every `AgentChannelReloginSuccess` notification |
| `AGENT_CHANNEL_RECOVERY_DEFERRED` | `agent:channelRecoveryDeferred` | `{channelTypes: ChannelType[], agentId: string}` | Local: telephony recovery deferred on `BROWSER` ([`v2-reload.md`](v2-reload.md)) |
| `AGENT_STATE_CHANGE`, `AGENT_STATE_CHANGE_SUCCESS` (existing) | `agent:stateChange`, `agent:stateChangeSuccess` | V1 `StateChangeSuccess['data']` shape built by `bridgeStateChangeSuccess` | Bridge projection changed (below) |

- **`AgentChannelStateChanged['data']`:** `channelType`, `agentChannelStateDetail: AgentChannelTypeStates`, `subStatus`, `status`, `isClientInitiated`, `changedBy`, `changedById`, `changedByName`, `queueId?`, `eventTime?`, `connectedChannels`, `isAgentLogin`, plus the common `agentId`, `agentSessionId`, `orgId`.
- **Handling rules** (`handleChannelStateChanged`), in order:
  1. Ignore when the session is not pinned V2 (also when unpinned).
  2. Ignore when `data.agentId` is set and differs from this agent (the AQM bind also matches other agents' routing messages).
  3. Ignore, with a warning, when `channelType` is not in `SELECTABLE_CHANNEL_TYPES` (`telephony`, `chat`, `email`, `social`).
  4. Replace `channelStatesMap[channelType]` with `agentChannelStateDetail` when present, then emit `agent:channelStateChange`.
  5. Run the bridge.
- **`AgentChannelReloginSuccess` handling:** warn when pinned V1, pin V2, replace `channelStatesMap` and `loginChannelsMap`, set the V1 fields on `agentConfig` and `lastEmittedV1` from the bridge, then emit `agent:channelReloginSuccess`. No bridged `agent:reloginSuccess`.
- **V2→V1 bridge** (`aggregate.ts`):
  - Only `Available` and `Idle` count. Any channel Available → `Available`; else any Idle → `Idle`; else no V1 event.
  - `auxCodeId`, timestamps, and reason come from the first channel in `telephony → chat → email → social` whose `agentState` equals the projected subStatus.
  - Emit again only when subStatus or that aux code differs from `lastEmittedV1`.
- **Getters:**
  - `getChannelStates(): Record<ChannelType, AgentChannelTypeStates>` returns a copy of each entry, and `{}` unless pinned V2.
  - `getAgentStateControl(): AgentStateControlStatus` returns `{declared, active}`:
    - `declared` is `manageChannelAvailability === true` from the current profile, or `undefined` before `register()`;
    - `active` is `true` when pinned V2, `false` when pinned V1, and `undefined` when unpinned.
- **Raw pass-through:** the existing allow-list in `handleWebsocketMessage` also re-emits known `CC_EVENTS` verbatim under their wire names (for example `AgentChannelStateChanged`). Applications should use the `agent:*` events.

## Error / Failure Catalog
| Condition | Code / signal | Meaning | Consumer action |
|---|---|---|---|
| Backend rejects a channel change | `agent:channelStateChangeFailed` with `reason`, `reasonCode` | That channel did not change | Show the reason; keep the previous channel state |
| Notification for another agent | none (ignored) | Not this agent's state | none |
| Unknown or non-selectable channel | none (ignored, warning logged) | Unsupported channel | none |
| Notification on a V1 or unpinned session | none (ignored) | No V2 session | Use V1 events |
| No Available or Idle channel (for example all RONA) | no bridged V1 event | V1 state cannot be projected | Read `getChannelStates()` |
| Pin V1 but `AgentChannelReloginSuccess` received | warning log, pin V2 | Server session is V2 | Re-read `getAgentStateControl()` on `agent:channelReloginSuccess` |

## Backward Compatibility
- **Compatible?** yes — new events and getters are additive. On V2 sessions V1 listeners still get `agent:stateChange` and `agent:stateChangeSuccess`, now from the bridge.
- **Consumer transition / deprecation:** none required. Apps that want per-channel UI check `getAgentStateControl().active` and subscribe to the V2 events. Semver minor.

## Delivery & Ordering Guarantees
- One notification per channel. Cross-channel order is not guaranteed by the backend.
- Each accepted notification emits `agent:channelStateChange` once. The bridge emits at most one V1 pair per accepted notification, and only on a projection change.
- Events emitted synchronously from the WebSocket message handler. No replay: after a reconnect, the map is rebuilt from the reload response (`agent:channelReloginSuccess`).

## Versioning
- Events exist only on V2 sessions (pinned by login or reload). Applications detect the version with `getAgentStateControl().active`.

## Validation
- `test/unit/spec/services/agent/aggregate.ts` (25 tests): bridgeable states, projection, winning-channel aux code, duplicate suppression, idle-code re-emit.
- `test/unit/spec/cc.ts` › `V2 granular agent state`:
  - `handleChannelStateChanged` (9): map update, failure-event routing, other-agent guard, emit, bridge, duplicate suppression, V1 and unpinned guards, unknown channel.
  - `handleChannelReloginSuccess` (4).
  - `getChannelStates` (copies).
  - `getAgentStateControl` (2).
- Runs in CI with `yarn workspace @webex/contact-center test:unit`.

## References
- Feature design: [`../feature-design.md`](../feature-design.md) · Standing catalog: [`docs/architecture.md`](../../../../../docs/architecture.md) · Owning module specs: [`src/services/agent/docs/README.md`](../../../../../src/services/agent/docs/README.md), [`src/docs/README.md`](../../../../../src/docs/README.md) · Baseline: [`.sdd/manifest.json`](../../../../../.sdd/manifest.json)
- Related: [`v2-state-change.md`](v2-state-change.md), [`v2-reload.md`](v2-reload.md)
