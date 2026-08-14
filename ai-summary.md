# AI Summary SDK Contract

`design/default/design_spec.md` is the authoritative design for this feature.
This document synchronizes the repository-facing summary reference with that
design and the implemented SDK contract. The earlier requirement narrative
sections are non-normative context; implementation coverage is owned by the DAG
tasks and focused unit suites listed below.

No sample UI is part of this implementation change. Browser suites are
unaffected and are outside this SDK-only integration gate.

## Implemented Scope

- Additive public task APIs:
  - `task.requestPostCallSummary(): Promise<PostCallSummaryEventPayload>`
  - `task.sendPostCallSummaryResponse(payload): Promise<void>`
  - `task.requestMidCallSummary(actionType): Promise<MidCallSummaryEventPayload>`
  - `task.sendMidCallSummaryResponse(payload, actionType): Promise<void>`
- Public discovery and delivery events:
  - `cc:featureEnablement`
  - `task:midCallSummaryForReceivingAgent`
- Internal coordination for pending initiator requests, receiving-agent buffers,
  feature-enable snapshots, lifecycle cancellation, and bounded cleanup timers.
- Exact AI Assistant summary transport through `ApiAIAssistant` using
  field-by-field request construction and bounded HTTP posting.
- Privacy-safe metrics and diagnostics for request, response, feature, and
  inbound-drop outcomes.

The compatibility inbound wire names `POST_CALL_SUMMARY` and `MID_CALL_SUMMARY`
continue to come from `CC_TASK_EVENTS` and are used only as backend realtime
discriminants. They are deprecated as emitted task-event names and are proven
not emitted as public events.

## Requirement Ownership

The change named "Consumer sequencing and response semantics" is authoritative
only for G-1, G-2, FR-3, FR-6, and FR-7. FR-5, DR-2, DR-3, DR-4, PR-3, and
AC-1 through AC-4 are consumed from their matrix-routed components and
cross-cutting safeguards.

The corresponding DAG work is:

| DAG task | Responsibility |
| --- | --- |
| `define-ai-summary-contracts` | Public/internal constants, payload types, task API declarations, timeout aliases, root barrel exports, public declaration output, and the retained compatibility declarations. |
| `add-ai-summary-transport` | Exact summary GET/response serialization, bounded HTTP behavior, base-URL handling, sanitized transport failures, and adapter privacy. |
| `coordinate-summary-realtime-state` | Pending-request correlation, inbound settlement, receiver delivery, feature snapshots, bounded timers, inactive-session drops, and cleanup semantics. |
| `expose-task-summary-apis` | Public `Task` methods, gates, Promise composition, response validation, retained post-call response context, operation metrics, and unhandled-rejection protection. |
| `wire-contact-center-summary-lifecycle` | RTD feature gating, `cc:featureEnablement` forwarding, idempotent listener setup, register/reconnect/deregister cleanup, and post-clear frame handling. |
| `verify-summary-integration` | Complete contact-center unit, style, and source-build gate. |
| `synchronize-summary-documentation` | This documentation synchronization only. |

## Public Contracts

### Error Codes

`AI_SUMMARY_ERROR_CODES` is root-exported from `src/index.ts` and is stable for
`Error.message` and `error.data.errorCode` matching:

- `POST_CALL_SUMMARY_DISABLED`
- `MID_CALL_SUMMARY_DISABLED`
- `AI_SUMMARY_REQUEST_ALREADY_PENDING`
- `AI_ASSISTANT_BASE_URL_NOT_AVAILABLE`
- `POST_CALL_SUMMARY_TIMEOUT`
- `MID_CALL_SUMMARY_TIMEOUT`

Package-internal transport, coordinator, timeout, and client-type helpers are
not root exports.

### Event Names

`AIAssistantEventName` is the single source for outbound summary wire names:

- `GET_POST_CALL_SUMMARY`
- `GET_MID_CALL_CONSULT_SUMMARY`
- `GET_MID_CALL_TRANSFER_SUMMARY`
- `POST_CALL_SUMMARY_RESPONSE`
- `MID_CALL_CONSULT_SUMMARY_RESPONSE`
- `MID_CALL_TRANSFER_SUMMARY_RESPONSE`

The outbound compatibility names remain declared only for old consumers:

- `GET_MID_CALL_SUMMARY`
  - `@deprecated Use GET_MID_CALL_CONSULT_SUMMARY for CONSULT or GET_MID_CALL_TRANSFER_SUMMARY for TRANSFER.`
- `MID_CALL_SUMMARY_RESPONSE`
  - `@deprecated Use MID_CALL_CONSULT_SUMMARY_RESPONSE for CONSULT or MID_CALL_TRANSFER_SUMMARY_RESPONSE for TRANSFER.`

No production SDK path may reference either compatibility-only member, and new
documentation must point to the action-specific names instead of using the
compatibility members as implementation guidance.

`CC_TASK_EVENTS.POST_CALL_SUMMARY` and `CC_TASK_EVENTS.MID_CALL_SUMMARY` remain
the single literal sources for those two inbound wire names. `CC_AI_SUMMARY_EVENTS`
derives its matching members from `CC_TASK_EVENTS` and adds only
`FEATURE_ENABLEMENT` and `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` as new raw
discriminators. The public `CC_EVENTS` object spreads in normative order:
`CC_AGENT_EVENTS`, then `CC_TASK_EVENTS`, then `CC_AI_SUMMARY_EVENTS`.

Task/API method constants added for the feature are:

- `REQUEST_POST_CALL_SUMMARY`
- `SEND_POST_CALL_SUMMARY_RESPONSE`
- `REQUEST_MID_CALL_SUMMARY`
- `SEND_MID_CALL_SUMMARY_RESPONSE`
- `HANDLE_AI_SUMMARY_EVENT`
- `CLEAR_AI_SUMMARY_STATE`

### Feature Enablement

Applications discover summary eligibility through `cc:featureEnablement`. The
payload carries the top-level task `interactionId` plus independently optional
`postCallEnabled` and `midCallEnabled` booleans and optional numeric
`actionTimeStamp`. Absence stays `undefined`; the SDK does not coerce absent
flags to `false`.

Requests also require the organization profile flags:

- post-call: `generatedSummaries.wrapUpSummariesEnabled === true`
- mid-call: `generatedSummaries.consultTransferSummariesEnabled === true`

`ContactCenter` obtains these through:

`getAgentConfig() -> Profile.aiFeature -> TaskManager.setConfigFlags(...) -> Task.getGeneratedSummaryFlags()`

The RTD connect predicate uses optional chaining and strict `=== true` checks
for every generated-summary leaf. A request with missing, false, or stale
interaction-level enablement rejects locally with the corresponding disabled
code and performs no pending registration, timer, or HTTP request.

## Correlation

All Task outbound APIs derive correlation through `getAISummaryCorrelation`.
TaskManager registry scans and lifecycle work use `tryGetAISummaryCorrelation`
so an invalid registered task cannot throw out of a realtime callback.

The shared shape is:

```typescript
{
  conversationId: task.data.mainInteractionId ?? task.data.interactionId,
  interactionId: task.data.interactionId
}
```

If either identifier is empty, the throwing helper rejects Task outbound API
validation with `AI_SUMMARY_CORRELATION_NOT_AVAILABLE`, while the non-throwing
helper returns `undefined` and TaskManager skips that task with bounded
metadata-only diagnostics.

The feature map key is always the top-level `interactionId`. The conversation
key is never used as a feature fallback. When `mainInteractionId` differs, it
remains the request/receiver conversation key, and a feature frame keyed by that
conversation value does not enable the task.

## Request Coordination

Initiator summary requests are keyed by `(conversationId, inbound summary type)`
because the realtime result contains no backend request identifier. CONSULT,
TRANSFER, and same-conversation sibling tasks therefore share the single
conversation-scoped `MID_CALL_SUMMARY` pending slot.

`AISummaryCoordinator.registerPendingAISummaryRequest(...)` is async and atomic:
it rejects overlap with `AI_SUMMARY_REQUEST_ALREADY_PENDING` before constructing
a result Promise, storing an entry, arming a timer, or allowing HTTP to start.
An accepted handle contains:

- `requestToken`: fresh opaque registration identity for exact transport cleanup
- `result`: the long-lived inbound result Promise typed to the selected inbound
  payload

`taskId` is a lifecycle owner guard. `requestToken` identifies the exact accepted
registration for base-URL or HTTP cleanup. Neither value is key material.

After registration, Task starts the HTTP acknowledgement branch and immediately
composes that wrapped acknowledgement with `registration.result` through
`Promise.all(...)`. Acknowledgement rejection calls
`cancelPendingAISummaryRequest(taskId, conversationId, inboundType, requestToken)`,
which clears only the exact timer and map entry without resolving or rejecting
`registration.result`, then rethrows the identical adapter/base-URL error.
Missing entries, owner mismatches, and stale tokens are no-ops, so a late old
token cannot clear a newer same-key request.

Inbound timeout and owner/full-session cleanup are different: they reject every
live result Promise rather than silently dropping the resolver.
`AI_SUMMARY_REQUEST_CANCELLED` is reserved only for owner-task cleanup and
full-session register/reconnect/deregister cleanup.

## Public Task APIs

Each public Task summary invocation captures a method-local start timestamp
before validation and emits exactly one `MetricsManager.trackEvent` outcome with
its own non-negative `duration_ms`. AI-summary operations never call the
singleton `MetricsManager.timeEvent`; concurrent calls must not share timing
state. An overlap failure emits its own bounded failure before the accepted
first request's later final metric without restarting or consuming the first
duration.

`requestPostCallSummary` and `requestMidCallSummary` are non-async wrappers
around private async operations. Each wrapper attaches a side-effect-free catch
to the exact Promise returned to the application and returns that same Promise.
Awaiting consumers receive the original rejection and error identity, while an
application with no handler does not produce `unhandledRejection` for HTTP
failure, inbound timeout, owner cleanup, or SDK cleanup.

Request recovery guidance:

| Rejection | Backend work | Summary response recovery |
| --- | --- | --- |
| Disabled flag | No pending entry and no HTTP | Do not send a summary response. Continue wrap-up, consult, or transfer. |
| `AI_ASSISTANT_BASE_URL_NOT_AVAILABLE` | No HTTP | Do not send a summary response. Continue the business workflow. |
| HTTP transport failure | Pending entry is cleared by owner/token without settling `registration.result` | Response is optional; the application may continue the workflow. |
| `AI_SUMMARY_REQUEST_ALREADY_PENDING` | No second pending entry and no second HTTP | Response is optional; the first accepted request remains pending. |
| Inbound result timeout | Live resolver rejects with `POST_CALL_SUMMARY_TIMEOUT` or `MID_CALL_SUMMARY_TIMEOUT` | The application may send a `NOT_RECEIVED` response with the empty/zero unavailable branch. |

No request rejection may block wrap-up, consult, or transfer.

### Post-Call

`requestPostCallSummary()` requires both the organization post-call flag and the
latest per-interaction `postCallEnabled === true`. On success, Task captures a
private request-time `{conversationId, interactionId}` response context. That
context, the configured agent identity, and the adapter stay on the
application-held Task across wrap-up-driven TaskManager collection cleanup.

`sendPostCallSummaryResponse(...)` uses the retained context and adapter without
requiring a live registry entry, feature snapshot, coordinator entry, or gating
read. It falls back to current Task correlation only for a direct response
without a prior gated request. Full SDK deregistration ends the supported
operation window.

The response requires a non-empty `wrapUpCode`. Post-call never sends
`agentName`.

### Mid-Call

`requestMidCallSummary('CONSULT')` sends `GET_MID_CALL_CONSULT_SUMMARY`;
`requestMidCallSummary('TRANSFER')` sends `GET_MID_CALL_TRANSFER_SUMMARY`.
Both require the organization mid-call flag and latest per-interaction
`midCallEnabled === true`.

`sendMidCallSummaryResponse(payload, 'CONSULT')` sends
`MID_CALL_CONSULT_SUMMARY_RESPONSE`; the TRANSFER action sends
`MID_CALL_TRANSFER_SUMMARY_RESPONSE`. Mid-call responses require non-empty
`agentName`, omit `wrapUpCode`, and require the validation-only
`summaryReceived: true | false` discriminator. That discriminator is not sent to
transport.

Consumer sequencing for CONSULT and TRANSFER is documentation-only evidence:
applications should attempt and await `sendMidCallSummaryResponse(...)` before
independently invoking consult or transfer, catch and record a response failure,
and still continue the handoff. The SDK automated tests prove exact
CONSULT/TRANSFER request and response wire-name selection plus bounded response
settlement; they do not claim cross-call ordering between the response method
and the existing handoff APIs. The local `MID_CALL_CANCELLED` consumer case
proves the no-handoff branch. The single copyable consumer example for this
ordering rule lives in
[`ai-summary-initiator-flow.md`](./ai-summary-initiator-flow.md#consumer-recovery-example)
to keep the executable guidance in one place.

The bounded adapter settles a never-resolving response HTTP Promise within the
existing 20-second request policy, so the advisory response attempt cannot block
the handoff indefinitely.

## Response Payload Rules

All response branches allow optional independent finite, non-negative
`actionTimeStamp` and `publishTimestamp`. The adapter preserves supplied values
unchanged. For omitted fields it captures one `Date.now()` value per call and
uses that fallback only for omissions.

The SDK scopes literal unavailable sentinels to `summary` and
`numberOfTimesViewed`, `numberOfTimesEdited`, and `numberOfTimesCopied` only.
It never substitutes empty strings for `conversationId` or `interactionId`.
Task supplies non-empty identifiers from the requesting task on every request
and response, including `NOT_RECEIVED` and `summaryReceived: false`.

Counter rules:

- `numberOfTimesViewed` is zero only before display.
- `numberOfTimesViewed` is exactly one on first dialog open.
- `numberOfTimesEdited` and `numberOfTimesCopied` remain zero unless those
  actions occurred.
- The no-summary branch uses `summary: ''` with all three counters set to zero.

Transport builds whitelist objects field by field:

- no caller-object spread reaches the wire
- flow-invalid fields are absent as own keys, not present with `undefined`
- post-call has `wrapUpCode` and no `agentName`
- mid-call has `agentName` and no `wrapUpCode`
- mid-call omits `summaryReceived`

## Transport

`ApiAIAssistant` is exported as the live class symbol from
`src/services/ApiAiAssistant.ts`. It adds:

- `sendSummaryGetEvent(...)`
- `sendSummaryResponseEvent(...)`

Both methods call one private `buildSummaryEventEnvelope(...)` constructor and
one private bounded-post helper. The envelope helper is the only code that
constructs the shared `agentId`, `orgId`, `eventType`, `eventName`,
`publishTimestamp`, `eventDetails.data`, identifiers, client type, and
`actionTimeStamp` fields. The client type is supplied only by package-internal
`AI_ASSISTANT_CLIENT_TYPE`.

Validation rejects as Promises before base-URL lookup, body construction, timers,
or `webex.request`. Missing identifiers, unknown event names for the method's
three-member union, and invalid response timestamps use the internal transport
validation code.

Missing base URL rejects with root-exported
`AI_ASSISTANT_BASE_URL_NOT_AVAILABLE` in both `Error.message` and
`error.data.errorCode`.

The bounded-post helper makes one `webex.request` attempt with
`AI_SUMMARY_HTTP_TIMEOUT_MS` and races it with one same-duration guard. It clears
the guard in `finally`, never retries, normalizes guard or ETIMEDOUT outcomes to
the transport timeout code, and discards original HTTP rejection details before
diagnostics. Sanitized HTTP failure projections include only bounded method,
event, safe identifiers, and optional finite top-level status code.

## Realtime Coordination

`TaskManager` owns raw double-envelope parsing, task registry scans, config flag
view, and metric emission. It composes one `AISummaryCoordinator` for its
lifetime and injects the narrow coordinator contract plus
`getGeneratedSummaryFlags` into every Task immediately after
`TaskFactory.createTask(...)` and before listener setup or registry insertion.

`AISummaryCoordinator` owns:

- event-type-indexed pending request maps
- receiving-agent summary buffer
- per-interaction feature-enable snapshots
- request, receiver-buffer, and orphan-feature timers

All three semantic timeout constants are package-internal source-module exports
backed by one value:

- `AI_SUMMARY_DURATION_MS = 30_000`
- `AI_SUMMARY_REQUEST_TIMEOUT_MS = AI_SUMMARY_DURATION_MS`
- `AI_SUMMARY_RECEIVER_BUFFER_RETENTION_MS = AI_SUMMARY_DURATION_MS`
- `AI_SUMMARY_FEATURE_ORPHAN_RETENTION_MS = AI_SUMMARY_DURATION_MS`

The common timed-entry cleanup path clears timers, settles while keyed when a
settlement callback is required, and deletes before Promise reactions.

Feature snapshots are stored under the event's canonical top-level
`interactionId`. If no registered task matches, the snapshot is orphan-retained
for `AI_SUMMARY_FEATURE_ORPHAN_RETENTION_MS`; registration promotion clears the
orphan timer. Final task eviction clears active feature state only when no valid
registered task still has the same canonical interaction key. Full cleanup
clears all forms.

Each valid `FEATURE_ENABLEMENT` frame is counted and forwarded, including
identical repeats. A valid metric records exact boolean tags when present and
the bounded string `'absent'` when a flag is missing. A classified but invalid
feature payload records one bounded invalid outcome and is not stored or
forwarded. Unparseable or unclassifiable frames are not counted as feature
metrics.

## Receiving-Agent Delivery

`MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` is inbound-only and emits
`task:midCallSummaryForReceivingAgent` on a selected receiving Task.

TaskManager collects every valid registered task whose derived `conversationId`
matches the payload. Selection rules:

- zero matches: buffer or replace the latest payload for that conversation and
  arm `AI_SUMMARY_RECEIVER_BUFFER_RETENTION_MS`
- one original match: deliver
- multiple matches: build the set of local
  `interaction.callProcessingDetails.parentInteractionId` values, exclude
  candidates whose `interactionId` is referenced as an ancestor, and deliver
  only if exactly one leaf remains
- zero or multiple leaves: clear any old buffer, emit no task event, and record
  one `AI_SUMMARY_INBOUND_EVENT_DROPPED` metric with `ambiguous-receiver`

The same selector runs on buffer flush after task insertion, update, and removal.
One candidate delivers, zero retains the existing deadline, and ambiguity clears
and drops. Buffer expiry is separate and records one `receiver-buffer-expired`
drop. Individual removal never blindly deletes receiver state.

Receiver drop metrics and diagnostics use only bounded event/reason metadata and
safe IDs. They never include summary text, section keys or values, Adaptive Card
bodies, agent names, raw payloads, or arbitrary exception text.

## Lifecycle

At the start of every `ContactCenter.register()` attempt, before connection
re-establishment, and in unconditional `ContactCenter.deregister()` cleanup,
TaskManager clears AI-summary state. The clear first marks inbound summary
handling inactive, then rejects live post-call and mid-call request results with
`AI_SUMMARY_REQUEST_CANCELLED`, deletes pending keys before reactions, and
clears receiver buffers, feature snapshots, and timers.

A classified summary frame that arrives while inactive is dropped exactly once
with bounded `sdk-deregistered` metadata. It cannot resolve, buffer, mutate,
emit, or create a timer. The next profile refresh through `setConfigFlags(...)`
reactivates handling.

Because Task attaches both request branches before HTTP can settle, in-flight
HTTP fulfillment or rejection after cleanup is consumed without changing the
single cancellation outcome, settling removed resolvers, recreating state,
emitting a second final metric, or producing an unhandled rejection.

`incomingTaskListener()` removes the named feature handler before adding it, so
repeated setup stays single-subscribed while every distinct inbound feature
frame, including repeated identical payloads, is forwarded once.

## Metrics And Privacy

Public Task summary operations emit exactly one final `trackEvent`:

| Operation | Success | Failure |
| --- | --- | --- |
| post-call request | `AI_SUMMARY_GET_POST_CALL_SUCCESS` after HTTP acknowledgement and matching RTD result both fulfill | `AI_SUMMARY_GET_POST_CALL_FAILED` |
| mid-call request | `AI_SUMMARY_GET_MID_CALL_SUCCESS` after HTTP acknowledgement and matching RTD result both fulfill | `AI_SUMMARY_GET_MID_CALL_FAILED` |
| post-call response | `AI_SUMMARY_POST_CALL_RESPONSE_SUCCESS` after bounded HTTP acknowledgement | `AI_SUMMARY_POST_CALL_RESPONSE_FAILED` |
| mid-call response | `AI_SUMMARY_MID_CALL_RESPONSE_SUCCESS` after bounded HTTP acknowledgement | `AI_SUMMARY_MID_CALL_RESPONSE_FAILED` |

Response failures include local validation/configuration/correlation/base-URL
codes and the three package-internal transport codes. Failure metrics include
only bounded `failureCode`.

TaskManager owns normal receive-path and drop metrics:

- `AI_SUMMARY_FEATURE_ENABLEMENT_RECEIVED`
- `AI_SUMMARY_INBOUND_EVENT_DROPPED`

The inbound-drop metric is emitted once for unparseable, malformed-envelope,
unknown-event, invalid-payload, late-or-uncorrelated, sdk-deregistered,
ambiguous-receiver, and receiver-buffer-expired paths. TaskManager and the
coordinator do not emit duplicate Task-owned request-timeout operation metrics.

Never log or tag summary text, human-authored section keys or values, Adaptive
Card bodies, agent names, raw envelopes/payloads, original HTTP error messages,
stacks, request options, response bodies, details, or causes. Safe diagnostics
are bounded operation/event names, safe identifiers, counters, state, feedback,
action type, validation outcomes, and bounded error codes.

## Public And Internal Export Boundary

Root exports include the public payloads, task APIs, `CC_AI_SUMMARY_EVENTS`,
`AIAssistantEventName`, and `AI_SUMMARY_ERROR_CODES`.

The following remain package-internal and are intentionally omitted from the
root barrel:

- `AISummaryInboundType`
- `AISummaryPayloadByInboundType`
- `AISummaryTimeoutCodeByInboundType`
- `AISummaryPendingRegistration`
- `AISummaryRequestCoordinator`
- `GeneratedSummaryFlagsAccessor`
- `AISummaryResponseTransportPayload`
- `SummaryResponseTimestamps`
- `AI_ASSISTANT_CLIENT_TYPE`
- `AI_SUMMARY_DURATION_MS`
- `AI_SUMMARY_REQUEST_TIMEOUT_MS`
- `AI_SUMMARY_RECEIVER_BUFFER_RETENTION_MS`
- `AI_SUMMARY_FEATURE_ORPHAN_RETENTION_MS`
- `AI_SUMMARY_REQUEST_CANCELLED`
- `AI_SUMMARY_HTTP_TIMEOUT_MS`
- `AI_SUMMARY_TRANSPORT_ERROR_CODES`

The SDK-produced `ITask` interface and `dist/types/index.d.ts` expose the four
summary methods and public response timestamp fields for consumers.

## Verification Evidence

- `test/unit/spec/index.ts`: frozen additive root-barrel contract, public type
  fixtures, internal omission checks, exact compatibility deprecation text, and
  production-reference prohibition for the two outbound legacy members.
- `test/unit/spec/services/config/index.ts`: shared wire-name identities, new
  discriminator literals, and normative `CC_EVENTS` spread order.
- `test/unit/spec/services/ApiAiAssistant.ts`: exact request bodies for all six
  event names, timestamp behavior, bounded HTTP, one attempt, and sanitized
  errors.
- `test/unit/spec/services/task/AISummaryCoordinator.ts`: typed pending
  registrations, timer boundaries, cleanup ordering, feature snapshots, receiver
  buffering, lineage delivery, ambiguity, and privacy.
- `test/unit/spec/services/task/TaskManager.ts`: parser validation, delegation,
  local-lineage selection, feature metrics, drop metrics, inactive cleanup, and
  initiator-alias non-emission.
- `test/unit/spec/services/task/Task.ts`: all four public APIs, gates,
  validation, Promise composition, response context retention, metrics,
  unhandled-rejection cases, action-event selection, and payload privacy.
- `test/unit/spec/cc.ts`: profile/config propagation, RTD lifecycle cleanup,
  feature forwarding, listener idempotence, cancellation, and late-frame/late-HTTP
  isolation.

The complete integration gate is:

```bash
yarn workspace @webex/contact-center test:unit
yarn workspace @webex/contact-center test:style
yarn workspace @webex/contact-center build:src
```
