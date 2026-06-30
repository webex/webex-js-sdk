# Feature Spec - Agent Handoff Summary events and public APIs

> Start here: repo root [`AGENTS.md`](../../../AGENTS.md) -> router [`SPEC_INDEX.md`](../../../ai-docs/SPEC_INDEX.md) -> system [`ARCHITECTURE.md`](../../../ai-docs/ARCHITECTURE.md). This spec captures WHAT and WHY; the design lives in [`feature-design.md`](../design/feature-design.md).

## Metadata
| Field | Value |
|---|---|
| Feature / ticket key | `cai-7974-agent-handoff-summary` / `CAI-7974` |
| Title | Agent Handoff Summary events and public APIs |
| Status | groomed |
| Change class | `contract-affecting` |
| created_by / approved_by / date | Codex generator / user chat approval / 2026-06-30 |
| Generated from | `feature-spec` @ SDLC template library `0.2.0` |

## Problem & Goal (WHAT + WHY)
**What:** Add Contact Center SDK support for Agent Handoff Summary flows by handling handoff summary websocket events, exposing task-level delivery events, and adding public helpers to request and respond to mid-call summaries.

**Why:** PR #4794 added the reusable AI Assistant transport, feature flags, generic AI Assistant event names, and transcript plumbing, but the handoff summary flow remains unavailable to SDK consumers. Widgets need a typed SDK path to request a consult/transfer handoff summary, receive the summary payload, and send cancel/consult/transfer responses without bypassing package-level task and AI Assistant conventions.

## Stakeholders & Open Questions
| Stakeholder / role | Interest in this feature | Sign-off needed? |
|---|---|---|
| CCSDK maintainers | Public SDK API, task event shape, typings, tests, and package compatibility | yes |
| WCC AI Assistant/backend owners | `/event` semantics and websocket payload contracts | yes |
| Widget / SDK consumers | Event delivery and helper ergonomics for consult/transfer handoff summary flows | yes |
| QA / release validation | Disabled/enabled feature behavior, event routing, and regression coverage | yes |

**Open questions:**
- **Q-1 Exact backend message fields** - owner: WCC backend/product - blocks: fixed schema docs only - status: deferred to backend contract. The SDK will pass through backend payloads as typed generic records until a canonical schema exists.
- **Q-2 Sample app scope** - owner: CCSDK maintainers - blocks: optional demo updates only - status: deferred. Core SDK docs/tests are in scope for this PR.

## Scope
**In scope:**
- Reuse `ApiAIAssistant` and `/event` for handoff summary request and response events.
- Gate summary requests on `agentConfig.aiFeature.generatedSummaries.consultTransferSummariesEnabled`.
- Handle optional `FEATURE_ENABLEMENT` messages if backend sends handoff summary enablement state.
- Handle `MID_CALL_SUMMARY` and `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` websocket messages.
- Emit task-level event(s) for summary delivery and subsequent-agent responses.
- Add typed task helper(s) for requesting a handoff summary and responding with cancel, consult, or transfer actions.
- Add TypeScript types, unit tests, and SDD documentation for the new public surface.

**Out of scope:**
- Backend AI summary generation or schema ownership.
- Datastore, schema, migration, or durable summary storage changes in this package.
- Widget UI implementation outside SDK APIs/events.
- Real-time transcript behavior changes beyond coexistence with shared AI Assistant plumbing.
- Repository host migration; CCSDK source is `webex/webex-js-sdk`.

**Open decisions:** exact backend payload fields remain backend-owned; the SDK contract is additive and payload-pass-through until a machine-readable schema is supplied.

## Requirements
| Req ID | Requirement (WHAT) | Rationale (WHY) | Acceptance (how proven) | State |
|---|---|---|---|---|
| R-1 | The task API must expose a public helper to request a mid-call handoff summary for the task interaction. | SDK consumers need one supported entrypoint instead of calling AI Assistant transport directly. | Calling the helper with the feature enabled sends `GET_MID_CALL_SUMMARY` through `ApiAIAssistant`; disabled state rejects without sending. | Agreed |
| R-2 | The task API must expose a public helper to respond to a handoff summary with cancel, consult, or transfer actions. | The widget needs a typed SDK response path that matches backend handoff decisions. | Calling the helper sends `MID_CALL_SUMMARY_RESPONSE` with a typed action and interaction id. | Agreed |
| R-3 | Summary request helpers must honor `generatedSummaries.consultTransferSummariesEnabled`. | Existing config flags decide whether generated summary behavior is available to the agent. | Unit tests cover enabled and disabled flag states. | Agreed |
| R-4 | `TaskManager` must route `MID_CALL_SUMMARY` websocket messages to the owning task. | Widgets consume task events, not raw websocket manager events. | A websocket message with matching conversation/interaction id emits the new task summary event. | Agreed |
| R-5 | `TaskManager` must route `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` websocket messages to the owning task. | Subsequent-agent handoff responses must be observable through the same task event surface. | A websocket message with matching conversation/interaction id emits the new task response event. | Agreed |
| R-6 | `TaskManager` must process optional `FEATURE_ENABLEMENT` messages without breaking existing transcript/task routing. | Backend may send enablement separately from static config. | Unit tests verify enablement updates the AI feature flag and preserves existing event routing. | Agreed |
| R-7 | Public events/types and SDD docs must describe the new additive SDK surface. | Public SDK changes must be discoverable and spec-current. | `TASK_EVENTS`, task types, `CONTRACTS.md`, module specs, and feature docs include the delta. | Agreed |

## Acceptance Criteria
- `task.requestHandoffSummary()` sends `GET_MID_CALL_SUMMARY` only when `consultTransferSummariesEnabled` is true (R-1, R-3).
- `task.respondToHandoffSummary({action})` sends `MID_CALL_SUMMARY_RESPONSE` with one of cancel, consult, or transfer actions (R-2).
- `MID_CALL_SUMMARY` websocket messages emit a task-level handoff summary event with the backend payload (R-4).
- `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` websocket messages emit a task-level response event with the backend payload (R-5).
- `FEATURE_ENABLEMENT` updates the SDK's AI feature flag when it carries `consultTransferSummariesEnabled` and otherwise remains non-disruptive (R-6).
- Unit tests cover enabled, disabled, websocket routing, response helper, and generalized `/event` payload behavior (R-1..R-7).
- SDD and contract docs are updated in the same change as code (R-7).

## Success & Guardrail Metrics
| Metric | Type | Baseline | Target / bound | How measured |
|---|---|---|---|---|
| Handoff summary request helper sends correct AI Assistant event | success | no helper | covered by unit test | `test/unit/spec/services/task/index.ts` |
| Handoff summary websocket delivery emits task event | success | no routed event | covered by unit test | `test/unit/spec/services/task/TaskManager.ts` |
| Disabled flag suppresses request | guardrail | transcript flag already suppresses transcript requests | no AI Assistant request when disabled | `test/unit/spec/services/task/index.ts` |
| Existing transcript start/stop routing | guardrail | PR #4794 behavior | existing TaskManager transcript tests still pass | `test/unit/spec/services/task/TaskManager.ts` |
| Existing `ApiAIAssistant.sendEvent` transcript shape | guardrail | `GET_TRANSCRIPTS` with `START`/`STOP` | existing ApiAIAssistant tests still pass | `test/unit/spec/services/ApiAiAssistant.ts` |

## Prior-Work Register
| Existing artifact | How it relates | Reuse / extend / supersede |
|---|---|---|
| `src/services/ApiAiAssistant.ts` | Existing AI Assistant `/event` transport and feature flag holder | extend |
| `src/types.ts` | Existing generic AI Assistant event names include `GET_MID_CALL_SUMMARY` and `MID_CALL_SUMMARY_RESPONSE` | reuse/extend |
| `src/services/config/types.ts` | Existing `generatedSummaries.consultTransferSummariesEnabled` config flag | reuse |
| `src/services/task/TaskManager.ts` | Existing websocket-to-task event router and transcript request trigger | extend |
| `src/services/task/types.ts` | Public task event enum and `ITask` interface | extend |

## Contracts Delta
**Provides:**
- ADDED `ITask.requestHandoffSummary(...)` public helper.
- ADDED `ITask.respondToHandoffSummary(...)` public helper.
- ADDED `TASK_EVENTS.TASK_HANDOFF_SUMMARY`, `TASK_EVENTS.TASK_HANDOFF_SUMMARY_RESPONSE`, and `TASK_EVENTS.TASK_HANDOFF_SUMMARY_FEATURE_ENABLEMENT`.
- ADDED public handoff summary action/payload types.
- MODIFIED `ApiAIAssistant.sendEvent(...)` to support optional action and additional event detail fields while preserving transcript usage.

**Requires:**
- ADDED consumed websocket event names: `MID_CALL_SUMMARY`, `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT`, and optional `FEATURE_ENABLEMENT`.
- MODIFIED AI Assistant `/event` usage for `GET_MID_CALL_SUMMARY` and `MID_CALL_SUMMARY_RESPONSE`.
- REUSES existing WCC API gateway, AI Assistant URL mapping, and SDK request plumbing.

## Impacted Modules / Repos
| Module / repo | Impact | Manifest coverage state |
|---|---|---|
| `src/` | Shared AI Assistant action type and public package exports/types | Specced |
| `src/services/task/` | Public task helpers, events, websocket routing, unit tests | Specced |
| `src/services/ApiAiAssistant.ts` | Generalized event payload transport | Specced |
| `src/services/config/` | Adds optional backend enablement websocket event name handling | Specced |
| `src/metrics/` | Existing AI Assistant send-event metrics continue to cover request/response sends | Specced |

## Feasibility & Risks
- **Feasibility:** Buildable in this package by extending existing AI Assistant transport and task event routing. Backend exact payload fields are unknown, so SDK payload types stay generic and additive.
- **Spikes needed:** none for SDK mechanics; backend schema follow-up remains external.
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Backend sends different payload nesting for summary events | medium | medium | Resolve task id from `interactionId`, `conversationId`, and nested `data.conversationId`; pass payload through unchanged. |
| Backend expects lower/upper-case response actions differently | medium | high | Expose constants and centralize action typing; backend owners must confirm before GA. |
| New event routing disrupts transcript routing | low | high | Keep transcript map unchanged and cover existing transcript tests. |

## Interaction / Scenario Matrix
| Scenario / condition combination | Expected behavior | Covered by |
|---|---|---|
| feature flag true x task helper request | AI Assistant `GET_MID_CALL_SUMMARY` event sent | R-1/R-3 |
| feature flag false or absent x task helper request | helper rejects and does not send event | R-3 |
| `FEATURE_ENABLEMENT` says enabled x existing config disabled | SDK feature flag holder updates to enabled | R-6 |
| `MID_CALL_SUMMARY` x known task id | task emits handoff summary event and raw backend event | R-4 |
| `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` x known task id | task emits response event and raw backend event | R-5 |
| existing transcript-mapped events x realtime transcripts enabled | existing transcript request behavior remains | guardrail |

## Migration Expectations
- Additive public API and event surface only. Existing task methods, task events, transcript events, and AI Assistant transcript calls remain compatible.
- Consumers may opt into the new helpers/events when backend handoff summary support is enabled.

## Rollout & Flags
| Flag | Purpose | Default | New/Existing |
|---|---|---|---|
| `agentConfig.aiFeature.generatedSummaries.consultTransferSummariesEnabled` | Gates handoff summary helper requests | backend/config controlled; treated as disabled unless true | existing |
| `FEATURE_ENABLEMENT` websocket payload | Optional runtime enablement update if backend sends it | no effect unless payload includes a boolean enablement value | backend event |

## Serviceability
- Reuse `ApiAIAssistant` send-event success/failure metrics for handoff request and response sends.
- Log disabled/missing AI Assistant service conditions through task helper error paths without logging tokens or sensitive payloads.
- Keep websocket payloads pass-through; no raw Authorization or credential fields are logged.

## Documentation Obligations
- Update feature spec/design/task docs.
- Update `src/services/task/ai-docs/task-lifecycle-spec.md`.
- Update `src/services/ai-docs/ai-assistant-spec.md`.
- Update `ai-docs/CONTRACTS.md`, `ai-docs/SERVICE_STATE.md`, `ai-docs/GLOSSARY.md`, and `ai-docs/ARCHITECTURE.md` where the public/event surface changes.

## API / Event Contract
- `task.requestHandoffSummary(payload?)` -> `design/contracts/handoff-summary-task-api.md`; source: `src/services/task/index.ts`, `src/services/task/types.ts`.
- `task.respondToHandoffSummary(payload)` -> `design/contracts/handoff-summary-task-api.md`; source: `src/services/task/index.ts`, `src/services/task/types.ts`.
- `ApiAIAssistant.sendEvent(...)` generalized event details -> `design/contracts/ai-assistant-handoff-event.md`; source: `src/services/ApiAiAssistant.ts`.

## Event Contract
- Consumes backend websocket event `MID_CALL_SUMMARY`; emits SDK task event `task:handoffSummary`.
- Consumes backend websocket event `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT`; emits SDK task event `task:handoffSummaryResponse`.
- Consumes optional backend websocket event `FEATURE_ENABLEMENT`; emits SDK task event/manager event `task:handoffSummaryFeatureEnablement` when routed.
- Delivery/ordering follows existing task websocket event delivery; no new replay/idempotency guarantee is added.

## Public API & Semver Impact
- Adds public task helper methods and task event enum values.
- Adds public types for handoff summary actions and payloads.
- Semver impact: minor/additive for SDK consumers.

## Spec State
| Section | State |
|---|---|
| Problem & Goal | complete |
| Stakeholders & Open Questions | complete |
| Scope | complete |
| Requirements | complete |
| Acceptance Criteria | complete |
| Success & Guardrail Metrics | complete |
| Prior-Work Register | complete |
| Contracts Delta | complete |
| Impacted Modules | complete |
| Conditional sections | complete; backend payload schema remains intentionally generic |

## Change Log
| Date | Change | By | Why |
|---|---|---|---|
| 2026-06-30 | Created groomed feature spec from CAI-7974 intake | Codex | Advance SDLC lifecycle to Discovery/Implementation |

## References
- Intake summary: `../intake-summary.md`
- Feature design: `../design/feature-design.md`
- Test plan: `../test-strategy.md`
- Jira: `CAI-7974`
- Prior work: `webex/webex-js-sdk#4794`
