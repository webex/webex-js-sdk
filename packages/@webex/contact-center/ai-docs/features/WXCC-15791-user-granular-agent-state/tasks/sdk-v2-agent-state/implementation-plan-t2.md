# Implementation Plan — T2: `cc.ts` V2 orchestration and the V2→V1 bridge

> Start here → package [`AGENTS.md`](../../../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../../../docs/specs/README.md). This plan builds its task [`task-t2.md`](./task-t2.md) under epic [`epic.md`](./epic.md); design is [`feature-design.md`](../../design/feature-design.md).
> Context-efficiency: grounded in current code; behavior is in the design's sequence diagrams and the contracts.

## Task Context
| Field | Value |
|---|---|
| Task | [`./task-t2.md`](./task-t2.md) |
| Parent epic / feature | [`./epic.md`](./epic.md) · [`../../design/feature-design.md`](../../design/feature-design.md) |
| Target repo(s) / module(s) | `webex/webex-js-sdk` · `@webex/contact-center` (`src/cc.ts`, `src/types.ts`, `src/services/agent/aggregate.ts`) |
| Execution stream / wave | wave 2 |
| created_by / date | SDD intake / 2026-09-21, revised 2026-11-19 |
| Generated from | `implementation-plan` @ SDLC template library `0.2.0` |

## Current Context (code-grounded)
- On `next`, `ContactCenter` already owns V1 login, logout, state change, the reload in `silentRelogin`, and the WebSocket router `handleWebsocketMessage`. Evidence: `src/cc.ts`.
- `register()` runs `silentRelogin()` from `connectWebsocket()` when `allowAutomatedRelogin` is set. `handleConnectionLost` runs it again on reconnect.
- `setAgentState` already rejects Available with `VOICE_CONNECTION_ERROR.NOT_READY` when browser voice is required and not ready.

## Proposed Approach & Sequencing
1. Add `aggregate.ts` (pure): `shouldBridgeChannelState`, `projectAggregate`, `shouldEmitLegacyEvent`, `bridgeStateChangeSuccess` returning a flat `BridgedV1StateChange`.
2. Add session state and version helpers in `cc.ts`: `pinnedVersion`, `isV2Eligible`, `pinSessionVersion`, `isV2Session`, `shouldRouteV2`, `clearSessionVersion`, `clearV2LocalState`.
3. Login:
   - call `refreshManageChannelAvailability()` before the request;
   - choose `stationLoginV2` or `stationLogin`, with no fallback;
   - pin early in the `AgentStationLoginSuccess` handler (and seed maps on V2);
   - pin and seed again after the promise.
4. `setAgentState`:
   - V2: default with `selectDefaultChannels`, then `assertChannelsSelectable`, the `affectsTelephony` voice check, and `stateChangeV2`;
   - V1: delete `channelType`.
5. `stationLogout` routes by `shouldRouteV2()` and calls `clearV2LocalState` on success.
6. `silentRelogin`:
   - route the reload by `shouldRouteV2()` and pin from the response type;
   - the V2 branch restores the maps, recovers via `selectDisconnectedChannels` and `splitTelephonyRecovery`, calls `scheduleTelephonyRecovery`, then `restoreV2AgentConfigFromChannels`.
7. WebSocket handlers:
   - `AgentChannelStateChanged` → `handleChannelStateChanged` (three guards, then the bridge);
   - `AgentChannelStateChangeFailed` → emit;
   - `AgentChannelReloginSuccess` → `handleChannelReloginSuccess`;
   - `AgentReloginSuccess` → pin V1.
8. Add the public getters `getChannelStates` and `getAgentStateControl` on `ContactCenter` (`IContactCenter` is not extended; it declares only a few methods).

## API / Interface Changes
- `setAgentState(data: StateChange)`: optional `channelType`; returns `SetStateResponse`, which now includes `AgentChannelStateChanged`.
- `getChannelStates(): Record<ChannelType, AgentChannelTypeStates>`; `getAgentStateControl(): AgentStateControlStatus`.

## Contract Changes
- Implements [`v2-state-change.md`](../../design/contracts/v2-state-change.md), [`v2-events.md`](../../design/contracts/v2-events.md), and the reload and recovery parts of [`v2-reload.md`](../../design/contracts/v2-reload.md).
- Index: `contact-center-sdk` row in `docs/architecture.md`.

## Backward-Compat / Rollback
- **Compatibility:** V1 paths unchanged when the flag is off. The bridge keeps V1 listeners working on V2.
- **Consumer transition / deprecation:** a V2 login error now rejects (no V1 retry).
- **Rollback:** set the profile flag `false` (next login), or revert the commit.

## Logs / Metrics / Alerting
- `LoggerProxy` lines:
  - the login version decision;
  - a failed flag re-read (warn);
  - a pin mismatch on `AgentChannelReloginSuccess` (warn);
  - an unknown `channelType` (warn);
  - recovery requests and deferral (log), and recovery failures (error).
- Metrics: existing `STATION_LOGIN_*` and `AGENT_STATE_CHANGE_*`.

## Implementation Caveats
- The early pin and the promise pin must agree. Both use the flag value read before the request.
- `assertChannelsSelectable` uses the same `SDK_VALIDATION_ERROR` shape as the voice guard.
- The telephony timer checks the V2 pin, the session id, and the telephony reason before it acts.
- A V1 reload after a V2 pin leaves the maps populated. This is harmless because the getters return `{}` on V1.
- `success` metrics read `agentConfig.teams[0]`, so test fixtures need `teams`.

## Anticipated PR Split
| PR | Scope (one logical concern) | Depends on |
|---|---|---|
| Single feature PR | T1 to T4 together (epic decision) | — |

## Manual Validation
- [ ] Sample app: V2 agent logs in on `/v2`; per-channel changes update the panel; V1 agent unchanged.
- [ ] Against a V2 backend (Q-1).

## AI Docs Impact

### webex/webex-js-sdk — `@webex/contact-center`
| Field | Value |
|---|---|
| Manifest | `packages/@webex/contact-center/.sdd/manifest.json` |
| Standing docs root | `packages/@webex/contact-center/docs/`; module specs at `src/**/docs/README.md` |

| Doc / source | Decision (required / not required / blocked) | Reason / trigger | Required update or no-impact reason |
|---|---|---|---|
| Touched module spec(s) | required | New public methods, routing, state, flows | `src/docs/README.md` (Public surface, Requirements, Design overview, Station login and agent state, Recovery, Client state model, Caller-visible failure modes); `src/services/agent/docs/README.md` (`aggregate.ts`, bridge) |
| Router (`docs/specs/README.md`) | not required | No new module | — |
| Contract index (`docs/architecture.md`) and `contract_catalog` | required | `contact-center-sdk` surface extended | Update the `contact-center-sdk` row |
| Native schema/API source | required | `AgentStateControlStatus`, `SetStateResponse` | `src/types.ts` |
| SERVICE_STATE | not required | No such doc in the package | — |
| DATA_MODEL | not required | In-memory only | — |
| SECURITY | not required | Other-agent events ignored; no new boundary | — |
| GLOSSARY | not required | No glossary in the package | — |
| ARCHITECTURE (`docs/architecture.md` body) | not required | Interactions unchanged; AQM row already covers V2 | — |
| RULES (`AGENTS.md`) | not required | No new convention | — |
| README / public API / help / release docs | required | Typedoc on the getters and `setAgentState` | JSDoc in `src/cc.ts` |

## Documentation Updates
### webex/webex-js-sdk
- `src/docs/README.md`: public surface rows, the granular agent-state requirement, design subsection, flows, client state, failure modes.
- `src/services/agent/docs/README.md`: `aggregate.ts` in structure and design overview.
- `docs/architecture.md` `contact-center-sdk` row.

## References
- Task: [`./task-t2.md`](./task-t2.md) · Epic: [`./epic.md`](./epic.md) · Feature design: [`../../design/feature-design.md`](../../design/feature-design.md)
