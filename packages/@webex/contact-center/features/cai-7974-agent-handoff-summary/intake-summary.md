# Intake Summary - cai-7974-agent-handoff-summary

## Source
- Jira: `CAI-7974`
- GitHub: `webex/webex-js-sdk#4794` (`feat(contact-center): real time transcript`; merged 2026-03-26)
- Local code: `packages/@webex/contact-center`

## WHAT (user language)
Add Contact Center SDK support for Agent Handoff Summary flows by handling handoff summary websocket events, exposing task-level delivery events, and adding public helpers to request and respond to mid-call summaries.

## WHY (problem / goal)
PR #4794 added the reusable AI Assistant transport, feature flags, generic AI Assistant event names, and transcript plumbing, but the handoff summary flow remains unavailable to SDK consumers. Widgets need a typed SDK path to request a consult/transfer handoff summary, receive the summary payload, and send cancel/consult/transfer responses without bypassing package-level task and AI Assistant conventions.

## Scope
**In scope:**
- Reuse the existing `ApiAIAssistant` service and `/event` transport for handoff summary requests and responses.
- Gate summary requests on `agentConfig.aiFeature.generatedSummaries.consultTransferSummariesEnabled`.
- Handle optional backend `FEATURE_ENABLEMENT` messages if they are sent for handoff summary enablement.
- Handle `MID_CALL_SUMMARY` and `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` websocket messages.
- Emit task-level event(s) for mid-call summary delivery so SDK consumers can receive the payload from task flows.
- Expose typed task helper(s) for requesting mid-call summaries and responding with cancel, consult, or transfer actions.
- Add or update TypeScript types, event constants, unit tests, and SDK/SDD documentation for the new public surface.

**Out of scope:**
- Implementing or changing backend AI summary generation.
- Owning datastore, schema, migration, or durable summary storage changes in this package.
- Building widget UI flows outside the SDK package; sample/demo updates are secondary documentation, not the core feature.
- Changing real-time transcript behavior except where shared AI Assistant plumbing must coexist with handoff summary behavior.
- Repository migration is out of scope; the confirmed source repo for CCSDK is `webex/webex-js-sdk`.

## Change Class
`contract-affecting`

Rationale: the feature adds or modifies public SDK task helpers, public TypeScript/event surface, consumed websocket messages, and AI Assistant `/event` request semantics. It does not add owned persistence, package UI screens, or CI/CD changes.

Derived feature profile keys from the section question bank:
- `changes_api=true`
- `changes_public_api=true`
- `nontrivial_interface=true`
- `feature_nontrivial=true`
- `feature_interactions=true`
- `backward_compat=true`
- `needs_rollout=true`
- `serviceability=true`
- `doc_obligations=true`
- `wire_protocol=true`
- `changes_events=true`

## Touched Modules
| Module | Coverage | Why touched | Impact (one line) |
|---|---|---|---|
| `src/` | Specced | Public package exports and shared TypeScript types live here. | Add/adjust exported task, AI Assistant, and event types without breaking existing consumers. |
| `src/services/task/` | Specced | TaskManager owns websocket-to-task event routing and task helpers. | Add handoff summary message handling, task event emission, and task helper entrypoints. |
| `src/services/ApiAiAssistant.ts` | Specced | Existing AI Assistant service owns `/event` transport and feature flags. | Reuse or generalize `sendEvent` for handoff summary request/response flows. |
| `src/services/config/` | Specced | Agent config owns `aiFeature.generatedSummaries.consultTransferSummariesEnabled`. | Ensure handoff summary requests honor the generated summary flag and any backend enablement event. |
| `src/metrics/` | Specced | AI Assistant service calls already emit success/failure metrics. | Preserve observability for new handoff summary request/response operations. |
| `src/services/core/` | Specced | Core owns websocket parsing and event propagation. | Watch module only unless discovery shows top-level websocket parsing needs additional support beyond PR #4794. |

## Acceptance Signals
- When `consultTransferSummariesEnabled` is false or absent, the SDK does not request a handoff summary.
- When the feature is enabled and a consult or transfer flow requests a summary, the SDK sends a typed AI Assistant event through the existing `ApiAIAssistant` `/event` transport.
- If backend sends `FEATURE_ENABLEMENT` for handoff summaries, the SDK handles it without breaking existing config or transcript behavior.
- On `MID_CALL_SUMMARY`, the SDK emits a task-level event with the summary payload for the owning interaction.
- On `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT`, the SDK handles the subsequent-agent response path and exposes it consistently to task consumers.
- A public helper sends the appropriate `MID_CALL_SUMMARY_RESPONSE` action for cancel, consult, and transfer responses.
- Unit tests cover disabled flag behavior, enabled request behavior, websocket event routing, helper responses, error/logging behavior, and exported typings/constants.
- SDK docs and SDD docs describe the added public surface and contract deltas.

## Open Questions
- **Q-1 Exact message payload shape** - owner: WCC backend / product - status: deferred-to-capture. Jira names `MID_CALL_SUMMARY`, `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT`, and `FEATURE_ENABLEMENT`, but does not define full payload schemas.
- **Q-2 Public helper and event names** - owner: CCSDK maintainers / product - status: deferred-to-capture. Code evidence confirms where helpers and event enums belong, but final names should be frozen in the feature spec before implementation.
- **Q-3 Enablement state semantics** - owner: WCC backend / CCSDK maintainers - status: deferred-to-discovery. Need to confirm whether `FEATURE_ENABLEMENT` updates package-level `agentConfig`, per-task state, or only gates the current flow.
- **Q-4 Sample app/docs outside package** - owner: CCSDK maintainers - status: deferred-to-capture. Core SDK docs are in scope; external sample updates should be confirmed before expanding beyond `packages/@webex/contact-center`.

## Contracts Delta (preliminary)
**Provides:**
- ADDED public task helper(s) for requesting mid-call handoff summaries and responding with cancel, consult, or transfer actions.
- ADDED task event(s) and TypeScript payload types for mid-call summary delivery.
- MODIFIED exported event/type surface in `src/types.ts` and package entrypoints as needed.

**Requires:**
- ADDED or MODIFIED WCC websocket event contracts for `MID_CALL_SUMMARY`, `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT`, and optional `FEATURE_ENABLEMENT`.
- MODIFIED AI Assistant `/event` usage for `GET_MID_CALL_SUMMARY` and `MID_CALL_SUMMARY_RESPONSE`.
- REUSES existing WCC API gateway and AI Assistant service discovery from `ApiAIAssistant`.

## Stakeholders
| Role | Interest | Sign-off needed? |
|---|---|---|
| CCSDK maintainers | Public SDK API, task event shape, typings, tests, and package compatibility | yes |
| WCC AI Assistant/backend owners | `/event` semantics and websocket payload contracts | yes |
| Widget / SDK consumers | Event delivery and helper ergonomics for consult/transfer handoff summary flows | yes |
| QA / release validation | Disabled/enabled feature behavior, event routing, and regression coverage | yes |

## Provenance
- Created by: Codex generator runtime
- Created at: 2026-06-30T10:58:42Z
- Source: `CAI-7974`, `webex/webex-js-sdk#4794`, local `packages/@webex/contact-center` code at `f4fd57010e`
- Run record: local-only SDD run record, not included in this Task 1 PR.
- Approved by: user approval in chat (`go ahead`) on 2026-06-30
