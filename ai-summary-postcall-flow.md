# AI Post-Call Summary — Flow Architecture

> Companion to [`ai-summary.md`](./ai-summary.md) (authoritative spec) and [`ai-summary-initiator-flow.md`](./ai-summary-initiator-flow.md)
> (mid-call initiator flow). This file is a focused architecture view of
> what happens during the **post-call summary** flow on the wrapping-up
> agent's side. All semantics are derived from `ai-summary.md` §3.1.1,
> §3.1.2, §5.1.A, §5.2, §6.2, §15.5, §15.7, §17.2, §17.3.

## 1. Component map (wrap-up side)

```mermaid
flowchart LR
  subgraph Browser["Agent browser (sample app / widget)"]
    UI["Wrap-up UI<br/>summary text, feedback, copy<br/>wrap-up code"]
    App["app.js<br/>requestPostCallSummary()<br/>render summary<br/>wrapupCall()<br/>postCallSummary state"]
    subgraph SDK["@webex/contact-center SDK"]
      Task["Task (services/task/Task.ts)<br/>requestPostCallSummary<br/>sendPostCallSummaryResponse<br/>waitForSummaryEvent (once + 30s timer)"]
      API["ApiAIAssistant<br/>sendSummaryGetEvent<br/>sendSummaryResponseEvent"]
      CC["cc.ts<br/>handleWebsocketMessage<br/>switch on eventData.type<br/>double-unwrap data.data"]
      TM["TaskManager<br/>handleAISummaryEvent<br/>findTaskByCorrelation"]
    end
    UI --> App
    App -->|task methods| Task
    Task --> API
    CC -->|routes| TM
    TM -->|task.emit| Task
  end
  Backend["Backend: api-ai-assistant<br/>POST /event (HTTP 202)<br/>Realtime push on WSS"]
  WS["Realtime subscription WSS<br/>double envelope: type, data.data"]
  API -->|HTTPS POST /event| Backend
  Backend -->|realtime push| WS
  WS -->|WS frame| CC
```

## 2. Happy path — task enters wrap-up → edit → submit wrap-up → send response

```mermaid
sequenceDiagram
  actor Widget
  participant Task
  participant API as ApiAIAssistant
  participant Backend
  participant WS as WS push
  participant CC as cc.ts
  participant TM as TaskManager

  Widget->>Task: requestPostCallSummary()
  alt wrapUpSummariesEnabled is false
    Task-->>Widget: throw POST_CALL_SUMMARY_DISABLED
  else enabled
    Note over Task: timeEvent(GET_POST_CALL S/F)<br/>attach once listener + 30s timeout<br/>external listeners remain active
    Task->>API: sendSummaryGetEvent(GET_POST_CALL_SUMMARY)
    API->>Backend: POST /event
    Backend-->>API: HTTP 202
    API-->>Task: trackEvent(GET success); Promise remains pending
    Backend->>WS: POST_CALL_SUMMARY double envelope
    WS->>CC: WS frame
    Note over CC: switch(eventData.type)<br/>double-unwrap data.data
    CC->>TM: handleAISummaryEvent(POST_CALL_SUMMARY, payload)
    Note over TM: findTaskByCorrelation<br/>(conversationId, interactionId)
    TM->>Task: emit TASK_POST_CALL_SUMMARY(payload)
    Note over Task: internal once resolves Promise<br/>external task.on listeners also fire
    Task-->>Widget: summary payload
    Note over Widget: render summary; increment viewed<br/>agent edits, copies, gives feedback,<br/>and selects wrap-up code
    Widget->>Task: wrapup(...)
    Task-->>Widget: wrap-up completed
    Widget->>Task: sendPostCallSummaryResponse(payload)
    Task->>API: sendSummaryResponseEvent(POST_CALL_SUMMARY_RESPONSE)
    API->>Backend: POST /event
    Backend-->>API: HTTP 200/202
    API-->>Task: trackEvent(POST_CALL_RESPONSE_SUCCESS or FAILED)
    Task-->>Widget: response completed
    Note over Widget,Task: Existing wrap-up API completes before the summary response is sent
  end
```

## 3. Decision table — `state` values the wrap-up agent may send

| Branch               | Trigger                                             | `state` on wire | `summary`                                   | `wrapUpCode`         |
|----------------------|-----------------------------------------------------|-----------------|---------------------------------------------|----------------------|
| Submit (default)     | Agent submitted wrap-up after seeing summary        | `DEFAULT`       | `Partial<PostCallSummarySections>` (or `{}`) | required, non-null   |
| Ignored              | Agent dismissed summary block but still wrapped up  | `IGNORED`       | `{}`                                        | required, non-null   |
| Not received         | WS push timed out / never arrived; agent still wrapped up | `NOT_RECEIVED` | `{}`                                  | required, non-null   |

`MID_CALL_CANCELLED` and `EXCLUDED` are **mid-call only** — never sent on a `POST_CALL_SUMMARY_RESPONSE`.

## 4. Wire-shape & redaction reminders (post-call outbound)

```
POST /event  (POST_CALL_SUMMARY_RESPONSE)
{
  agentId, orgId, eventType: 'CTI_EVENT',
  eventName: 'POST_CALL_SUMMARY_RESPONSE',
  publishTimestamp: <number>,
  eventDetails: { data: {
    conversationId, interactionId, clientType: 'WxCC',
    action: 'POST_CALL_SUMMARY_RESPONSE',
    actionTimeStamp: <number>,                        ← NUMBER (not string)
    summary: {                                         ← always object; {} if no edits
      initialContactReason?, additionalContactReasons?,
      additionalContext?, keyActionsTaken?, nextSteps?
    },
    numberOfTimesViewed: 1,                           ← NUMBERS (not strings)
    numberOfTimesEdited: 1,
    numberOfTimesCopied: 0,
    feedback: 'none' | 'thumbs_up' | 'thumbs_down',
    state:    'DEFAULT' | 'IGNORED' | 'NOT_RECEIVED',
    wrapUpCode: 'Sale'                                ← REQUIRED non-null string
    // NO agentName key (agentName is mid-call only)
  }}
}
```

NEVER log: `summary` body, `summaryText`, `adaptiveCard` body,
`editAdaptiveCard` body, `sections` *values*. Loggable: counters, `state`,
`feedback`, `wrapUpCode`, IDs, `languageCode`, `resolution`,
`areTranscriptsAvailable`, `adaptiveCardId`, `editAdaptiveCardId`,
`sectionsKeys`, `hasSummaryText` (spec §8.1).

## 5. Promise + event coexistence (§3.1.1, §15.7)

```mermaid
flowchart LR
  Emit["task.emit(TASK_POST_CALL_SUMMARY, payload)"]
  External["External task.on listener"]
  Widget["Widget receives public event"]
  Internal["Internal once listener<br/>inside waitForSummaryEvent"]
  Promise["requestPostCallSummary<br/>Promise resolves"]
  Emit --> External --> Widget
  Emit --> Internal --> Promise
```

On 30 s timeout (`AI_SUMMARY_REQUEST_TIMEOUT_MS`): the internal `once` is
detached and the Promise rejects with `POST_CALL_SUMMARY_TIMEOUT`; late WS
arrivals still fire the public event for any external listeners (no
double-settle). If timing out is the actual outcome, the widget should send
`state: 'NOT_RECEIVED'` on the response.

## 6. Step-by-step walkthrough — post-call summary

Each step lists: who does it → what happens → which file/method.

### STEP 1 — Task transitions to wrap-up state

- The existing WxCC task state machine moves the task to `WRAPPING_UP`
  (after the call ends and the agent has pressed "End Call" or been
  released, depending on the routing config).
- The sample app's existing UI-controls path detects this; in the new
  surface this hooks into `onWrapupEntry(task)` (spec §17.2 / Phase 5 T5.13).
- **Handler:** `app.js` → `onWrapupEntry(task)`
- **What happens:**
  1. Reset module state:
     ```js
     postCallSummary = {
       payload: null,
       numberOfTimesViewed: 0, numberOfTimesEdited: 0, numberOfTimesCopied: 0,
       feedback: 'none',
     };
     ```
  2. Show `#postcall-summary-block` with status text **"Waiting for summary…"**
  3. Call the SDK:
     ```js
     const summary = await task.requestPostCallSummary();
     ```

### STEP 2 — SDK validates the feature flag

- **Where:** `Task.requestPostCallSummary()` in `src/services/task/Task.ts`
- **Check:** `aiFeature.generatedSummaries.wrapUpSummariesEnabled === true`
- **If false:** throw `POST_CALL_SUMMARY_DISABLED` (caller's `await` rejects, no network call).
- **If true:** continue.

### STEP 3 — SDK arms the WS-await race BEFORE making the HTTP call

- Calls private helper `waitForSummaryEvent(TASK_POST_CALL_SUMMARY, 30_000ms, …)`.
- Subscribes a **`once(...)`** listener for `TASK_POST_CALL_SUMMARY` and
  starts a 30 s timer (`AI_SUMMARY_REQUEST_TIMEOUT_MS`).
- Subscribing first prevents a race where the WS push beats the HTTP
  response. `once` is used so external `task.on('task:postCallSummary', …)`
  subscribers are unaffected — multi-session contract (spec §3.1.1).

### STEP 4 — SDK sends the GET event over HTTPS

- **Method called:** `ApiAIAssistant.sendSummaryGetEvent(agentId, interactionId, conversationId, eventName)` in `src/services/ApiAiAssistant.ts`
- **Event name:** `GET_POST_CALL_SUMMARY` (no consult/transfer variants for post-call).
- **Network call:** `POST /event` to `api-ai-assistant.<env>.ciscoccservice.com`
- **Body (spec §6.2):**
  ```json
  {
    "agentId": "<uuid>",
    "orgId": "<uuid>",
    "eventType": "CTI_EVENT",
    "eventName": "GET_POST_CALL_SUMMARY",
    "publishTimestamp": 1779840000000,
    "eventDetails": {
      "data": {
        "interactionId": "<uuid>",
        "conversationId": "<uuid>",
        "clientType": "WxCC",
        "actionTimeStamp": 1779840000000
      }
    }
  }
  ```
- **Backend response:** HTTP **202 Accepted**. Real summary arrives over WS later.
- **Telemetry:** `metricsManager.timeEvent + trackEvent(AI_SUMMARY_GET_POST_CALL_SUCCESS)` on success, `_FAILED` on error.

`requestPostCallSummary`'s Promise is still pending at this point.

### STEP 5 — Backend pushes the summary on the WebSocket

- **Channel:** `wss://api.<region>.cisco.com/v1/realtime/subscription/Desktop-<uuid>`
- **Frame (double envelope, spec §6.2):**
  ```json
  {
    "type": "POST_CALL_SUMMARY",
    "trackingId": "notifs-data_<uuid>",
    "orgId": "<uuid>",
    "data": {
      "agentId": "<uuid>", "orgId": "<uuid>",
      "notifType": "POST_CALL_SUMMARY",
      "notifDetails": { "actionEvent": "POST_CALL_SUMMARY" },
      "data": {
        "conversationId": "<uuid>",
        "adaptiveCard": { "...": "..." },
        "adaptiveCardId": "<uuid>",
        "editAdaptiveCard": { "...": "..." },
        "editAdaptiveCardId": "<uuid>",
        "languageCode": "en",
        "summaryText": "Initial reason: …\n\nNext steps: …",
        "resolution": "RESOLVED",
        "areTranscriptsAvailable": true,
        "sections": {
          "initialContactReason": "…",
          "additionalContactReasons": "…",
          "additionalContext": "…",
          "keyActionsTaken": "…",
          "nextSteps": "…"
        },
        "suggestedWrapUpCodes": ["Sale", "Support"],
        "suggestedWrapUpCodesMessage": "Choose the closest match",
        "timestamp": 1779840100000
      }
    }
  }
  ```
- Two `data` levels — outer envelope wraps inner envelope which holds the actual payload.
- Post-call inner payload differs from mid-call by carrying `suggestedWrapUpCodes` / `suggestedWrapUpCodesMessage` and the post-call `sections` keys (`initialContactReason`, `additionalContactReasons`, `additionalContext`, `keyActionsTaken`, `nextSteps`).

### STEP 6 — `cc.ts` routes the WS frame

- **Where:** `cc.handleWebsocketMessage(eventData)` in `src/cc.ts`
- **Top-level switch on `eventData.type`** (spec §15.5):
  ```ts
  case CC_EVENTS.POST_CALL_SUMMARY:
    this.taskManager.handleAISummaryEvent({
      type: 'POST_CALL_SUMMARY',
      data: eventData.data?.data,   // ← double-unwrap to inner payload
    });
    break;
  ```
- Outer envelope fields (`agentId`, `notifType`, `trackingId`) are dropped — only the inner payload is forwarded.

### STEP 7 — `TaskManager` finds the right Task and emits

- **Where:** `TaskManager.handleAISummaryEvent({type, data})` in `src/services/task/TaskManager.ts`
- **Lookup:** `findTaskByCorrelation(data.conversationId, data.interactionId)`
- **If no task found:** `LoggerProxy.warn(...)` and silently drop.
- **If found:**
  ```ts
  task.emit(TASK_EVENTS.TASK_POST_CALL_SUMMARY, data);
  ```

### STEP 8 — Two listeners fire concurrently

When `task.emit(TASK_POST_CALL_SUMMARY, payload)` runs, BOTH fire:

| Listener | Source | Effect |
|---|---|---|
| **Internal `once(…)`** | armed in Step 3 | resolves the Promise from `requestPostCallSummary()` |
| **External `task.on('task:postCallSummary', …)`** | wired by `wireSummaryListeners(task)` in app.js | runs the sample-app handler |

Sample app:

```js
// (a) The Promise resolves
const summary = await task.requestPostCallSummary();
// → updates "Summary ready." status

// (b) The on(...) handler also fires (multi-session contract):
task.on('task:postCallSummary', (payload) => {
  postCallSummary.payload = payload;
  document.getElementById('postcall-summary-text').value = renderSummaryText(payload);
  postCallSummary.numberOfTimesViewed += 1;
  document.getElementById('postcall-summary-block').style.display = '';
  // Optional: populate #wrapupCodesDropdown from payload.suggestedWrapUpCodes
});
```

> **Timeout case:** if no WS frame arrives within 30 s, the `once` listener is detached and the Promise rejects with `POST_CALL_SUMMARY_TIMEOUT`. External `task.on(...)` listeners still fire if a late frame arrives. The widget can still proceed with wrap-up and send `state: 'NOT_RECEIVED'`.

### STEP 9 — Agent interacts with the summary block

- Edits text in `<textarea id="postcall-summary-text">` — **edit count is computed at submit time** by comparing edited text vs. `renderSummaryText(payload)`, not on each keystroke.
- Click 👍 → `postCallSummary.feedback = 'thumbs_up'`
- Click 👎 → `postCallSummary.feedback = 'thumbs_down'`
- Click "Copy" → `navigator.clipboard.writeText(...)` AND `numberOfTimesCopied += 1`
- Choose a value in `#wrapupCodesDropdown` (separate from summary block; existing UI).

### STEP 10 — Agent clicks **"Wrapup"**

- **Handler:** `wrapupCall()` in `app.js`
- **Sequencing rule (spec §5.2):** WRAP-UP API FIRST, then summary response.

```js
async function wrapupCall() {
  const wrapupReason = wrapupCodesDropdownElm.options[wrapupCodesDropdownElm.selectedIndex].text;
  const auxCodeId    = wrapupCodesDropdownElm.options[wrapupCodesDropdownElm.selectedIndex].value;
  try {
    // (1) Existing wrap-up API FIRST — unchanged
    await currentTask.wrapup({ wrapUpReason: wrapupReason, auxCodeId });

    // (2) THEN send the summary response
    if (postCallSummary.payload) {
      const editedSummary = document.getElementById('postcall-summary-text').value;
      if (editedSummary !== renderSummaryText(postCallSummary.payload)) {
        postCallSummary.numberOfTimesEdited += 1;
      }
      await currentTask.sendPostCallSummaryResponse({
        conversationId: postCallSummary.payload.conversationId,
        interactionId:  currentTask.data.interactionId,
        summary: editedSummary,                       // Partial<PostCallSummarySections>
        numberOfTimesViewed: postCallSummary.numberOfTimesViewed,
        numberOfTimesEdited: postCallSummary.numberOfTimesEdited,
        numberOfTimesCopied: postCallSummary.numberOfTimesCopied,
        feedback: postCallSummary.feedback,
        state: 'DEFAULT',
        wrapUpCode: wrapupReason,                     // REQUIRED non-null string
      });
    }
  } catch (error) {
    // wrap-up failed → DO NOT send summary response (sequencing rule §5.2)
    console.error('Failed to wrap up the call', error);
  }
}
```

Inside the SDK, `Task.sendPostCallSummaryResponse(payload)` →
`ApiAIAssistant.sendSummaryResponseEvent(agentId, {...payload, eventName: 'POST_CALL_SUMMARY_RESPONSE'})`
→ `POST /event` with the body shown in §4.

If wrap-up fails, the summary response is **NOT** sent — see spec §18.4 row E12.

### Quick mental model

1. **Task → wrap-up state** → app.js calls `task.requestPostCallSummary()`.
2. **SDK** arms a `once` WS listener + 30 s timer, then fires `POST /event GET_POST_CALL_SUMMARY` (HTTP 202).
3. **Backend** pushes `POST_CALL_SUMMARY` over WS (double envelope, post-call sections).
4. **`cc.ts`** unwraps two layers, hands inner payload to `TaskManager`.
5. **`TaskManager`** finds the Task and emits `task:postCallSummary`.
6. **Both consumers** fire — Promise resolves AND `task.on(...)` listener runs.
7. **Agent edits / votes / copies** + chooses wrap-up code from dropdown.
8. **Click Wrapup**: `currentTask.wrapup(...)` FIRST, THEN `POST_CALL_SUMMARY_RESPONSE` with `state: 'DEFAULT'`, `wrapUpCode: <code>`.
9. **If wrap-up fails**: skip summary response (sequencing rule, telemetry stays consistent).
10. **If WS push times out**: send `state: 'NOT_RECEIVED'`, `summary: {}` after wrap-up succeeds.

## 7. Key differences vs. mid-call flow

| Aspect | Post-call | Mid-call |
|---|---|---|
| Trigger | Task → `WRAPPING_UP` | Agent clicks Consult / Transfer |
| GET event names | `GET_POST_CALL_SUMMARY` | `GET_MID_CALL_CONSULT_SUMMARY` / `GET_MID_CALL_TRANSFER_SUMMARY` |
| Response event names | `POST_CALL_SUMMARY_RESPONSE` | `MID_CALL_CONSULT_SUMMARY_RESPONSE` / `MID_CALL_TRANSFER_SUMMARY_RESPONSE` |
| Sections keys | `initialContactReason`, `additionalContactReasons`, `additionalContext`, `keyActionsTaken`, `nextSteps` | `reasonForTransferOrConsult`, `additionalContext`, `keyActionsTaken` |
| WS push extras | `suggestedWrapUpCodes`, `suggestedWrapUpCodesMessage` | none |
| Sequencing | wrap-up FIRST, then response | response FIRST, then consult/transfer |
| `wrapUpCode` on response | **REQUIRED** non-null string | **OMITTED** entirely (NOT `null`) |
| `agentName` on response | NOT sent | **REQUIRED** |
| Cancel `state` | n/a (no cancel branch) | `MID_CALL_CANCELLED` |
| Disabled-flag error | `POST_CALL_SUMMARY_DISABLED` | `MID_CALL_SUMMARY_DISABLED` |
| Disabled flag | `aiFeature.generatedSummaries.wrapUpSummariesEnabled` | `aiFeature.generatedSummaries.consultTransferSummariesEnabled` |
| Timeout error | `POST_CALL_SUMMARY_TIMEOUT` | `MID_CALL_SUMMARY_TIMEOUT` |

## 8. Cross-references

- Authoritative spec: [`ai-summary.md`](./ai-summary.md)
  - §3.1.1 `requestPostCallSummary`
  - §3.1.2 `sendPostCallSummaryResponse`
  - §5.1.A post-call flow
  - §5.2 sequencing
  - §6.2 wire schemas
  - §8.1 redaction rules
  - §15.5 `cc.handleWebsocketMessage` switch
  - §15.7 `Task` public methods + `waitForSummaryEvent`
  - §17.2 / §17.3 sample-app wiring & sequencing
- Companion docs:
  - [`ai-summary-initiator-flow.md`](./ai-summary-initiator-flow.md) — mid-call initiator
  - [`ai-summary-receiver-flow.md`](./ai-summary-receiver-flow.md) — receiver-side mid-call
