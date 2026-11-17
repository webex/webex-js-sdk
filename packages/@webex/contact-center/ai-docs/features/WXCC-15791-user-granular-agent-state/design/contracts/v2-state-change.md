# Contract — V2 State Change (`stateChangeV2`)

> **Navigation:** [AGENTS.md](../../../../AGENTS.md) → [SPEC_INDEX.md](../../../../SPEC_INDEX.md) → [ARCHITECTURE.md](../../../../ARCHITECTURE.md)

> Interface contract for [`../feature-design.md`](../feature-design.md); product delta in [`../../spec/feature-spec.md`](../../spec/feature-spec.md).

## Metadata
| Field | Value |
|---|---|
| Interface | `routingAgent.stateChangeV2` → `PUT /v2/agents/session/state` (WCC_API_GATEWAY) |
| Direction | SDK → backend (HTTP) with async WebSocket completion |
| Change | ADDED |
| Semver | minor (additive) |
| Kind | request-response |
| Producer | SDK `cc.ts` (`setAgentState` → `stateChangeV2` builder in `services/agent/index.ts`) |
| Consumer(s) | Widget components (via store `agent:channelStateChange`), Host integrators (via SDK public API) |
| Canonical schema/API source | `src/services/agent/types.ts` (`ChannelStateChangeRequest`, `ChannelType`, `AgentChannelStateChanged`) |
| Generated from | SDLC feature-package/design/contracts template v0.2.0 |

## Summary
Sets per-channel availability. Triggered by `setAgentState({state, auxCodeId, channelType})` when the session is pinned V2. Success/failure are delivered asynchronously as per-channel WebSocket events, not by the HTTP response.

## Definition
Request payload (`ChannelStateChangeRequest`):
```typescript
{
  state: string;             // 'Available' | 'Idle' | ...
  auxCodeId: string;
  channelType: ChannelType[];// ['telephony','chat','email','social'] (selectable subset)
  reason?: string;           // from caller's lastStateChangeReason
  agentId?: string;          // defaults to logged-in agent
}
```
Canonical `ChannelType = 'telephony'|'chat'|'email'|'social'|'workItem'|'customMessaging'`. Only `SELECTABLE_CHANNEL_TYPES = ['telephony','chat','email','social']` are valid in a request; `assertChannelsSelectable()` rejects the rest. When `channelType` is omitted on a V2 session, the SDK auto-selects all selectable channels.

## Error / Failure Catalog
| Condition | Behavior |
|---|---|
| Non-selectable channel requested | SDK validation error thrown before the request |
| Backend rejects a channel | `agent:channelStateChangeFailed` `{channelType, reason, reasonCode:number, isClientInitiated?, eventTime?}` |
| AQM request failure | Mapped via `Service.aqm.agent.stateChangeV2` error id |

## Backward Compatibility
Additive: `setAgentState` gains an optional `channelType[]`; V1 sessions are unaffected and route through V1 `stateChange`.

## Delivery & Ordering Guarantees
The `stateChangeV2` AQM request binds success and failure to the same outer types (`AgentRequestEvent`, `RoutingMessage`, `AgentChannelStateChange`). The `setAgentState` promise resolves on the first matching `AgentChannelStateChanged` and rejects on the first matching `AgentChannelStateChangeFailed`. It is **not** a guarantee that all requested channels transitioned, and it does not filter by `channelType`. Per-channel outcomes are authoritative via the `agent:channelStateChange`/`agent:channelStateChangeFailed` events (one per channel). Cross-channel ordering is not guaranteed.

## Validation
`test/unit/spec/cc.ts` covers the V2 login timeout fallback and the non-timeout rethrow. Routing, auto-select, validation, and event emission are not covered by unit tests yet. `test/unit/spec/services/agent/aggregate.ts` covers the bridge.

## References
- Events: [`v2-events.md`](./v2-events.md) · Reload: [`v2-reload.md`](./v2-reload.md)
