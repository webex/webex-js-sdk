# Implementation Plan — T2: `cc.ts` V2 Orchestration & Bridge

> **Navigation:** [AGENTS.md](../../../../AGENTS.md) → [SPEC_INDEX.md](../../../../SPEC_INDEX.md) → [ARCHITECTURE.md](../../../../ARCHITECTURE.md)

> Plan for [`task-t2.md`](./task-t2.md) under [`epic.md`](./epic.md).

## Task Context
Wire the V2 types/builders from T1 into the `ContactCenter` plugin: public getters, V2-aware routing, session pinning, channel validation, recovery, and the V2→V1 bridge.

## Current Context (code-grounded)
- `cc.ts` already owns V1 login/logout/state/reload and the WebSocket event router.
- No `aggregate.ts` exists yet; eligibility/channels/recovery/version are not implemented.

## Proposed Approach & Sequencing
1. Add `services/agent/aggregate.ts`: `projectAggregate`, `shouldEmitLegacyEvent`, `shouldBridgeChannelState`, `bridgeStateChangeSuccess` → flat `BridgedV1StateChange`.
2. Add private methods to `cc.ts` for eligibility, pinning, channel derivation/validation, and recovery (folded in — no separate modules).
3. Branch `setAgentState`/`stationLogin`/`stationLogout`/`silentRelogin` on `isV2Session()`; add V2 WebSocket handlers that update maps and emit the three events + bridge.
4. Add the three public getters, declared on `ContactCenter` and `IContactCenter`.

## Contract Changes
Implements [`../../design/contracts/v2-state-change.md`](../../design/contracts/v2-state-change.md), [`v2-events.md`](../../design/contracts/v2-events.md), [`v2-reload.md`](../../design/contracts/v2-reload.md).

## Backward-Compat / Rollback
V1 paths untouched; V2 only runs when the session is pinned V2. V2→V1 bridge keeps V1 consumers working.

## Implementation Caveats
- `bridgeStateChangeSuccess` must return a flat object (`StateChangeSuccess` is `Msg`-wrapped) → explicit `BridgedV1StateChange`.
- `assertChannelsSelectable` throws the SDK validation error shape used by the adjacent voice-not-ready guard.
- Deferred telephony recovery callback must no-op if the session is no longer an active V2 login.

## Backward-Compat / Rollback
V1 fallback on V2-login AQM timeout pins V1.

## Manual Validation
`yarn build` clean; `cc.ts` + `aggregate.ts` unit suites green.

## AI Docs Impact
Update the `services/agent` and root plugin module specs; refresh contract catalog.

## References
- [`task-t2.md`](./task-t2.md) · [`../../design/feature-design.md`](../../design/feature-design.md)

## Logs and Metrics

- Log session version pinning decision (`V1`/`V2`) at info level after version resolution in `stationLogin()`.
- Log V2 login AQM timeout and V1 fallback at warn level.
- Log `assertChannelsSelectable` validation failures at error level.
- Emit `agent:channelStateChange` and bridged `agent:stateChange` events as observable state transitions.
- Log telephony recovery deferral start/complete and channel reconnection at debug level.
- Log `projectAggregate` bridge suppression (unchanged aggregate) at trace level.

## PR Split Strategy

- `aggregate.ts` (new file) can land as an isolated, independently reviewable commit with its own unit test surface.
- `cc.ts` V2 orchestration (pinning, routing, getters, recovery, event handlers) lands as a second commit depending on T1 types and `aggregate.ts`.

## Documentation Updates

- Update `services/agent` module spec to document `aggregate.ts` and its `BridgedV1StateChange` interface.
- Update the root plugin module spec to reflect V2-aware `setAgentState`, login/logout/reload routing, and new public getters.
- Refresh the contract catalog with finalized V2 endpoint paths and event schemas.
