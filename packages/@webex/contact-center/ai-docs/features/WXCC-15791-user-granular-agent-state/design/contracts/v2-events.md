# Contract — V2 Agent Events

> **Navigation:** [AGENTS.md](../../../../AGENTS.md) → [SPEC_INDEX.md](../../../../SPEC_INDEX.md) → [ARCHITECTURE.md](../../../../ARCHITECTURE.md)

> Interface contract for [`../feature-design.md`](../feature-design.md); product delta in [`../../spec/feature-spec.md`](../../spec/feature-spec.md).

## Metadata
| Field | Value |
|---|---|
| Interface | `AGENT_EVENTS` (SDK) + `CC_EVENTS`/`CC_AGENT_EVENTS` (WebSocket) |
| Direction | backend WebSocket → SDK → consumer events |
| Change | ADDED |
| Semver | minor (additive) |
| Kind | event |
| Producer | SDK `cc.ts` (WebSocket V2 handlers), `services/agent/aggregate.ts` (V2→V1 bridge) |
| Consumer(s) | Widget components (via store event wiring), Host integrators (via `AGENT_EVENTS` listeners) |
| Canonical schema/API source | `src/services/agent/types.ts` (`AgentChannelStateChanged`, `AgentChannelStateChangeFailed`, `AgentChannelReloginSuccess`) |
| Generated from | SDLC feature-package/design/contracts template v0.2.0 |

## Summary
Four new SDK events surface V2 per-channel activity. Three are bridged from WebSocket notifications; the fourth (`agent:channelRecoveryDeferred`) is emitted locally when telephony recovery is deferred. Listeners receive the inner `data` payload (matching V1 emission).

## Definition
SDK events (`AGENT_EVENTS`):
| Constant | String | Payload |
|---|---|---|
| `AGENT_CHANNEL_STATE_CHANGE` | `agent:channelStateChange` | `AgentChannelStateChanged['data']` |
| `AGENT_CHANNEL_STATE_CHANGE_FAILED` | `agent:channelStateChangeFailed` | `AgentChannelStateChangeFailed['data']` |
| `AGENT_CHANNEL_RELOGIN_SUCCESS` | `agent:channelReloginSuccess` | `AgentChannelReloginSuccess['data']` |
| `AGENT_CHANNEL_RECOVERY_DEFERRED` | `agent:channelRecoveryDeferred` | `{ channelTypes: ChannelType[], agentId: string }` |

WebSocket wire events (`CC_EVENTS`/`CC_AGENT_EVENTS`): `AgentChannelStateChange`, `AgentChannelStateChanged`, `AgentChannelStateChangeFailed`, `AgentChannelReloginSuccess`.

`AgentChannelStateChanged`:
```typescript
{
  channelType: ChannelType;
  agentChannelStateDetail: {       // == AgentChannelTypeStates
    agentState: string;
    availableChannelCount: number; totalChannelCount: number;
    stateChangeReason: string;
    manuallyAssignedChannelCount: number; totalManuallyAssignedChannelCount: number;
    manuallyAssignedAvailableChannelCount?: number | null;
    pendingIdle: boolean;
    stateChangeTimestamp: number; auxCodeId: string; lastIdleCodeChangeTimestamp: number;
  };
  subStatus: string; connectedChannels: ChannelType[];
  isAgentLogin: boolean;
  changedBy: string; changedById: string | null; changedByName: string | null;
  queueId?: string | null; eventTime?: number; status: string; isClientInitiated: boolean;
}
```
`AgentChannelStateChangeFailed`: `{ channelType, reason, reasonCode: number, isClientInitiated?, eventTime? }`.

## Behavior
- `agent:channelStateChange`: ignored entirely when not a V2 session; `channelStatesMap[channelType]` is replaced with `agentChannelStateDetail` before emit.
- `agent:channelStateChangeFailed`: emitted unconditionally.
- `agent:channelReloginSuccess`: replaces channel-state + capacity maps and pins V2.
- `agent:channelRecoveryDeferred`: emitted locally (not from WebSocket) when telephony recovery is deferred on `BROWSER` devices because `isVoiceReady()` is false. Payload lists the deferred `channelTypes` and the `agentId`. A 60 s timer will retry recovery; the callback no-ops after logout or a manual state change.
- **V2→V1 bridge:** each applied channel change projects an agent-wide V1 `agent:stateChange` and `agent:stateChangeSuccess` via `aggregate.ts`. Any Available wins. `auxCodeId`, timestamps, and reason come from the first channel in `telephony → chat → email → social` whose `agentState` equals that subStatus. The event is emitted again when `subStatus` or that aux code changes. Bridgeable states are `Available` and `Idle`.

## Backward Compatibility
Additive; V1 `agent:stateChange`/`agent:stateChangeSuccess` still fire (bridged on V2 sessions).

## Delivery & Ordering Guarantees
One notification per channel; cross-channel ordering not guaranteed. Each public event emits at most once per notification.

## Validation
`test/unit/spec/services/agent/aggregate.ts` covers projection, the winning-channel aux code, and idle-code re-emit. `test/unit/spec/cc.ts` does not cover emission, map updates, or the V1 ignore.

## References
- State change: [`v2-state-change.md`](./v2-state-change.md) · Reload: [`v2-reload.md`](./v2-reload.md)
