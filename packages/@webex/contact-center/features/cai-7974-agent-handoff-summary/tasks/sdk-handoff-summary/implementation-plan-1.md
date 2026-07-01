# Implementation Plan - Implement SDK handoff summary helpers and events

## Task Context
| Field | Value |
|---|---|
| Task | `./task-1.md` |
| Parent epic / feature | `./epic.md` / `../../design/feature-design.md` |
| Target repo(s) / module(s) | `webex/webex-js-sdk` / `packages/@webex/contact-center` |
| Execution stream / wave | wave 1 |
| created_by / date | Codex / 2026-06-30 |
| Generated from | `implementation-plan` @ SDLC template library `0.2.0` |

## Current Context (code-grounded)
- `Task` currently exposes consult, transfer, and conference methods, but no handoff summary helper - evidence: `src/services/task/index.ts`.
- `ITask` and `TASK_EVENTS` currently expose task lifecycle events, but no handoff summary event - evidence: `src/services/task/types.ts`.
- `TaskManager` currently routes task websocket events and transcript request triggers, but has no `MID_CALL_SUMMARY`, `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT`, or `FEATURE_ENABLEMENT` handling - evidence: `src/services/task/TaskManager.ts`.
- `ApiAIAssistant.sendEvent` currently always includes an action and types it as `TranscriptAction` - evidence: `src/services/ApiAiAssistant.ts`, `src/types.ts`.
- Agent config already has `generatedSummaries.consultTransferSummariesEnabled` - evidence: `src/services/config/types.ts`.

## Proposed Approach & Sequencing
1. Add public handoff action/payload types and task event enum values.
2. Inject `ApiAIAssistant` into newly created `Task` instances so helper methods can reuse existing transport.
3. Add `requestHandoffSummary()` and `respondToHandoffSummary()` on `Task`.
4. Generalize `ApiAIAssistant.sendEvent()` to allow optional actions and generic event detail fields.
5. Add backend event names and route summary/response/enablement websocket messages in `TaskManager`.
6. Add unit tests for helper, transport, websocket routing, and enablement.
7. Update module specs and standing docs for spec currency.

## API / Interface Changes
- Adds `ITask.requestHandoffSummary(payload?)`.
- Adds `ITask.respondToHandoffSummary(payload)`.
- Adds handoff summary task event enum values.
- Extends `ApiAIAssistant.sendEvent(...)` with optional action and optional event data.

## Contract Changes
- Provides ADDED task public API and task events -> `../../design/contracts/handoff-summary-task-api.md`.
- Requires MODIFIED AI Assistant `/event` usage -> `../../design/contracts/ai-assistant-handoff-event.md`.
- Requires consumed backend websocket events `MID_CALL_SUMMARY`, `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT`, and optional `FEATURE_ENABLEMENT`.

## Backward-Compat / Rollback
- **Compatibility:** additive SDK surface; no existing method/event removed.
- **Consumer transition / deprecation:** none.
- **Rollback:** revert helper/event additions and docs; backend flag can remain disabled to avoid consumer exposure.

## Logs / Metrics / Alerting
- Reuse existing `AI_ASSISTANT_SEND_EVENT_SUCCESS` and `AI_ASSISTANT_SEND_EVENT_FAILED` metrics.
- Log disabled/missing service failures through task helper error paths without credential payloads.

## Implementation Caveats
- Backend summary payload schema is not available in repo; do not hard-code summary body fields.
- `FEATURE_ENABLEMENT` payload may be nested differently; read only a boolean `consultTransferSummariesEnabled` from common top-level/nested locations.

## Anticipated PR Split
| PR | Scope | Depends on |
|---|---|---|
| PR1 | SDK helpers/events/routing/tests/docs | none |

## Manual Validation
- [ ] With backend feature enabled, request a consult-transfer summary from a widget and confirm `task:handoffSummary` is emitted.
- [ ] With backend feature disabled, confirm helper rejects and widget can hide/disable affordance.

## AI Docs Impact

### `webex/webex-js-sdk` - `packages/@webex/contact-center`
| Field | Value |
|---|---|
| Manifest | package SDD baseline |
| Standing docs root | `ai-docs/` |

| Doc / source | Decision | Reason / trigger | Required update or no-impact reason |
|---|---|---|---|
| Touched module spec(s) | required | public surface, event routing, protocol, tests | update task and AI Assistant specs; config/metrics if needed |
| `ai-docs/SPEC_INDEX.md` | not required | module registry and routing paths unchanged | no routing change |
| `ai-docs/CONTRACTS.md` | required | public helper/event and AI Assistant event contract delta | add handoff summary task/API entries |
| Native schema/API source | required | package entry point/type source changes | update TypeScript source; generated API docs built by existing tooling |
| `ai-docs/SERVICE_STATE.md` | required | current event/helper/flag surface changes | add handoff summary surface |
| `ai-docs/DATA_MODEL.md` | not required | no owned datastore/data model | no file exists/needed for this package |
| `ai-docs/SECURITY.md` | not required | existing authenticated request path reused; no new auth scope | no security posture change |
| `ai-docs/GLOSSARY.md` | required | new handoff summary terms/events | add terms |
| `ai-docs/ARCHITECTURE.md` | required | interaction flow adds handoff summary block | update AI/task flow summary |
| `ai-docs/RULES.md` | not required | no new enforceable coding rule | existing public-surface/doc rule applies |
| README / public API / help / release docs | not required | package docs/specs cover API; release notes not requested | leave to release process |

## Documentation Updates
### `webex/webex-js-sdk`
- Update `src/services/task/ai-docs/task-lifecycle-spec.md`.
- Update `src/services/ai-docs/ai-assistant-spec.md`.
- Update `src/services/config/ai-docs/configuration-lookup-apis-spec.md` if event constants are documented there.
- Update `ai-docs/CONTRACTS.md`.
- Update `ai-docs/SERVICE_STATE.md`.
- Update `ai-docs/GLOSSARY.md`.
- Update `ai-docs/ARCHITECTURE.md`.

## References
- Task: `./task-1.md`
- Epic: `./epic.md`
- Feature design: `../../design/feature-design.md`
