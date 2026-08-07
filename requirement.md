# Requirement: Contact Center MidCall and Post Call Summary

## Branch
cc-summaries 

## Description
### 1. Document purpose

This document defines the product and SDK requirements for exposing AI-generated call summaries to contact-center applications. It describes what the SDK must provide, why the behavior is required, and how completion will be accepted. It intentionally avoids implementation structure, source-code walkthroughs, and method internals.

The detailed technical specification and flow documents remain the implementation references:

- [`ai-summary.md`](./ai-summary.md)
- [`ai-summary-postcall-flow.md`](./ai-summary-postcall-flow.md)
- [`ai-summary-initiator-flow.md`](./ai-summary-initiator-flow.md)
- [`ai-summary-receiver-flow.md`](./ai-summary-receiver-flow.md)

### 2. Background and problem statement

Contact-center agents need concise context at two important moments:

1. After a customer interaction, when the agent reviews the outcome and completes wrap-up.
2. During a consult or transfer, when another agent needs enough context to continue the interaction without making the customer repeat information.

The AI Assistant backend can generate these summaries, but consuming applications need a stable SDK contract for requesting them, receiving asynchronous results, presenting editable content, and returning agent feedback and usage signals.

Without this SDK capability, each application would need to understand backend transport details, correlate events to tasks, and independently implement timeout, feature-gating, and response behavior. The requirement is therefore to expose a task-oriented, additive SDK API while leaving user-interface decisions to consuming applications.

### 3. Goals

#### G-1 — Post-call summary workflow

Enable an application to request an AI-generated summary for a task during wrap-up, receive it asynchronously, allow the agent to review or edit it, and return the final summary and interaction signals.

**Why:** Agents need a faster, more consistent wrap-up experience without losing control over the final record.

#### G-2 — Mid-call handoff workflow

Enable an initiating agent to request a summary before a consult or transfer, review or edit it, and send it before the existing consult or transfer action.

**Why:** The receiving agent needs useful context when the interaction is handed off, and the backend needs the initiator's final response before routing continues.

#### G-3 — Receiving-agent delivery

Deliver the initiator's mid-call summary to the task owned by the receiving agent.

**Why:** Handoff value is realized only when the correct receiver can consume the summary in the context of the correct interaction.

#### G-4 — Stable consumer contract

Support both Promise-based request flows and public event listeners without either mechanism suppressing the other.

**Why:** Single-session applications often prefer `await`, while multi-session applications and secondary panels rely on event subscriptions.

#### G-5 — Safe, additive adoption

Add the capability without changing existing wrap-up, consult, transfer, transcript, or event behavior.

**Why:** Existing consumers must be able to upgrade the SDK without migration or regression risk.

### 4. Users and stakeholders

| Actor | Need |
|---|---|
| Contact-center agent | Review, edit, copy, rate, accept, exclude, or cancel an AI summary. |
| Receiving agent | Receive useful context from the initiating agent during a consult or transfer. |
| Widget/application developer | Use a small task-level SDK surface without implementing backend transport or event correlation. |
| Contact-center administrator | Control availability through existing feature configuration. |
| Operations team | Measure requests, responses, failures, and feature enablement without exposing summary content. |
| AI Assistant backend | Receive correctly named request/response events and required interaction metadata. |

### 5. Scope

#### 5.1 In scope

- Task-level APIs for requesting post-call and mid-call summaries.
- Task-level APIs for sending the agent's response to those summaries.
- Public SDK events for post-call summaries, mid-call summaries, and receiving-agent summaries.
- An agent-level feature-enablement event.
- Feature gating through existing generated-summary flags.
- Correlation of inbound summary events to the appropriate task.
- Timeout, disabled-feature, HTTP-failure, malformed-event, and unknown-task behavior.
- Agent interaction signals: viewed, edited, copied, feedback, disposition state, wrap-up code, and agent name where applicable.
- Metrics and privacy-safe logging.
- Additive public types and constants required for SDK consumers.

#### 5.2 Out of scope

- Building a production widget or prescribing its visual design.
- Changing existing `wrapup`, `consult`, or `transfer` APIs.
- Changing backend endpoints or backend business logic.
- Generating summaries inside the SDK.
- Rendering or interpreting Adaptive Card layouts inside the SDK.
- Real-time transcript functionality.
- Automatic retries or backend deduplication.

### 6. Public SDK contract

#### 6.1 APIs to implement

| API | Purpose | Result |
|---|---|---|
| `task.requestPostCallSummary()` | Request the post-call summary for the current task. | Returns `Promise<PostCallSummaryEventPayload>`. |
| `task.sendPostCallSummaryResponse(payload)` | Send the agent's final post-call summary response and interaction signals. | Returns `Promise<void>`. |
| `task.requestMidCallSummary(actionType)` | Request a consult or transfer summary for the current task. | Returns `Promise<MidCallSummaryEventPayload>`. |
| `task.sendMidCallSummaryResponse(payload, actionType)` | Send the initiating agent's response for a consult or transfer summary. | Returns `Promise<void>`. |

`actionType` must accept exactly `CONSULT` or `TRANSFER`.

No new public method is required on the contact-center root object. Feature enablement is event-driven.

#### 6.2 Public events to implement

| External event | Owner | Consumer purpose |
|---|---|---|
| `cc:featureEnablement` | Contact-center client | Learn whether mid-call and post-call summaries are enabled for an interaction. |
| `task:postCallSummary` | Task | Receive a post-call summary payload. |
| `task:midCallSummary` | Task | Receive a mid-call summary for the initiating agent. |
| `task:midCallSummaryForReceivingAgent` | Task | Receive the handoff summary on the receiving agent's task. |

#### 6.3 Backend event names required

The SDK must support these request and response event names:

- `GET_POST_CALL_SUMMARY`
- `POST_CALL_SUMMARY_RESPONSE`
- `GET_MID_CALL_CONSULT_SUMMARY`
- `GET_MID_CALL_TRANSFER_SUMMARY`
- `MID_CALL_CONSULT_SUMMARY_RESPONSE`
- `MID_CALL_TRANSFER_SUMMARY_RESPONSE`

The SDK must recognize these inbound event names:

- `FEATURE_ENABLEMENT`
- `POST_CALL_SUMMARY`
- `MID_CALL_SUMMARY`
- `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT`

**Why:** Explicit names preserve the business distinction between post-call, consult, transfer, initiator, and receiver flows.

### 7. Functional requirements

#### FR-1 — Feature enablement

The SDK must use the existing `wrapUpSummariesEnabled` and `consultTransferSummariesEnabled` configuration values to gate summary requests.

- `requestPostCallSummary()` must reject when `wrapUpSummariesEnabled` is false.
- `requestMidCallSummary()` must reject when `consultTransferSummariesEnabled` is false.
- A disabled request must not call the backend.
- Missing optional flags must behave as disabled.
- Repeated `FEATURE_ENABLEMENT` events must be forwarded; the SDK must not deduplicate them.

**Why:** Administrators require independent rollout and kill-switch control for post-call and mid-call capabilities.

#### FR-2 — Post-call request

When post-call summaries are enabled, `task.requestPostCallSummary()` must:

1. Request `GET_POST_CALL_SUMMARY` for the task's interaction and conversation.
2. Treat the HTTP acknowledgement as acceptance of the request, not as the summary result.
3. Wait for the corresponding inbound `POST_CALL_SUMMARY` event.
4. Resolve with `PostCallSummaryEventPayload` after the inbound payload is associated with the task.
5. Emit `task:postCallSummary` with the same payload.

**Why:** Summary generation is asynchronous, and consumers need both direct request/response ergonomics and event-driven delivery.

#### FR-3 — Post-call agent response

`task.sendPostCallSummaryResponse(payload)` must send the agent's final post-call response only after the consuming application has successfully completed the existing wrap-up operation.

The response must support:

- Interaction and conversation identifiers.
- The final structured summary, or an empty object when there are no edited sections.
- Numeric viewed, edited, and copied counters.
- Feedback of `none`, `thumbs_up`, or `thumbs_down`.
- The applicable state.
- The selected, non-null wrap-up code.
- Numeric action and publish timestamps.

**Why:** Wrap-up remains the primary business transaction. The summary response supplements it and must not be recorded as complete when wrap-up itself failed.

#### FR-4 — Mid-call request

When mid-call summaries are enabled, `task.requestMidCallSummary(actionType)` must:

1. Select `GET_MID_CALL_CONSULT_SUMMARY` for `CONSULT` or `GET_MID_CALL_TRANSFER_SUMMARY` for `TRANSFER`.
2. Request the summary for the task's interaction and conversation.
3. Wait for the corresponding inbound `MID_CALL_SUMMARY` event after the HTTP acknowledgement.
4. Resolve with `MidCallSummaryEventPayload`.
5. Emit `task:midCallSummary` with the same payload.

**Why:** Consult and transfer are distinct backend actions but should share one clear SDK method.

#### FR-5 — Mid-call agent response

`task.sendMidCallSummaryResponse(payload, actionType)` must select the response event name that corresponds to `CONSULT` or `TRANSFER`.

The response must support:

- Interaction and conversation identifiers.
- The final structured mid-call summary, or an empty object when no sections were edited.
- Numeric viewed, edited, and copied counters.
- Feedback of `none`, `thumbs_up`, or `thumbs_down`.
- A supported summary state.
- The initiating agent's display name.
- Numeric action and publish timestamps.

The response must omit `wrapUpCode`; it must not send the property as `null`.

**Why:** Mid-call handoff data belongs to the initiating agent and has no wrap-up disposition.

#### FR-6 — Mid-call sequencing

For a confirmed consult or transfer, the consuming application must send the mid-call summary response before calling the existing consult or transfer API.

**Why:** The summary must be available to the handoff workflow before the receiver takes over.

#### FR-7 — Cancel and exclude behavior

The mid-call response must support these states:

| State | Meaning | Required downstream behavior |
|---|---|---|
| `DEFAULT` | Agent proceeds with the summary included. | Send response, then consult or transfer. |
| `EXCLUDED` | Agent intentionally excludes summary content from the handoff. | Send response, then consult or transfer. |
| `IGNORED` | Agent proceeds without acting on the summary. | Send response, then consult or transfer. |
| `MID_CALL_CANCELLED` | Agent cancels the consult or transfer flow. | Send response and do not call consult or transfer. |
| `NOT_RECEIVED` | Summary was not available to the agent. | Send a response representing the unavailable result when the application continues. |

For `MID_CALL_CANCELLED` without edits:

- `summary` must be `{}`.
- `numberOfTimesViewed` must be `1` once the dialog has been opened.
- Edited and copied counters must remain `0` unless those actions occurred.
- `wrapUpCode` must be absent.

**Why:** Cancellation and exclusion are meaningful business outcomes and must remain distinguishable in backend telemetry.

#### FR-8 — Receiving-agent delivery

When `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` is received, the SDK must associate the payload with the receiving agent's task and emit `task:midCallSummaryForReceivingAgent` on that task.

The SDK must forward the usable summary payload without requiring the receiving application to make a request.

**Why:** The receiver path is push-driven; the receiving agent did not initiate summary generation.

#### FR-9 — Task correlation

Every task-scoped inbound summary must be delivered only to its matching task, using the available conversation or interaction identifier.

If no task can be found, the SDK must safely drop the event and record a metadata-only warning. It must not emit the summary on an unrelated task or throw an uncaught error.

**Why:** Cross-interaction summary leakage would be both functionally incorrect and privacy-sensitive.

#### FR-10 — Promise and event coexistence

Inbound post-call and mid-call summaries must always emit their public task event, including when a pending request Promise is waiting for that payload.

Resolving an awaiting Promise must not remove or shadow external listeners. Late events received after a request timeout must still reach external listeners.

**Why:** Multiple views or sessions may independently observe the same task event.

#### FR-11 — Timeout behavior

If an accepted request does not receive its corresponding inbound summary within 30 seconds:

- Post-call requests must reject with `POST_CALL_SUMMARY_TIMEOUT`.
- Mid-call requests must reject with `MID_CALL_SUMMARY_TIMEOUT`.
- Request-specific waiting state must be cleaned up.
- Public listeners must remain active for later events.

**Why:** Applications need a bounded wait without losing valid late events used by other consumers.

#### FR-12 — Repeated requests

The SDK must permit repeated summary requests for the same task. Each request must have its own completion outcome and must not suppress public events.

**Why:** An agent may reopen a dialog or retry a user journey, while backend deduplication remains outside SDK scope.

### 8. Data requirements

#### DR-1 — Common identifiers

Outbound summary requests and responses must include the agent, organization, interaction, and conversation identifiers required by the existing AI Assistant contract.

**Why:** The backend and SDK require stable correlation across HTTP acknowledgement and WebSocket delivery.

#### DR-2 — Summary representation

- Post-call responses must use a structured object representing post-call sections.
- Mid-call responses must use a structured object representing transfer/consult sections.
- An unchanged or intentionally empty response must use `{}`, not a string placeholder.
- Inbound Adaptive Card content and plain summary text must be forwarded without semantic rewriting.

**Why:** Structured sections support editing while the original card and text preserve backend presentation options.

#### DR-3 — Counters and timestamps

`numberOfTimesViewed`, `numberOfTimesEdited`, `numberOfTimesCopied`, `actionTimeStamp`, and `publishTimestamp` must be numbers on the wire, not numeric strings.

**Why:** The live backend contract uses numeric values even where older published types may disagree.

#### DR-4 — Feedback

Supported feedback values are exactly:

- `none`
- `thumbs_up`
- `thumbs_down`

**Why:** A bounded vocabulary provides consistent analytics and prevents arbitrary content from entering telemetry fields.

#### DR-5 — Inbound payload fidelity

The SDK must forward the inner summary payload to consumers without exposing transport-envelope fields or modifying summary content.

**Why:** Applications need a stable domain payload and should not depend on transport wrapping.

### 9. Error and resilience requirements

| Condition | Required consumer-visible outcome | Required SDK behavior |
|---|---|---|
| Post-call feature disabled | Reject with `POST_CALL_SUMMARY_DISABLED`. | Do not call the backend. |
| Mid-call feature disabled | Reject with `MID_CALL_SUMMARY_DISABLED`. | Do not call the backend. |
| AI Assistant base URL unavailable | Reject with `AI_ASSISTANT_BASE_URL_NOT_AVAILABLE`. | Do not attempt the request. |
| HTTP request fails | Reject the corresponding API Promise. | Record a failure metric; do not auto-retry. |
| Summary event times out | Reject with the applicable timeout error. | Clean up request-specific waiting state. |
| Unknown task | No event delivered. | Log metadata-only warning and drop. |
| Malformed inbound event | No event delivered. | Record a safe error and drop. |
| Late event after timeout | Timed-out Promise remains rejected. | Continue emitting to public listeners. |

Automatic retries are not required because summary operations are advisory and retries could duplicate backend telemetry.

### 10. Privacy, security, and observability

#### PR-1 — Sensitive content handling

The SDK must not log or place into metric tags:

- Summary text or structured section values.
- Adaptive Card bodies.
- The initiating agent's display name.

Only safe correlation metadata, event names, identifiers permitted by existing logging policy, counters, state, feedback, and card identifiers may be recorded.

**Why:** Summary content can contain customer information and must not leak into operational telemetry.

#### PR-2 — Metrics

The implementation must measure:

- Post-call request success and failure.
- Mid-call request success and failure.
- Post-call response success and failure.
- Mid-call response success and failure.
- Feature-enablement events received.

Metrics must distinguish operation type without including summary content.

**Why:** Operations teams need reliability signals and rollout visibility without inspecting customer data.

#### PR-3 — Failure isolation

Invalid, late, or uncorrelated summary events must not interrupt normal task handling, consult, transfer, or wrap-up behavior.

**Why:** AI summaries enhance the workflow but must not become a dependency that destabilizes core contact-center operations.

### 11. Compatibility and rollout requirements

- All new APIs, types, constants, events, and metrics must be additive.
- Existing event names and payloads must remain unchanged.
- Existing wrap-up, consult, transfer, and transcript behavior must remain unchanged.
- No schema migration or new SDK configuration key is required.
- `wrapUpSummariesEnabled` and `consultTransferSummariesEnabled` must act as independent kill switches.
- Disabling both flags must leave existing SDK workflows operational.

**Why:** Consumers must be able to adopt the new SDK version progressively and roll the feature back through configuration.

### 12. Requirement traceability

| Requirement area | Detailed reference |
|---|---|
| Public APIs, events, and types | `ai-summary.md` §§3–4 |
| Post-call behavior | `ai-summary.md` §5.1.A and `ai-summary-postcall-flow.md` |
| Mid-call initiator behavior | `ai-summary.md` §5.1.B and `ai-summary-initiator-flow.md` |
| Receiving-agent behavior | `ai-summary-receiver-flow.md` |
| Payload contracts | `ai-summary.md` §6 |
| Error and resilience behavior | `ai-summary.md` §7 |
| Privacy and metrics | `ai-summary.md` §8 |
| Testing and acceptance coverage | `ai-summary.md` §§9 and 18 |

## Acceptance Criteria
All Unit tests must pass
### AC-1 — Post-call happy path

Given post-call summaries are enabled, when a consumer requests a summary and the matching inbound event arrives, then:

- The Promise resolves with the summary payload.
- `task:postCallSummary` fires with the same payload.
- External listeners remain registered.
- After successful wrap-up, the consumer can send a response containing numeric counters, feedback, state, structured summary, and wrap-up code.

### AC-2 — Mid-call consult happy path

Given mid-call summaries are enabled, when `CONSULT` is requested, then the SDK uses the consult request event, returns and emits the inbound summary, and sends the consult response event before the application invokes consult.

### AC-3 — Mid-call transfer happy path

Given mid-call summaries are enabled, when `TRANSFER` is requested, then the SDK uses the transfer request event, returns and emits the inbound summary, and sends the transfer response event before the application invokes transfer.

### AC-4 — Cancel path

When an agent cancels after opening the summary experience, the application can send `MID_CALL_CANCELLED` with an empty summary and numeric counters, and it does not invoke consult or transfer.

### AC-5 — Receiving-agent path

When the backend pushes `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT`, only the correlated receiving task emits `task:midCallSummaryForReceivingAgent`.

### AC-6 — Feature-disabled paths

When the relevant feature flag is false or missing, the request rejects with the documented disabled error and no outbound summary request occurs.

### AC-7 — Timeout and late-event paths

When no matching event arrives within 30 seconds, the Promise rejects with the documented timeout. A later event still reaches public listeners and does not change the rejected Promise outcome.

### AC-8 — Multi-listener behavior

When multiple external listeners subscribe to a task event, all listeners receive each inbound summary even if a request Promise is also awaiting it.

### AC-9 — Unknown or malformed event

When an event cannot be correlated or parsed into a valid summary payload, no consumer event is emitted, no unrelated task is affected, and normal SDK operation continues.

### AC-10 — Privacy

Logs and metrics generated by every success and failure path contain no summary text, section values, Adaptive Card body, or agent display name.

### AC-11 — Backward compatibility

The existing SDK test suites for task lifecycle, wrap-up, consult, transfer, events, and transcripts continue to pass without consumer changes.


TODO: Confirm whether the receiving task shares the originating `conversationId`, and therefore which identifier is authoritative for subsequent-agent correlation.