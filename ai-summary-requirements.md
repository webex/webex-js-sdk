# AI Post-Call and Mid-Call Summary — Requirements

## 1. Background and problem statement

Contact-center agents need concise context at two important moments:

1. After a customer interaction, when the agent reviews the outcome and completes wrap-up.
2. During a consult or transfer, when another agent needs enough context to continue the interaction without making the customer repeat information.

The AI Assistant backend can generate these summaries, but consuming applications need a stable SDK contract for requesting them, receiving asynchronous results, presenting editable content, and returning agent feedback and usage signals.

Without this SDK capability, each application would need to understand backend transport details, correlate events to tasks, and independently implement timeout, feature-gating, and response behavior. The requirement is therefore to expose a task-oriented, additive SDK API while leaving user-interface decisions to consuming applications.

### 2. Goals

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

Return post-call and initiating-agent summaries through request Promises, while reserving a public task event for the push-only receiving-agent flow.

**Why:** Each workflow needs one unambiguous consumer-facing completion channel: a Promise when the consumer initiated the request, and an event when it did not.

#### G-5 — Safe, additive adoption

Add the capability without changing existing wrap-up, consult, transfer, transcript, or event behavior.

**Why:** Existing consumers must be able to upgrade the SDK without migration or regression risk.

### 3. Users and stakeholders

| Actor | Need |
|---|---|
| Contact-center agent | Review, edit, copy, rate, accept, exclude, or cancel an AI summary. |
| Receiving agent | Receive useful context from the initiating agent during a consult or transfer. |
| Widget/application developer | Use a small task-level SDK surface without implementing backend transport or event correlation. |
| Contact-center administrator | Control availability through existing feature configuration. |
| Operations team | Measure requests, responses, failures, and feature enablement without exposing summary content. |
| AI Assistant backend | Receive correctly named request/response events and required interaction metadata. |

### 4. Scope

#### 4.1 In scope

- Task-level APIs for requesting post-call and mid-call summaries.
- Task-level APIs for sending the agent's response to those summaries.
- Promise-based delivery for post-call and initiating-agent summaries, plus a public task event for receiving-agent summaries.
- An agent-level feature-enablement event.
- Feature gating through existing generated-summary flags.
- Correlation of inbound summary events to the appropriate task.
- Timeout, disabled-feature, HTTP-failure, malformed-event, and unknown-task behavior.
- Agent interaction signals: viewed, edited, copied, feedback, disposition state, wrap-up code, and agent name where applicable.
- Metrics and privacy-safe logging.
- Additive public types and constants required for SDK consumers.

#### 4.2 Out of scope

- Building a production widget or prescribing its visual design.
- Changing existing `wrapup`, `consult`, or `transfer` APIs.
- Changing backend endpoints or backend business logic.
- Generating summaries inside the SDK.
- Rendering or interpreting Adaptive Card layouts inside the SDK.
- Real-time transcript functionality.
- Automatic retries or backend deduplication.

### 5. Public SDK contract

#### 5.1 APIs to implement

| API | Purpose | Result |
|---|---|---|
| `task.requestPostCallSummary()` | Request the post-call summary for the current task. | Returns `Promise<PostCallSummaryEventPayload>`. |
| `task.sendPostCallSummaryResponse(payload)` | Send the agent's final post-call summary response and interaction signals. | Returns `Promise<void>`. |
| `task.requestMidCallSummary(actionType)` | Request a consult or transfer summary for the current task. | Returns `Promise<MidCallSummaryEventPayload>`. |
| `task.sendMidCallSummaryResponse(payload, actionType)` | Send the initiating agent's response for a consult or transfer summary. | Returns `Promise<void>`. |

`actionType` must accept exactly `CONSULT` or `TRANSFER`.

No new public method is required on the contact-center root object. Feature enablement is event-driven.

#### 5.2 Public events to implement

| External event | Owner | Consumer purpose |
|---|---|---|
| `cc:featureEnablement` | Contact-center client | Learn whether mid-call and post-call summaries are enabled for an interaction. |
| `task:midCallSummaryForReceivingAgent` | Task | Receive the handoff summary on the receiving agent's task. |

Post-call and initiating-agent mid-call results are returned only through their request Promises. They are not duplicated as public task events. The receiver event remains public because the receiving agent did not initiate a request Promise.

#### 5.3 Backend event names required

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

### 6. Functional requirements

#### FR-1 — Feature enablement

The SDK must combine the existing organization configuration with the latest per-interaction `FEATURE_ENABLEMENT` event to gate summary requests.

- `requestPostCallSummary()` is enabled only when `wrapUpSummariesEnabled` and the interaction's `postCallEnabled` value are both `true`.
- `requestMidCallSummary()` is enabled only when `consultTransferSummariesEnabled` and the interaction's `midCallEnabled` value are both `true`.
- A disabled request must not call the backend.
- Missing organization flags, a missing per-interaction event, or missing per-interaction values must behave as disabled.
- Repeated `FEATURE_ENABLEMENT` events must be forwarded; the SDK must not deduplicate them.

**Why:** Administrators require independent rollout and kill-switch control for post-call and mid-call capabilities.

#### FR-2 — Post-call request

When post-call summaries are enabled, `task.requestPostCallSummary()` must:

1. Request `GET_POST_CALL_SUMMARY` for the task's interaction and conversation.
2. Treat the HTTP acknowledgement as acceptance of the request, not as the summary result.
3. Wait for the corresponding inbound `POST_CALL_SUMMARY` event.
4. Resolve with `PostCallSummaryEventPayload` after the inbound payload is associated with the task.

**Why:** Summary generation is asynchronous, while a Promise gives the requesting consumer one completion channel and avoids duplicate public delivery.

#### FR-3 — Post-call agent response

`task.sendPostCallSummaryResponse(payload)` must send the agent's final post-call response only after the consuming application has successfully completed the existing wrap-up operation.

The response must support:

- Interaction and conversation identifiers.
- The final summary as structured sections when sections are available, or as plain text when the received summary has no structured sections.
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

**Why:** Consult and transfer are distinct backend actions but should share one clear SDK method.

#### FR-5 — Mid-call agent response

`task.sendMidCallSummaryResponse(payload, actionType)` must select the response event name that corresponds to `CONSULT` or `TRANSFER`.

The response must support:

- Interaction and conversation identifiers.
- The final mid-call summary as structured sections when sections are available, or as plain text when the received summary has no structured sections.
- Numeric viewed, edited, and copied counters.
- Feedback of `none`, `thumbs_up`, or `thumbs_down`.
- A supported summary state.
- The initiating agent's display name.
- Numeric action and publish timestamps.

The response must omit `wrapUpCode`; it must not send the property as `null`.

**Why:** Mid-call handoff data belongs to the initiating agent and has no wrap-up disposition.

#### FR-6 — Mid-call sequencing

For a confirmed consult or transfer, the consuming application must attempt and await the mid-call summary response before calling the existing consult or transfer API. If the summary response fails, the application must record the failure and continue with the consult or transfer rather than blocking the core handoff.

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

For `MID_CALL_CANCELLED`:

- If a summary was received, `summary` must preserve its structured-object or plain-text representation and `numberOfTimesViewed` must be `1` once the dialog has been opened.
- If no summary was received, `summary` must be an empty string and viewed, edited, and copied counters must be `0`.
- Edited and copied counters must remain `0` unless those actions occurred.
- `wrapUpCode` must be absent.

**Why:** Cancellation and exclusion are meaningful business outcomes and must remain distinguishable in backend telemetry.

#### FR-8 — Receiving-agent delivery

When `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` is received, the SDK must associate the payload with the receiving agent's task and emit `task:midCallSummaryForReceivingAgent` on that task.

The receiving task must carry the same `conversationId` as the originating task. For this subsequent-agent event, `conversationId` is the authoritative correlation identifier; the SDK must not depend on an `interactionId` fallback because the inbound payload does not provide one for this purpose.

If the receiving task is not registered when the event arrives, the SDK must buffer at most the latest payload for that `conversationId` for up to 30 seconds. It must deliver the payload when the matching task becomes available and clear it after delivery, timeout, task cleanup, or SDK deregistration.

The SDK must forward the usable summary payload without requiring the receiving application to make a request.

**Why:** The receiver path is push-driven; the receiving agent did not initiate summary generation.

#### FR-9 — Task correlation

Every inbound summary must be correlated by its `conversationId` and expected summary event type. Post-call and initiating-agent mid-call events settle only the matching pending request. `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` must be correlated exclusively to the receiving task whose `conversationId` matches both the payload and the originating task.

If no task can be found for a subsequent-agent event, the SDK must apply the bounded buffering rule in FR-8. Other uncorrelated events, and subsequent-agent events whose buffer expires, must be dropped with a metadata-only warning. The SDK must not emit a summary on an unrelated task or throw an uncaught error.

**Why:** Cross-interaction summary leakage would be both functionally incorrect and privacy-sensitive.

#### FR-10 — Promise-only request completion

Inbound `POST_CALL_SUMMARY` and initiating-agent `MID_CALL_SUMMARY` payloads must settle only their matching pending request Promise. They must not be emitted as public task events.

The pending resolver is an internal SDK concern. The public receiver event `task:midCallSummaryForReceivingAgent` remains independent of request-Promise completion.

**Why:** A single consumer-facing completion channel prevents duplicate handling while retaining push delivery for the receiver-only workflow.

#### FR-11 — Timeout behavior

If an accepted request does not receive its corresponding inbound summary within 30 seconds:

- Post-call requests must reject with `POST_CALL_SUMMARY_TIMEOUT`.
- Mid-call requests must reject with `MID_CALL_SUMMARY_TIMEOUT`.
- Request-specific waiting state must be cleaned up.
- A later response must be ignored safely and must not settle the expired Promise.

**Why:** Applications need a bounded and deterministic request outcome.

#### FR-12 — Repeated requests

The SDK must permit a new summary request for the same task after the prior request has resolved, rejected, or timed out. While a request of the same summary type is pending for that task, an overlapping request must reject with `AI_SUMMARY_REQUEST_ALREADY_PENDING` and must not call the backend.

**Why:** Sequential retry supports the user journey, while rejecting overlap avoids resolving multiple Promises from an inbound event that has no unique request identifier.

### 1. Data requirements

#### DR-1 — Common identifiers

Outbound summary requests and responses must include the agent, organization, interaction, and conversation identifiers required by the existing AI Assistant contract. `conversationId` and `interactionId` must be populated; the no-summary/`NOT_RECEIVED` path must not replace `conversationId` with an empty string.

For originating-agent requests and responses, the SDK must derive both required contract fields consistently from the requesting task's correlation data; neither field may be omitted. This does not change the receiver rule in FR-8: a subsequent-agent event is correlated using its shared `conversationId` only.

**Why:** The backend and SDK require stable correlation across HTTP acknowledgement and WebSocket delivery.

#### DR-2 — Summary representation

- Post-call and mid-call responses must use a structured object when the received summary contains sections.
- When the received summary has no sections, the response must preserve the plain-text summary representation.
- When no summary was received, the response must use an empty string and zero interaction counters.
- Inbound Adaptive Card content and plain summary text must be forwarded without semantic rewriting.

**Why:** Structured sections support editing while the original card and text preserve backend presentation options.

#### DR-3 — Counters and timestamps

`numberOfTimesViewed`, `numberOfTimesEdited`, `numberOfTimesCopied`, `actionTimeStamp`, and `publishTimestamp` must be numbers on the wire, not numeric strings.

The consuming application owns the viewed, edited, and copied observations. The SDK must forward the supplied numeric counter values without hardcoding a viewed count or reducing the edited count to a boolean-derived `0` or `1`. The no-summary path is the exception defined by DR-2 and must send all three counters as `0`.

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

### 1. Error and resilience requirements

| Condition | Required consumer-visible outcome | Required SDK behavior |
|---|---|---|
| Post-call feature disabled | Reject with `POST_CALL_SUMMARY_DISABLED`. | Do not call the backend. |
| Mid-call feature disabled | Reject with `MID_CALL_SUMMARY_DISABLED`. | Do not call the backend. |
| AI Assistant base URL unavailable | Reject with `AI_ASSISTANT_BASE_URL_NOT_AVAILABLE`. | Do not attempt the request. |
| HTTP request fails | Reject the corresponding API Promise. | Record a failure metric; do not auto-retry. |
| Summary event times out | Reject with the applicable timeout error. | Clean up request-specific waiting state. |
| Same-type request already pending for the task | Reject with `AI_SUMMARY_REQUEST_ALREADY_PENDING`. | Do not call the backend or replace the existing pending resolver. |
| Unknown task | No event delivered. | Log metadata-only warning and drop. |
| Malformed inbound event | No event delivered. | Record a safe error and drop. |
| Late event after timeout | Timed-out Promise remains rejected. | Ignore safely and record metadata-only diagnostics. |

Automatic retries are not required because summary operations are advisory and retries could duplicate backend telemetry.

### 1. Privacy, security, and observability

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

### 1. Compatibility and rollout requirements

- All new APIs, types, constants, events, and metrics must be additive.
- Existing event names and payloads must remain unchanged.
- Existing wrap-up, consult, transfer, and transcript behavior must remain unchanged.
- No schema migration or new SDK configuration key is required.
- `wrapUpSummariesEnabled` and `consultTransferSummariesEnabled` must act as independent kill switches.
- Disabling both flags must leave existing SDK workflows operational.

**Why:** Consumers must be able to adopt the new SDK version progressively and roll the feature back through configuration.

### 1. Acceptance criteria

#### AC-1 — Post-call happy path

Given post-call summaries are enabled, when a consumer requests a summary and the matching inbound event arrives, then:

- The Promise resolves with the summary payload.
- No public post-call task event is emitted for the initiating request.
- After successful wrap-up, the consumer can send a response containing numeric counters, feedback, state, the preserved structured or plain-text summary, and wrap-up code.

#### AC-2 — Mid-call consult happy path

Given mid-call summaries are enabled, when `CONSULT` is requested, then the SDK uses the consult request event, resolves the request Promise with the inbound summary without a public initiator event, and attempts the consult response before the application invokes consult.

#### AC-3 — Mid-call transfer happy path

Given mid-call summaries are enabled, when `TRANSFER` is requested, then the SDK uses the transfer request event, resolves the request Promise with the inbound summary without a public initiator event, and attempts the transfer response before the application invokes transfer.

#### AC-4 — Cancel path

When an agent cancels after opening the summary experience, the application can send `MID_CALL_CANCELLED` with the received summary representation and numeric counters, and it does not invoke consult or transfer. If no summary was received, it sends an empty string with zero counters.

#### AC-5 — Receiving-agent path

When the backend pushes `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT`, the SDK uses its `conversationId` as the sole authoritative identifier. It emits `task:midCallSummaryForReceivingAgent` only on the matching task, buffering the latest payload for up to 30 seconds if that task is not registered yet.

#### AC-6 — Feature-disabled paths

When the relevant feature flag is false or missing, the request rejects with the documented disabled error and no outbound summary request occurs.

#### AC-7 — Timeout and late-event paths

When no matching event arrives within 30 seconds, the Promise rejects with the documented timeout. A later event is ignored and does not change the rejected Promise outcome.

#### AC-8 — Overlapping request behavior

When a second request of the same summary type is made for a task whose first request is still pending, the second request rejects with `AI_SUMMARY_REQUEST_ALREADY_PENDING`, the backend is not called again, and the first request remains pending.

#### AC-9 — Unknown or malformed event

When an event cannot be correlated or parsed into a valid summary payload, no request Promise is settled, no receiver event is emitted, no unrelated task is affected, and normal SDK operation continues.

#### AC-10 — Privacy

Logs and metrics generated by every success and failure path contain no summary text, section values, Adaptive Card body, or agent display name.

#### AC-11 — Backward compatibility

The existing SDK test suites for task lifecycle, wrap-up, consult, transfer, events, and transcripts continue to pass without consumer changes.


### 1. Requirement traceability

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
