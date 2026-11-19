# Implementation Plan — T4: Session lifecycle signals for refresh and reconnect

> Start here → package [`AGENTS.md`](../../../../../AGENTS.md) (agent entry) · router [`docs/specs/README.md`](../../../../../docs/specs/README.md). This plan builds its task [`task-t4.md`](./task-t4.md) under epic [`epic.md`](./epic.md); design is [`feature-design.md`](../../design/feature-design.md).
> Context-efficiency: event behavior lives in [`v2-reload.md`](../../design/contracts/v2-reload.md).

## Task Context
| Field | Value |
|---|---|
| Task | [`./task-t4.md`](./task-t4.md) |
| Parent epic / feature | [`./epic.md`](./epic.md) · [`../../design/feature-design.md`](../../design/feature-design.md) |
| Target repo(s) / module(s) | `webex/webex-js-sdk` · `@webex/contact-center` (`src/cc.ts`, `src/services/agent/types.ts`); `docs/samples/contact-center` |
| Execution stream / wave | wave 3 |
| created_by / date | SDK vs application review / 2026-11-19 |
| Generated from | `implementation-plan` @ SDLC template library `0.2.0` |

## Current Context (code-grounded)
- On `next`, `handleConnectionLost` logs the loss and the reconnect and runs `silentRelogin()`. It has two TODOs: "Emit an event to the client". Evidence: `src/cc.ts` on `next`.
- On `next`, `silentRelogin` returns silently on `AGENT_NOT_FOUND`, so an application driven by events is never told.
- `setupEventListeners` registered `this.handleConnectionLost.bind(this)` while `deregister()` removed a different bound reference, so the listener leaked across register and deregister cycles.
- The agent docs had no statement of what the SDK owns versus the application.

## Proposed Approach & Sequencing
1. Add `AGENT_RELOGIN_SESSION_NOT_FOUND`, `AGENT_CONNECTION_LOST`, `AGENT_CONNECTION_RECONNECTED` to `AGENT_EVENTS`.
2. Change `handleConnectionLost` into an arrow-function property:
   - emit `agent:connectionLost` on loss;
   - emit `agent:connectionReconnected` on reconnect before the relogin, whatever `allowAutomatedRelogin` is set to.
3. Use `this.handleConnectionLost` in `setupEventListeners` and `deregister`.
4. In the `AGENT_NOT_FOUND` branch, run `clearV2LocalState()`, set `isAgentLoggedIn = false`, and emit `agent:reloginSessionNotFound {agentId}`.
5. Clear the V2 state on `AgentLogoutSuccess` and `AgentMultiLoginCloseSession` for this session (before the event is emitted).
6. Tests:
   - `handleConnectionLost` (4) and the handler-identity test;
   - the session-not-found cases;
   - the own-session logout case.
7. Sample:
   - the `agent-session-status` alert with listeners for the two connection events, cleared on relogin, channel relogin, login, and deregister;
   - an `agent:reloginSessionNotFound` handler that tears down the UI and shows station login.
8. Docs: add the section "Refresh and reconnect: SDK vs application" and the events table in `src/services/agent/docs/README.md`; update R-004, R-005, the recovery flow, and UC-4 in `src/docs/README.md`.

## API / Interface Changes
- Three new events, payloads `{}`, `{}`, `{agentId}`. Source: `src/services/agent/types.ts`.

## Contract Changes
- Provides ADDED: `agent:connectionLost`, `agent:connectionReconnected`, `agent:reloginSessionNotFound` → [`v2-reload.md`](../../design/contracts/v2-reload.md).
- Index: `contact-center-agent-events` row and the ConnectionService interaction row in `docs/architecture.md`; manifest summary.

## Backward-Compat / Rollback
- **Compatibility:** additive events. Relogin behavior unchanged on V1. `AGENT_NOT_FOUND` now also sets `isAgentLoggedIn = false`, which was already the server truth.
- **Consumer transition / deprecation:** none.
- **Rollback:** revert; applications that do not listen see no change.

## Logs / Metrics / Alerting
- Existing `LoggerProxy` lines only; no new logs in the SDK or the sample (standing constraint).

## Implementation Caveats
- On page load `agent:reloginSessionNotFound` can fire inside `register()`, before the application attaches listeners. Applications also check the `register()` result.
- The event also fires when the agent was registered but never logged in.
- A reload error other than `AGENT_NOT_FOUND` on reconnect is rethrown inside the listener. That was already true on `next`.
- `// @ts-ignore` is required on `emit` (the file-wide pattern; `WebexPlugin` types lack `emit`).

## Anticipated PR Split
| PR | Scope (one logical concern) | Depends on |
|---|---|---|
| Single feature PR | T1 to T4 together (epic decision) | — |

## Manual Validation
- [ ] Sample: drop the network → "Connection lost. Reconnecting…"; restore → "Reconnected. Restoring your session…" → cleared on relogin.
- [ ] Sample: log out from another client, then refresh → station login shown.

## AI Docs Impact

### webex/webex-js-sdk — `@webex/contact-center`
| Field | Value |
|---|---|
| Manifest | `packages/@webex/contact-center/.sdd/manifest.json` |
| Standing docs root | `packages/@webex/contact-center/docs/`; module specs at `src/**/docs/README.md` |

| Doc / source | Decision (required / not required / blocked) | Reason / trigger | Required update or no-impact reason |
|---|---|---|---|
| Touched module spec(s) | required | New events, changed recovery flow, SDK vs application boundary | `src/services/agent/docs/README.md`, `src/docs/README.md` |
| Router (`docs/specs/README.md`) | not required | No routing change | — |
| Contract index (`docs/architecture.md`) and `contract_catalog` | required | Agent events extended; ConnectionService interaction changed | Rows updated; manifest summary updated |
| Native schema/API source | required | `AGENT_EVENTS` | `src/services/agent/types.ts` |
| SERVICE_STATE / DATA_MODEL / SECURITY / GLOSSARY | not required | Not present or not affected | — |
| ARCHITECTURE (`docs/architecture.md` body) | required | ConnectionService → ContactCenter interaction row | Updated |
| RULES (`AGENTS.md`) | not required | No new convention | — |
| README / public API / help / release docs | required | Typedoc on the events; sample behavior | JSDoc in `types.ts`; sample feature spec |

## Documentation Updates
### webex/webex-js-sdk
- `src/services/agent/docs/README.md`: events table, recovery flow, "Refresh and reconnect: SDK vs application".
- `src/docs/README.md`: R-004, R-005, recovery diagram, UC-4.
- `docs/architecture.md`: ConnectionService row, `contact-center-agent-events` row; manifest summary.
- Sample feature spec: session status and session-not-found teardown.

## References
- Task: [`./task-t4.md`](./task-t4.md) · Epic: [`./epic.md`](./epic.md) · Feature design: [`../../design/feature-design.md`](../../design/feature-design.md)
