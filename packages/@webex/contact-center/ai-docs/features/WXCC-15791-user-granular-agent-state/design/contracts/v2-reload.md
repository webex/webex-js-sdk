# Contract — V2 Reload / Recovery

> **Navigation:** [AGENTS.md](../../../../AGENTS.md) → [SPEC_INDEX.md](../../../../SPEC_INDEX.md) → [ARCHITECTURE.md](../../../../ARCHITECTURE.md)

> Interface contract for [`../feature-design.md`](../feature-design.md); product delta in [`../../spec/feature-spec.md`](../../spec/feature-spec.md).

## Metadata
| Field | Value |
|---|---|
| Interface | unified `routingAgent.reload` → `POST /v1/agents/reload` (accepts V1 + V2 responses); optional `reloadV2` → `/v2/agents/reload` |
| Direction | SDK → backend (HTTP); response consumed directly + WebSocket `AgentChannelReloginSuccess` |
| Change | ADDED (V2 response branch) |
| Semver | minor (additive) |
| Kind | request-response |
| Producer | SDK `cc.ts` (`silentRelogin` → unified `reload` builder in `services/agent/index.ts`) |
| Consumer(s) | Widget components (via store `agent:channelReloginSuccess`), Host integrators |
| Canonical schema/API source | `src/services/agent/types.ts` (`AgentChannelReloginSuccess`, `ChannelType`, `AgentChannelTypeStates`) |
| Generated from | SDLC feature-package/design/contracts template v0.2.0 |

## Summary
After a WebSocket disconnect/reconnect (or page refresh), `silentRelogin()` calls the unified `reload()`. The backend returns the response type matching the persisted session version; the SDK branches on `response.data.type`.

## Definition
`AgentChannelReloginSuccess` (V2 branch):
```typescript
{
  agentChannelStateDetailMap: Record<ChannelType, AgentChannelTypeStates>;
  channelsMap: Record<string, string[]>;   // capacity source
  interactionIds: string[]; reservedAgentChannelIds: string[];
  profileType: string; deviceType: string; dn: string;
  siteId: string; teamId: string; agentId: string; agentSessionId: string;
  trackingId: string; orgId: string; deviceId: string;
  isExtension: boolean; roles: string[]; eventTime?: number;
}
```

## Behavior
- V2 response: pin V2; replace `channelStatesMap` (from `agentChannelStateDetailMap`), `loginChannelsMap` (from `channelsMap`); emit `agent:channelReloginSuccess`. No bridged V1 `agent:reloginSuccess` is emitted for a V2 reload.
- Recovery: channels with `stateChangeReason === 'agent-wss-disconnect'` (`selectDisconnectedChannels`) are requested back to Available via `setAgentState({..., channelType})`.
- Telephony deferral: on `BROWSER` devices, `splitTelephonyRecovery` sends non-telephony immediately and defers telephony when `isVoiceReady()` is false. The timer id is stored. When it fires, `setAgentState` runs only if this is still the same V2 session and telephony `stateChangeReason` is still `agent-wss-disconnect`. `stationLogout`, `deregister`, and a remote logout for this session clear the timer.

## Error / Failure Catalog
| Condition | Behavior |
|---|---|
| Reload failure | Mapped via `Service.aqm.agent.reload` on the unified `reload()` path. `reloadV2` (`Service.aqm.agent.reloadV2`) is unused. |
| Recovery state-change failure | Surfaced as `agent:channelStateChangeFailed` per channel |

## Backward Compatibility
Unified `reload()` still returns `AgentReloginSuccess` for V1 sessions; V1 recovery path unchanged. `reloadV2` is optional/Phase 2 — recovery must not depend on it.

## Versioning
Backend selects V1/V2 response from the persisted session version, so recovery works even when the in-memory pin is lost after a refresh.

## Validation
The timer guard, map restore, and recovery split are implemented in `cc.ts`. `test/unit/spec/cc.ts` does not cover them yet. Do not treat this contract as tested.

## References
- State change: [`v2-state-change.md`](./v2-state-change.md) · Events: [`v2-events.md`](./v2-events.md)
