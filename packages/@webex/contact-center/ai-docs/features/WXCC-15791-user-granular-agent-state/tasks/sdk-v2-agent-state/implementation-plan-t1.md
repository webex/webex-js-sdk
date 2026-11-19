# Implementation Plan — T1: V2 types, request builders, and event constants

> Start here → package [`AGENTS.md`](../../../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../../../docs/specs/README.md). This plan builds its task [`task-t1.md`](./task-t1.md) under epic [`epic.md`](./epic.md); design is [`feature-design.md`](../../design/feature-design.md).
> Context-efficiency: grounded in current code; behavior is in the contracts.

## Task Context
| Field | Value |
|---|---|
| Task | [`./task-t1.md`](./task-t1.md) |
| Parent epic / feature | [`./epic.md`](./epic.md) · [`../../design/feature-design.md`](../../design/feature-design.md) |
| Target repo(s) / module(s) | `webex/webex-js-sdk` · `@webex/contact-center` (`src/services/agent`, `src/services/config`, `src/services/core`, `src/index.ts`) |
| Execution stream / wave | wave 1 |
| created_by / date | SDD intake / 2026-09-21, revised 2026-11-19 |
| Generated from | `implementation-plan` @ SDLC template library `0.2.0` |

## Current Context (code-grounded)
- `routingAgent` builds AQM configs (HTTP request plus a matched WebSocket notification). Before this task it had V1 only: `reload`, `logout`, `stationLogin`, `stateChange`, `buddyAgents`. Evidence: `src/services/agent/index.ts`.
- The AQM HTTP method defaults to `POST` when a body is present and no `method` is set. Evidence: `src/services/core/aqm-reqs.ts` line 141.
- `AGENT_EVENTS` and the agent payload types live in `src/services/agent/types.ts`; the WebSocket names live in `CC_AGENT_EVENTS` (`src/services/config/types.ts`).
- `parseAgentConfigs` builds `Profile` from the desktop-login aggregate. Evidence: `src/services/config/Util.ts`.
- `src/index.ts` is the public barrel, pinned by `test/unit/spec/index.ts` (`EXPECTED_ROOT_EXPORTS`).

## Proposed Approach & Sequencing
1. Add the V2 types and `StateChange.channelType?` to `src/services/agent/types.ts`. Add the four V2 `AGENT_EVENTS`.
2. Add the four `CC_AGENT_EVENTS`: `AgentChannelStateChange`, `AgentChannelStateChanged`, `AgentChannelStateChangeFailed`, and `AgentChannelReloginSuccess`. Add `manageChannelAvailability` and the optional profile fields to `AgentProfile`, and `manageChannelAvailability: boolean` to `Profile`.
3. Map `manageChannelAvailability === true` in `parseAgentConfigs`.
4. Add `stationLoginV2`, `stateChangeV2` (`PUT`), `logoutV2`, and `reloadV2` to `routingAgent`. Make both reload builders bind both relogin response types.
5. Add the four error IDs to `Err.ts`.
6. Export the seven public types from `src/index.ts` and add them to `EXPECTED_ROOT_EXPORTS`.

## API / Interface Changes
- `routingAgent.stationLoginV2({data: UserStationLogin})` → `POST /v2/agents/login`.
- `routingAgent.stateChangeV2({data: ChannelStateChangeRequest})` → `PUT /v2/agents/session/state`.
- `routingAgent.logoutV2({data: Logout})` → `POST /v2/agents/logout`.
- `routingAgent.reloadV2()` → `POST /v2/agents/reload`.
- Source: `src/services/agent/index.ts`.

## Contract Changes
- Provides ADDED: the V2 types and four V2 events → [`v2-events.md`](../../design/contracts/v2-events.md).
- Requires ADDED: the four V2 endpoints → [`v2-state-change.md`](../../design/contracts/v2-state-change.md), [`v2-reload.md`](../../design/contracts/v2-reload.md).
- Index: `contact-center-agent-events` and `contact-center-cc-events` rows in `docs/architecture.md`.

## Backward-Compat / Rollback
- **Compatibility:** additive types, constants, and builders; V1 builders unchanged.
- **Consumer transition / deprecation:** none.
- **Rollback:** revert the commit; nothing calls the V2 builders unless T2 routes to them.

## Logs / Metrics / Alerting
- None added; builders reuse the AQM error mapping.

## Implementation Caveats
- `logoutV2` sets no `method`, so it is `POST`, like V1 logout.
- The `stateChangeV2` success bind matches three outer types, so the promise settles on the first channel's notification.

## Anticipated PR Split
| PR | Scope (one logical concern) | Depends on |
|---|---|---|
| Single feature PR | T1 to T4 together (epic decision) | — |

## Manual Validation
- [x] `tsc --noEmit` from the package directory.

## AI Docs Impact

### webex/webex-js-sdk — `@webex/contact-center`
| Field | Value |
|---|---|
| Manifest | `packages/@webex/contact-center/.sdd/manifest.json` |
| Standing docs root | `packages/@webex/contact-center/docs/` (router `docs/specs/README.md`, architecture `docs/architecture.md`); module specs at `src/**/docs/README.md` |

| Doc / source | Decision (required / not required / blocked) | Reason / trigger | Required update or no-impact reason |
|---|---|---|---|
| Touched module spec(s) | required | New public types, builders, events, profile field | `src/services/agent/docs/README.md` (Public surface, Station login, State change, Recovery reload, event mapping); `src/services/config/docs/README.md` (profile field, V2 `CC_AGENT_EVENTS`) |
| Router (`docs/specs/README.md`, SPEC_INDEX equivalent) | not required | No new module or routing change | — |
| Contract index (`docs/architecture.md`, CONTRACTS equivalent) and `contract_catalog` | required | Agent events and types extended | Update the `contact-center-agent-events` row and manifest summary |
| Native schema/API source | required | Public barrel | `src/index.ts`; `test/unit/spec/index.ts` |
| SERVICE_STATE | not required | Package has no service-state doc; the flag is documented in the config module spec | — |
| DATA_MODEL | not required | No persistent data | — |
| SECURITY | not required | No trust-boundary change | — |
| GLOSSARY | not required | Package has no glossary; terms defined in the feature spec | — |
| ARCHITECTURE (`docs/architecture.md` body) | not required for T1 | Component interactions unchanged by types | — |
| RULES (`AGENTS.md`) | not required | No new convention | — |
| README / public API / help / release docs | required | Typedoc on the new types and builders | JSDoc in `src/services/agent/types.ts`, `index.ts` |

## Documentation Updates
### webex/webex-js-sdk
- `src/services/agent/docs/README.md` Public surface: V2 builders, V2 types, the four V2 events.
- `src/services/config/docs/README.md`: `manageChannelAvailability` mapping and V2 `CC_AGENT_EVENTS`.
- `docs/architecture.md` contract index row `contact-center-agent-events`; manifest summary.
- `src/index.ts` exports and barrel test.

## References
- Task: [`./task-t1.md`](./task-t1.md) · Epic: [`./epic.md`](./epic.md) · Feature design: [`../../design/feature-design.md`](../../design/feature-design.md)
