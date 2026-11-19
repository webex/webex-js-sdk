# Task — T1: V2 types, request builders, and event constants

> Start here → package [`AGENTS.md`](../../../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../../../docs/specs/README.md). This task sits under its epic [`epic.md`](./epic.md) ↔ its plan [`implementation-plan-t1.md`](./implementation-plan-t1.md); it implements part of [`feature-design.md`](../../design/feature-design.md).
> Context-efficiency: this task names files and checks; behavior lives in the design and contracts.

## Metadata
| Field | Value |
|---|---|
| Task title | V2 types, request builders, and event constants |
| Parent epic | [`./epic.md`](./epic.md) |
| Parent feature | [`../../design/feature-design.md`](../../design/feature-design.md) (and [`../../spec/feature-spec.md`](../../spec/feature-spec.md)) |
| Task type | API |
| Target repo(s) / module(s) | `webex/webex-js-sdk` · `@webex/contact-center` (`src/services/agent`, `src/services/config`, `src/services/core`, `src/index.ts`) |
| Tracker key | [WXCC-15791](https://jira-eng-sjc12.cisco.com/jira/browse/WXCC-15791) |
| State | ready_for_merge |
| created_by / approved_by / date | SDD intake / pending / 2026-09-21, revised 2026-11-19 |
| Generated from | `task` @ SDLC template library `0.2.0` |

## Source Mapping
- Implements: Feature Architecture → Functional-Block Decomposition → V2 request builders; Object-Model Changes (types, `CC_AGENT_EVENTS`, V2 `AGENT_EVENTS`, profile fields, error IDs); Interface & Contract Definitions (V2 endpoints).

## Primary Code Touchpoints
- `src/services/agent/types.ts`:
  - `ChannelType`, `AgentChannelTypeStates`, `AgentChannelStateChanged`, `AgentChannelStateChangeFailed`, `AgentChannelReloginSuccess`, `ChannelStateChangeRequest`, `ChannelsMap`, `SessionVersion`;
  - optional `StateChange.channelType`;
  - the four V2 `AGENT_EVENTS` (`agent:channelStateChange`, `agent:channelStateChangeFailed`, `agent:channelReloginSuccess`, `agent:channelRecoveryDeferred`).
- `src/services/agent/index.ts`: `stationLoginV2`, `stateChangeV2`, `logoutV2`, `reloadV2`. Both reload builders bind `AgentReloginSuccess` and `AgentChannelReloginSuccess`.
- `src/services/config/types.ts`: V2 `CC_AGENT_EVENTS`; `AgentProfile.manageChannelAvailability` and the other optional profile fields; `Profile.manageChannelAvailability`.
- `src/services/config/Util.ts`: `parseAgentConfigs` maps `manageChannelAvailability === true`.
- `src/services/core/Err.ts`: `Service.aqm.agent.stationLoginV2`, `stationLoginV2Failed`, `stateChangeV2`, `logoutV2`.
- `src/index.ts`: export `ChannelType`, `AgentChannelTypeStates`, `AgentChannelStateChanged`, `AgentChannelStateChangeFailed`, `AgentChannelReloginSuccess`, `ChannelStateChangeRequest`, `AgentStateControlStatus`.

## Ownership Boundary
- Owns: `src/services/agent/types.ts` (V2 types and the four V2 event constants), `src/services/agent/index.ts`, `src/services/config/types.ts`, `src/services/config/Util.ts`, `src/services/core/Err.ts`, `src/index.ts`.
- Must NOT touch (owned by another task):
  - `src/cc.ts` and `src/services/agent/aggregate.ts` → T2;
  - the three lifecycle constants in `AGENT_EVENTS` (`agent:reloginSessionNotFound`, `agent:connectionLost`, `agent:connectionReconnected`) → T4;
  - tests → T3.

## Multi-Repo Scope
N/A — single target repo (`webex/webex-js-sdk`, manifest `packages/@webex/contact-center/.sdd/manifest.json`).

## Dependencies / Execution Stream
| This task | Depends on (blocked-by) | Parallel-safe with | Wave / stream |
|---|---|---|---|
| T1 | — | — | 1 |

## Acceptance Criteria
- [x] V2 types exported from `src/index.ts`; `SessionVersion` stays internal.
- [x] `routingAgent` exposes the four V2 builders with the paths, methods, binds, and error IDs in [`v2-state-change.md`](../../design/contracts/v2-state-change.md) and [`v2-reload.md`](../../design/contracts/v2-reload.md).
- [x] `Profile.manageChannelAvailability` is `true` only when the profile field is `true`.

## Verifier Exit Criteria
- [x] `tsc` clean; V1 exports and builder signatures unchanged.
- [x] Barrel test `test/unit/spec/index.ts` updated for the new exports.
- [x] Every V2 endpoint path appears only in `src/services/agent/index.ts`.

## Traceability
| Requirement / rule id | Code symbol (class.method / file) | Test that proves it |
|---|---|---|
| R-10 | `parseAgentConfigs` (`config/Util.ts`) | `config/Util.ts`: `maps manageChannelAvailability %s to %s` |
| R-1, R-9, R-12, R-17 | `stationLoginV2`, `stateChangeV2`, `logoutV2`, `reloadV2` (`agent/index.ts`) | `agent/index.ts`: `stationLoginV2`, `stateChangeV2`, `logoutV2`, `reloadV2` |
| R-6 | `AGENT_EVENTS.AGENT_CHANNEL_STATE_CHANGE_FAILED` | `cc.ts`: `should emit AGENT_CHANNEL_STATE_CHANGE_FAILED for a channel failure` |

## Coverage Expectation
- Changed-line coverage within the package 85% global gate (`jest.config.js`); evidence: CI coverage report.

## Cross-Cutting Prompts
- **Logging:** N/A — types and builders only.
- **Metrics:** N/A — no new metric names.
- **Security:** N/A — existing authenticated request path.
- **Idempotency:** N/A — builders are pure configs.
- **Rollout:** the profile flag is the only V2 switch; no SDK flag.

## Non-Goals / Out-of-Scope
- V2 orchestration in `cc.ts` and the bridge (T2).
- Unit tests and the sample app (T3).
- Session lifecycle events (T4).
- Changing V1 types or builder signatures.

## Feature-Flag & Rollout Assumptions
- Flag: `agentProfile.manageChannelAvailability` · default: off (absent or `false`) · assumption: V2 builders are only called when the session routes V2 (T2).

## References
- Epic: [`./epic.md`](./epic.md) · Implementation plan: [`./implementation-plan-t1.md`](./implementation-plan-t1.md)
- Feature design: [`../../design/feature-design.md`](../../design/feature-design.md) · Coverage/contracts baseline: [`.sdd/manifest.json`](../../../../../.sdd/manifest.json)
