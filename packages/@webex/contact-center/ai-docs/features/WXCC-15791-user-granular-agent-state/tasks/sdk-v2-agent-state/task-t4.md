# Task — T4: Session lifecycle signals for refresh and reconnect

> Start here → package [`AGENTS.md`](../../../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../../../docs/specs/README.md). This task sits under its epic [`epic.md`](./epic.md) ↔ its plan [`implementation-plan-t4.md`](./implementation-plan-t4.md); it implements part of [`feature-design.md`](../../design/feature-design.md).
> Context-efficiency: event behavior lives in [`v2-reload.md`](../../design/contracts/v2-reload.md).

## Metadata
| Field | Value |
|---|---|
| Task title | Session lifecycle signals for refresh and reconnect |
| Parent epic | [`./epic.md`](./epic.md) |
| Parent feature | [`../../design/feature-design.md`](../../design/feature-design.md) (and [`../../spec/feature-spec.md`](../../spec/feature-spec.md)) |
| Task type | API |
| Target repo(s) / module(s) | `webex/webex-js-sdk` · `@webex/contact-center` (`src/cc.ts`, `src/services/agent/types.ts`); `docs/samples/contact-center` |
| Tracker key | [WXCC-15791](https://jira-eng-sjc12.cisco.com/jira/browse/WXCC-15791) |
| State | in_progress (implemented and tested in the working tree, not committed) |
| created_by / approved_by / date | SDK vs application review / pending / 2026-11-19 |
| Generated from | `task` @ SDLC template library `0.2.0` |

## Source Mapping
- Implements: Design Decision D-7 (SDK owns the relogin, the application owns the policy).
- Also implements Functional-Block Decomposition → Session lifecycle events and Cleanup, and Sequence Diagrams Flow 2 (connection events, session not found) and the linked logout and deregister flows.
- Closes the two gaps already on `next`: the TODOs in `handleConnectionLost`, and the silent `AGENT_NOT_FOUND` return.

## Primary Code Touchpoints
- `src/services/agent/types.ts`: `AGENT_RELOGIN_SESSION_NOT_FOUND`, `AGENT_CONNECTION_LOST`, `AGENT_CONNECTION_RECONNECTED`.
- `src/cc.ts`:
  - `handleConnectionLost` becomes an arrow-function property that emits the two connection events;
  - `setupEventListeners` and `deregister` use the same reference;
  - the `silentRelogin` `AGENT_NOT_FOUND` branch runs `clearV2LocalState`, sets `isAgentLoggedIn = false`, and emits;
  - the `AgentLogoutSuccess` and `AgentMultiLoginCloseSession` cases run `clearV2LocalState` for this session.
- `test/unit/spec/cc.ts`:
  - `handleConnectionLost` (4) and `setupEventListeners()` (handler identity);
  - the session-not-found cases in `session version pin (server wins)`;
  - `clears the V2 session on a logout success for this session only`.
- `docs/samples/contact-center/app.js`, `index.html`: the `agent-session-status` alert and its listeners, plus the `agent:reloginSessionNotFound` teardown (`showStationLoginAfterSessionLoss`).
- Module specs: `src/docs/README.md` and `src/services/agent/docs/README.md` (section "Refresh and reconnect: SDK vs application").

## Ownership Boundary
- Owns: the `src/cc.ts` regions and the three constants above; the lifecycle tests; the sample session-status and session-not-found handling.
- Must NOT touch (owned by another task):
  - the V2 reload, recovery, and routing in `silentRelogin` → T2;
  - the V2 test block → T3.

## Multi-Repo Scope
N/A — single target repo.

## Dependencies / Execution Stream
| This task | Depends on (blocked-by) | Parallel-safe with | Wave / stream |
|---|---|---|---|
| T4 | T2 (`clearV2LocalState`, `silentRelogin`) | T3 | 3 |

## Acceptance Criteria
- [x] `agent:connectionLost` on socket loss; `agent:connectionReconnected` before the relogin, also when automated relogin is off; nothing for keepalives.
- [x] On `AGENT_NOT_FOUND`: state cleared, `isAgentLoggedIn` false, `agent:reloginSessionNotFound {agentId}` emitted once; not emitted on success.
- [x] `deregister()` removes the same `connectionLost` handler that `register()` added.
- [x] Own-session `AgentLogoutSuccess` and `AgentMultiLoginCloseSession` clear the V2 state; other sessions do not.
- [x] Sample shows "Connection lost. Reconnecting…" and "Reconnected. Restoring your session…", clears it on relogin or login, and shows station login on session not found.

## Verifier Exit Criteria
- [x] Relogin behavior on V1 sessions matches `next` apart from the added events.
- [x] No new console logs in the SDK or the sample.
- [x] `tsc` clean (`// @ts-ignore` on `emit`, the file-wide pattern).

## Traceability
| Requirement / rule id | Code symbol (class.method / file) | Test that proves it |
|---|---|---|
| R-15 | `ContactCenter.handleConnectionLost` | `handleConnectionLost` (4) |
| R-16 | `ContactCenter.silentRelogin` (`AGENT_NOT_FOUND`) | `clears the session and marks the agent logged out on AGENT_NOT_FOUND`; `does not emit session-not-found when the reload succeeds` |
| R-17 | `setupEventListeners`, `deregister`, `handleWebsocketMessage` (`AgentLogoutSuccess`) | `registers the same handler reference that deregister removes`; `clears the V2 session on a logout success for this session only` |

## Coverage Expectation
- Every new branch covered; within the package 85% gate.

## Cross-Cutting Prompts
- **Logging:** existing `LoggerProxy` lines for connection loss, reconnect, and `AGENT_NOT_FOUND`; none added.
- **Metrics:** N/A.
- **Security:** N/A.
- **Idempotency:** the reload runs once per reconnect; stable handler identity prevents stacked listeners.
- **Rollout:** applies to V1 and V2 sessions; additive events.

## Non-Goals / Out-of-Scope
- Retries, an automatic `stationLogin`, or UI policy in the SDK.

## References
- Epic: [`./epic.md`](./epic.md) · Implementation plan: [`./implementation-plan-t4.md`](./implementation-plan-t4.md)
- Feature design: [`../../design/feature-design.md`](../../design/feature-design.md) · Contract: [`../../design/contracts/v2-reload.md`](../../design/contracts/v2-reload.md) · Baseline: [`.sdd/manifest.json`](../../../../../.sdd/manifest.json)
