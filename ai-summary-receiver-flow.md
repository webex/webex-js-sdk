# AI Mid-Call Summary — Receiver-Side Flow Architecture

> Companion to [`ai-summary.md`](./ai-summary.md) (authoritative spec), [`ai-summary-initiator-flow.md`](./ai-summary-initiator-flow.md)
> (mid-call initiator), and
> [`ai-summary-postcall-flow.md`](./ai-summary-postcall-flow.md). This
> file is a focused architecture view of what happens on the **receiving
> agent's** side when an originator agent has consulted/transferred a call
> WITH a mid-call summary attached. Semantics are derived from
> `ai-summary.md` §3.2 (`MidCallSummaryReceivingAgentPayload`), §6.2 inbound
> `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT`, §15.3, §15.5, §17.2 (sample
> listener for `task:midCallSummaryForReceivingAgent`).

## 1. Component map (receiver side)

```mermaid
flowchart LR
  subgraph Browser["Receiving agent browser (sample app / widget)"]
    UI["Consumer-defined UI<br/>inbound summary panel<br/>adaptive card / fallback text"]
    App["app.js<br/>wireSummaryListeners(task)<br/>task.on(midCallSummaryForReceivingAgent)"]
    subgraph SDK["@webex/contact-center SDK"]
      Task["Task (services/task/Task.ts)<br/>receiver is event-driven<br/>no SDK method call"]
      TM["TaskManager<br/>handleAISummaryEvent<br/>MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT<br/>findTaskByCorrelation"]
      CC["cc.ts<br/>handleWebsocketMessage<br/>switch on eventData.type<br/>double-unwrap data.data"]
    end
    App -->|render| UI
    CC -->|routes| TM
    TM -->|task.emit| Task
    Task -->|public task event| App
  end
  Backend["Backend: api-ai-assistant<br/>push-only receiver path"]
  WS["Realtime subscription WSS<br/>double envelope: type, data.data"]
  Backend -->|realtime push| WS
  WS -->|WS frame| CC
```

## 2. Happy path — receiver accepts inbound consult/transfer with summary

```mermaid
sequenceDiagram
  participant Initiator
  participant Backend
  actor Receiver
  participant CC as cc.ts
  participant TM as TaskManager
  participant Task
  participant Widget

  Initiator->>Backend: MID_CALL_CONSULT/TRANSFER_SUMMARY_RESPONSE<br/>state DEFAULT; edited summary
  Backend->>Receiver: Existing consult/transfer workflow routes call
  Receiver->>Task: Accept task
  Note over Task: Task appears in taskCollection by<br/>interactionId / conversationId
  Backend->>CC: WS MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT
  Note over CC: switch on eventData.type<br/>double-unwrap eventData.data.data
  CC->>TM: handleAISummaryEvent(type, payload)
  Note over TM: findTaskByCorrelation<br/>(conversationId, interactionId)
  TM->>Task: emit TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT(payload)
  Task->>Widget: task:midCallSummaryForReceivingAgent
  Note over Widget: Log delivery metadata and render<br/>payload.adaptiveCard verbatim
```

## 3. WS payload (inbound only — no outbound counterpart)

`MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` arrives on the realtime channel
in the same double envelope as the other summary events. Inner payload
shape (spec §3.2 `MidCallSummaryReceivingAgentPayload`, §6.2):

```json
{
  "type": "MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT",
  "trackingId": "notifs-data_<uuid>",
  "orgId": "<uuid>",
  "data": {
    "agentId": "<uuid>", "orgId": "<uuid>",
    "notifType": "MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT",
    "notifDetails": { "actionEvent": "MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT" },
    "data": {
      "conversationId": "<originator's conversationId>",
      "adaptiveCard": { "type": "AdaptiveCard", "version": "1.6", "body": [ ] },
      "adaptiveCardId": "<uuid>",
      "languageCode": "en",
      "resolution": "RESOLVED",
      "summaryText": "View to get more context on the conversation.",
      "sections": {
        "reasonForTransferOrConsult": "…",
        "additionalContext": "…",
        "keyActionsTaken": "…"
      },
      "timestamp": 1779840300000
    }
  }
}
```

Field notes:

- **`adaptiveCard`** — full ready-to-render Adaptive Card v1.6 reflecting
  the originator's edited summary. Widget renders verbatim.
- **`summaryText`** — short fallback line (~45 chars, e.g. *"View to get
  more context on the conversation."*) — NOT the full body. NEVER log.
- **`sections`** — structured backup of the card body (mid-call keys
  `reasonForTransferOrConsult`, `additionalContext`, `keyActionsTaken`).
  Spec adds this on top of agent-desktop sdk-types (sdk-types are stale on
  this field). NEVER log values.
- **No `editAdaptiveCard*`** — receiver cannot edit.
- **No `areTranscriptsAvailable` / `suggestedWrapUpCodes`** — these are
  initiator/post-call fields.

`MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` has **NO outbound counterpart**:
- No `*_RESPONSE` is sent.
- No counters, feedback, or state are tracked.
- The receiving agent's actions on this summary panel are out-of-scope for
  the current spec.

## 4. Step-by-step walkthrough — receiver side

### STEP 1 — Originator submits the mid-call summary response

This is STEP 10A from
[`ai-summary-initiator-flow.md`](./ai-summary-initiator-flow.md):

1. Originator clicks Initiate Consult / Initiate Transfer.
2. SDK sends `MID_CALL_CONSULT_SUMMARY_RESPONSE` (or `_TRANSFER_…`) with
   the agent's edits, `state: 'DEFAULT'` or `'EXCLUDED'`, `agentName`, and
   `numberOfTimesEdited` reflecting the edits.
3. Existing `task.consult(...)` / `task.transfer(...)` is invoked.

### STEP 2 — Backend forwards the call AND the summary

- WxCC's existing consult/transfer routing places the call on the
  receiving agent's queue / direct routing.
- Once the receiving agent accepts the task, the receiver's
  `taskCollection` includes a `Task` keyed by the **same**
  `conversationId` as the originator.
- In parallel, the backend pushes a
  `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` WS frame onto the
  receiving agent's realtime channel.

### STEP 3 — `cc.ts` routes the WS frame

- **Where:** `cc.handleWebsocketMessage(eventData)` in `src/cc.ts`
- **Top-level switch (spec §15.5):**
  ```ts
  case CC_EVENTS.MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT:
    this.taskManager.handleAISummaryEvent({
      type: 'MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT',
      data: eventData.data?.data,   // ← double-unwrap
    });
    break;
  ```
- This is the same switch arm used for `POST_CALL_SUMMARY` and
  `MID_CALL_SUMMARY` — only the `eventData.type` differs.

### STEP 4 — `TaskManager` finds the right Task and emits

- **Where:** `TaskManager.handleAISummaryEvent({type, data})` in
  `src/services/task/TaskManager.ts`
- **Lookup:** `findTaskByCorrelation(data.conversationId, data.interactionId)`
  - On the receiver, `interactionId` may differ from the originator's;
    `conversationId` is the stable handle.
  - The linear-scan branch in `findTaskByCorrelation` survives until
    backend Q3 is answered (spec §15.4).
- **If no task found:** `LoggerProxy.warn(...)` and silently drop.
- **If found:**
  ```ts
  task.emit(
    TASK_EVENTS.TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT,
    data as MidCallSummaryReceivingAgentPayload
  );
  ```

### STEP 5 — Sample app handler renders the summary

```js
// inside wireSummaryListeners(task)
task.on('task:midCallSummaryForReceivingAgent', (payload) => {
  console.info('[Receiving agent] mid-call summary delivered',
    { conversationId: payload.conversationId });
  // Production widget renders payload.adaptiveCard verbatim.
  // Sample app does NOT render adaptive cards (per spec §17.5):
  //   ─ optionally show payload.summaryText fallback line
  //   ─ optionally show payload.sections in a textarea
});
```

The sample app intentionally does no UI rendering for receiver-side
summaries beyond the console log — production widgets render the
`adaptiveCard` natively. (See spec §17.5 "Out of scope for sample app".)

### STEP 6 — No outbound action

- Receiver does NOT send any `*_RESPONSE` event.
- Receiver does NOT increment counters or record feedback.
- The summary is read-only on the receiver side.
- When the receiver eventually wraps up (post-consult / post-transfer
  completion), the **post-call** summary flow runs independently — see
  [`ai-summary-postcall-flow.md`](./ai-summary-postcall-flow.md).

## 5. Quick mental model

1. **Originator's MID_CALL_*_SUMMARY_RESPONSE** carries the edited summary back to the backend.
2. **Backend** routes the call AND pushes `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` to the receiver.
3. **`cc.ts`** unwraps two layers, hands inner payload to `TaskManager`.
4. **`TaskManager`** correlates by `conversationId`, emits `task:midCallSummaryForReceivingAgent`.
5. **Widget / sample app** subscribes via `task.on(...)`, renders `adaptiveCard`.
6. **No outbound response** — receiver is read-only on this event.

## 6. Key differences vs. initiator mid-call flow

| Aspect | Initiator | Receiver |
|---|---|---|
| Trigger | Agent clicks Consult / Transfer | Backend pushes after originator's response |
| SDK method called | `requestMidCallSummary(actionType)` | none — purely event-driven |
| Inbound WS event | `MID_CALL_SUMMARY` | `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` |
| SDK event emitted | `task:midCallSummary` | `task:midCallSummaryForReceivingAgent` |
| Payload type | `MidCallSummaryEventPayload` | `MidCallSummaryReceivingAgentPayload` |
| `editAdaptiveCard*` | YES (initiator can edit) | NO (read-only) |
| `summaryText` | full plain-text body | short fallback line (~45 chars) |
| `areTranscriptsAvailable` | YES | NO |
| Outbound `*_RESPONSE` | YES (`MID_CALL_*_SUMMARY_RESPONSE`) | NONE |
| Counters / feedback / state | tracked & sent | not tracked |
| Promise pattern | `requestMidCallSummary` resolves with payload | n/a — `task.on(...)` only |
| Timeout | 30 s race in `requestMidCallSummary` | n/a — purely passive |
| Disabled-flag gate | `consultTransferSummariesEnabled` | n/a — receiver does not gate |

## 7. Cross-references

- Authoritative spec: [`ai-summary.md`](./ai-summary.md)
  - §3.2 `MidCallSummaryReceivingAgentPayload`, `TASK_MID_CALL_SUMMARY_FOR_RECEIVING_AGENT`
  - §6.2 `MID_CALL_SUMMARY_RESPONSE_SUBSEQUENT_AGENT` schema
  - §6.3.1 cross-reference to `AIAssistantTypes.MidCallSummaryResponseSubsequentAgent.data`
  - §15.3 `TaskManager.handleAISummaryEvent` switch
  - §15.4 `findTaskByCorrelation` (linear-scan fallback for cross-agent correlation)
  - §15.5 `cc.handleWebsocketMessage` switch
  - §17.2 sample-app listener wiring
  - §17.5 sample-app receiver-side rendering is out of scope
- Companion docs:
  - [`ai-summary-initiator-flow.md`](./ai-summary-initiator-flow.md) — mid-call initiator
  - [`ai-summary-postcall-flow.md`](./ai-summary-postcall-flow.md) — post-call summary

