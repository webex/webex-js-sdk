# New Method — Requirements Gathering

---

## STOP -- Ask These Questions First

**You MUST present the following questions to the developer and wait for their answers before proceeding.** Do not infer answers, do not start reading code, do not begin implementation. Every section marked MANDATORY must be answered before moving to implementation.

---

### 1. Method Identity (MANDATORY)

1. **"Which file will this method be added to?"**
   - e.g., `src/CallingClient/calling/call.ts`, `src/CallingClient/CallingClient.ts`, `src/CallingClient/line/index.ts`

2. **"What is the method name?"** (must be camelCase)
   - e.g., `parkCall`, `retrieveCall`, `sendDigit`

3. **"Describe what this method does in one or two sentences."**
   - e.g., "Parks the current active call on a designated call park extension. The parked call can be retrieved by another user."

---

### 2. Method Signature (MANDATORY)

4. **"What parameters does this method accept? Provide name and type for each."**
   - e.g., `parkExtension: string`, `timeout?: number`
   - Are any parameters optional?

5. **"What does this method return?"**
   - e.g., `Promise<void>`, `Promise<ParkResponse>`, `void`, `boolean`
   - Is it synchronous or asynchronous?

---

### 3. API Integration (MANDATORY if the method makes an API call, otherwise skip)

6. **"What is the HTTP method and Mobius endpoint?"**
   - e.g., `POST /calling/web/calls/{callId}/park`

7. **"What is the request body (if any)?"**
   - Provide the JSON shape or note "no request body"

8. **"What is the expected success response?"**
   - HTTP status code and response body shape

9. **"What error codes can this endpoint return?"**
   - e.g., 400 (bad request), 404 (call not found), 408 (timeout), 500 (server error)

> **Important: HTTP response vs. Mercury WebSocket response**
>
> Many Mobius operations follow a two-phase pattern:
> 1. **HTTP response** -- The immediate API response (e.g., 200 OK) confirms the request was accepted
> 2. **Mercury WebSocket event** -- The actual state change arrives asynchronously via a `callInfo` WebSocket event (e.g., `callState: 'HELD'`)
>
> Ask the developer: **"Does the state change come back via the HTTP response or via a Mercury WebSocket event?"** This determines whether you emit the success event immediately or wait for a WebSocket callback.

---

### 4. Event Contract (MANDATORY if the method emits events to consumers, otherwise skip)

10. **"What event key should be emitted on success?"**
    - e.g., `CALL_EVENT_KEYS.PARKED`, `CALL_EVENT_KEYS.HELD`
    - Does this need a new entry in `CALL_EVENT_KEYS` / `LINE_EVENT_KEYS` / `CALLING_CLIENT_EVENT_KEYS`?

11. **"What is the event payload type?"**
    - e.g., `(callId: CallId) => void`, `(error: CallError) => void`

12. **"What triggers the event emission?"**
    - Immediate (after HTTP response)
    - Deferred (after Mercury WebSocket event arrives)
    - On timeout (supplementary services timer)

---

### 5. Metrics (MANDATORY)

13. **"Which `METRIC_EVENT` should be used?"**
    - Existing: `METRIC_EVENT.CALL`, `METRIC_EVENT.CALL_ERROR`, `METRIC_EVENT.MEDIA`, `METRIC_EVENT.MEDIA_ERROR`, `METRIC_EVENT.REGISTRATION`, etc.
    - Or does this need a new `METRIC_EVENT` entry?

14. **"Which `IMetricManager` submit method should be used?"**
    - `submitCallMetric` -- for call control operations
    - `submitMediaMetric` -- for media operations
    - `submitRegistrationMetric` -- for registration operations
    - `submitVoicemailMetric` -- for voicemail operations

15. **"Is this an OPERATIONAL or BEHAVIORAL metric?"**
    - `METRIC_TYPE.OPERATIONAL` -- internal system events (keepalive, reconnect)
    - `METRIC_TYPE.BEHAVIORAL` -- user-initiated actions (hold, transfer, dial)

---

### 6. Behavior Details (MANDATORY)

16. **"What happens on success?"**
    - Describe the complete happy path (API call, state transition, event emission, metric)

17. **"What happens on failure?"**
    - Describe what should happen when the API call fails or times out

18. **"Are there edge cases to handle?"**
    - e.g., method called when call is not connected, method called twice in a row, race conditions with other operations

---

## Completion Gate

**Before proceeding to implementation, verify ALL of the following:**

- [ ] Target file identified
- [ ] Method name confirmed (camelCase)
- [ ] Method behavior described
- [ ] Parameters with types listed
- [ ] Return type specified
- [ ] API contract captured (or confirmed no API call)
- [ ] Event contract captured (or confirmed no events)
- [ ] Metric event and submit method chosen
- [ ] Metric type (OPERATIONAL/BEHAVIORAL) chosen
- [ ] Success behavior described
- [ ] Failure behavior described
- [ ] Edge cases identified

**If any MANDATORY field is missing, ask a targeted follow-up question before proceeding.**

---

## Spec Summary

Present this summary to the developer for approval before implementing:

```
## Spec Summary -- New Method

**Method**: `<methodName>` on `<ClassName>`
**File**: `<target file path>`
**Signature**: `<methodName>(param1: Type1, param2?: Type2): ReturnType`

### API Call:
- HTTP: <METHOD> <endpoint>
- Request: <shape or "none">
- Success response: <status code + shape>
- Error codes: <list>
- State change via: <HTTP response | Mercury WebSocket event>

### Events:
- Success: `<EVENT_KEY>` with payload `<type>`
- Error: `<ERROR_EVENT_KEY>` with payload `<CallError>`
- Trigger: <immediate | deferred via WS | timeout>

### Metrics:
- Success: `<METRIC_EVENT>` via `<submitMethod>` (type: <OPERATIONAL|BEHAVIORAL>)
- Failure: `<METRIC_EVENT_ERROR>` via `<submitMethod>` (type: <OPERATIONAL|BEHAVIORAL>)

### Behavior:
- Happy path: <description>
- Error path: <description>
- Edge cases: <description>

### Constants & Types to add:
- `METHODS.<METHOD_NAME>` in `src/CallingClient/constants.ts`
- [new types] in `<module>/types.ts`
- [new event keys] in `src/Events/types.ts`
- [new metric events] in `src/Metrics/types.ts` (if applicable)

---
Does this match your intent? (Yes / No / Adjust)
```

**Wait for developer approval before implementing.**

---

## Example: parkCall on the Call class

Here is a concrete example of a completed spec for a hypothetical `parkCall` method:

```
## Spec Summary -- New Method

**Method**: `parkCall` on `Call`
**File**: `src/CallingClient/calling/call.ts`
**Signature**: `parkCall(): void`

### API Call:
- HTTP: POST /calling/web/calls/{callId}/park
- Request: none (callId is in the URL path)
- Success response: 200 OK with { statusCode: number }
- Error codes: 404 (call not found), 408 (timeout), 500 (server error)
- State change via: Mercury WebSocket event (callState: 'PARKED')

### Events:
- Success: `CALL_EVENT_KEYS.PARKED` with payload `(callId: CallId) => void`
- Error: `CALL_EVENT_KEYS.PARK_ERROR` with payload `(error: CallError) => void`
- Trigger: Deferred — success event emitted when Mercury WS delivers callState 'PARKED'

### Metrics:
- Success: `METRIC_EVENT.CALL` via `submitCallMetric` (type: BEHAVIORAL)
- Failure: `METRIC_EVENT.CALL_ERROR` via `submitCallMetric` (type: BEHAVIORAL)

### Behavior:
- Happy path: User calls parkCall() -> POST to Mobius -> 200 OK -> Mercury WS delivers
  callState 'PARKED' -> emit PARKED event to consumer -> submit CALL metric
- Error path: POST fails -> log error -> create CallError -> submit CALL_ERROR metric
  -> emit PARK_ERROR event -> send state machine back to E_CALL_ESTABLISHED
- Edge cases: Call not in connected state (reject), parkCall called during hold
  (reject with error), supplementary services timeout (emit PARK_ERROR after 10s)

### Constants & Types to add:
- `METHODS.PARK_CALL = 'parkCall'` in `src/CallingClient/constants.ts`
- `SUPPLEMENTARY_SERVICES.PARK` already exists in `src/Events/types.ts`
- `CALL_EVENT_KEYS.PARKED = 'parked'` in `src/Events/types.ts`
- `CALL_EVENT_KEYS.PARK_ERROR = 'park_error'` in `src/Events/types.ts`
- Add `parkCall(): void` to `ICall` interface in `src/CallingClient/calling/types.ts`
- Add event handler types to `CallEventTypes` in `src/Events/types.ts`

---
Does this match your intent? (Yes / No / Adjust)
```

---

## Next Step

Once the developer approves the spec summary, proceed to **[02-implementation.md](02-implementation.md)**.
