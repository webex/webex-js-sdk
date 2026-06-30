# Task - Implement SDK handoff summary helpers and events

## Metadata
| Field | Value |
|---|---|
| Task title | Implement SDK handoff summary helpers and events |
| Parent epic | `./epic.md` |
| Parent feature | `../../design/feature-design.md` and `../../spec/feature-spec.md` |
| Task type | API / observability / docs |
| Target repo(s) / module(s) | `webex/webex-js-sdk` / `packages/@webex/contact-center` |
| Tracker key | `CAI-7974` |
| State | implemented |
| created_by / approved_by / date | Codex generator / user chat approval / 2026-06-30 |
| Generated from | `task` @ SDLC template library `0.2.0` |

## Source Mapping
- Implements Feature Architecture -> Task handoff helper block, AI Assistant event transport, websocket handoff router, public event/type catalog.

## Primary Code Touchpoints
- `src/services/task/index.ts` - add public helper methods and feature flag gate.
- `src/services/task/types.ts` - add task events, payload/action types, and `ITask` methods.
- `src/services/task/TaskManager.ts` - route handoff summary websocket events and enablement messages.
- `src/services/task/constants.ts` - add method names if needed.
- `src/services/ApiAiAssistant.ts` - allow optional action and generic event details.
- `src/types.ts` - add shared AI Assistant action type.
- `src/services/config/types.ts` - add backend handoff summary event names.
- `test/unit/spec/services/task/index.ts` - test task helpers.
- `test/unit/spec/services/task/TaskManager.ts` - test websocket routing and enablement handling.
- `test/unit/spec/services/ApiAiAssistant.ts` - test generalized event details.
- `ai-docs/CONTRACTS.md`, `ai-docs/SERVICE_STATE.md`, `ai-docs/GLOSSARY.md`, `ai-docs/ARCHITECTURE.md`, module specs - spec currency.

## Ownership Boundary
- Owns: the files listed in Primary Code Touchpoints and the feature package under `features/cai-7974-agent-handoff-summary/`.
- Must NOT touch: unrelated packages under `packages/@webex/*`, backend repositories, widget UI code outside optional docs/samples, and unrelated task lifecycle behavior.

## Multi-Repo Scope
| Target repo | Module/component | Why included in this task | Manifest / standing docs root |
|---|---|---|---|
| `webex/webex-js-sdk` | `packages/@webex/contact-center` | single target package | `ai-docs/` |

## Dependencies / Execution Stream
| This task | Depends on | Parallel-safe with | Wave / stream |
|---|---|---|---|
| T1 | soft-committed design | N/A | wave 1 |

## Acceptance Criteria
- [x] `Task.requestHandoffSummary()` sends `GET_MID_CALL_SUMMARY` through `ApiAIAssistant` when enabled.
- [x] `Task.requestHandoffSummary()` rejects without sending when `consultTransferSummariesEnabled` is false or absent.
- [x] `Task.respondToHandoffSummary()` sends `MID_CALL_SUMMARY_RESPONSE` with a typed action.
- [x] `TaskManager` emits semantic task events for `MID_CALL_SUMMARY` and `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT`.
- [x] `TaskManager` updates generated summary enablement when `FEATURE_ENABLEMENT` contains a boolean flag.
- [x] Existing transcript tests still pass.
- [x] SDD docs/specs/contracts are updated in the same change.

## Verifier Exit Criteria
- [x] Unit tests pass for `services/task/index.ts`, `services/task/TaskManager.ts`, and `services/ApiAiAssistant.ts` assertions; targeted commands exit non-zero only because repo global coverage thresholds apply to single-target runs.
- [x] No edits outside the ownership boundary are intended for PR staging.
- [x] Public surface changes are reflected in task and AI Assistant module specs plus `ai-docs/CONTRACTS.md`.
- [ ] Feature review is run on a different runtime from Codex or explicitly handed off.

## Traceability
| Requirement / rule id | Code symbol | Test that proves it |
|---|---|---|
| R-1/R-3 | `Task.requestHandoffSummary` | `test/unit/spec/services/task/index.ts` |
| R-2 | `Task.respondToHandoffSummary` | `test/unit/spec/services/task/index.ts` |
| R-4/R-5 | `TaskManager.registerTaskListeners` | `test/unit/spec/services/task/TaskManager.ts` |
| R-6 | `TaskManager.handleHandoffSummaryFeatureEnablement` | `test/unit/spec/services/task/TaskManager.ts` |
| R-7 | docs/types/specs | changed docs plus build/unit import coverage |

## Coverage Expectation
- Changed-line coverage >= 80%; evidence: package unit tests and CI coverage report.

## Cross-Cutting Prompts
- **Logging:** use existing logger conventions; do not log tokens or sensitive payloads.
- **Metrics:** reuse `ApiAIAssistant` send-event success/failure metrics.
- **Security:** no new auth surface; use existing Webex SDK authenticated request path.
- **Idempotency:** helpers are user-action sends; SDK does not retry or de-duplicate.
- **Rollout:** gated by existing generated summary feature flag and optional backend enablement event.

## Non-Goals / Out-of-Scope
- Backend summary generation.
- Durable summary storage.
- Widget UI implementation.
- Cross-package changes outside `@webex/contact-center`.

## Feature-Flag & Rollout Assumptions
- Flag: `generatedSummaries.consultTransferSummariesEnabled` - default: disabled unless true - assumption: backend/product owns enablement.

## References
- Epic: `./epic.md`
- Implementation plan: `./implementation-plan-1.md`
- Feature design: `../../design/feature-design.md`
