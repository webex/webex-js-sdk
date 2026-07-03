# New Method - Requirements

> **Purpose**: Gather requirements from the developer before implementing the new method.

---

## STOP — Ask These Questions First

**You MUST present the following questions to the developer and wait for their answers before proceeding.** Do not infer answers from the developer's initial request. Do not fill in fields yourself. Do not start reading implementation code yet.

Present questions grouped by section. If the developer cannot answer a MANDATORY question, ask follow-up questions to help them clarify. Only proceed to implementation when all MANDATORY fields have explicit developer-provided answers.

---

## 1. Method Identity (MANDATORY)

Ask the developer:

1. **"Which file should this method be added to?"**
   - e.g., `cc.ts`, `services/agent/index.ts`, `services/task/contact.ts`

2. **"What should the method be named?"**
   - Must be camelCase (e.g., `getTeamStats`, `getBuddyAgents`)

3. **"What does this method do? Describe the expected behavior in one or two sentences."**

---

## 2. Method Signature (MANDATORY)

Ask the developer:

4. **"What parameters does this method accept? For each parameter, provide:"**
   - Parameter name
   - Type (string, number, object — if object, what fields?)
   - Required or optional?

5. **"What does this method return?"**
   - Return type structure (e.g., `{ data: { agentList: Agent[] }, trackingId: string }`)
   - What fields will consumers use?

---

## 3. API Integration (MANDATORY if the method calls a backend API, otherwise skip)

Ask the developer:

6. **"Does this method call a backend API?"**
   - If YES, for each API call ask:

   | Field | What to Ask |
   |---|---|
   | HTTP Method | "Is this a GET, POST, PUT, or DELETE?" |
   | Endpoint | "What is the full endpoint path?" |
   | Request Payload | "What fields does the request body contain? Which are required vs optional?" |
   | Response Channel | "Is the response received in the HTTP response itself, or via a WebSocket message?" |
   | Response Structure | "What does the response look like?" |
   | Error Shape | "What error reason codes can this return?" |

   > **Note**: Some methods receive their response directly in the HTTP response (e.g., `getBuddyAgents` returns data in the API response). Others initiate an operation via HTTP and receive the result asynchronously through a WebSocket message (e.g., `stationLogin` sends HTTP request, then receives `AGENT_STATION_LOGIN_SUCCESS` or `AGENT_STATION_LOGIN_FAILED` via WebSocket). Clarify which pattern applies.

   **If any API field is unknown, STOP and ask the developer. Do not guess.**

   - If NO (e.g., local computation, state change only): note "No API call" and skip to section 4.

---

## 4. Event Contract (MANDATORY if the method emits or listens to events, otherwise skip)

Ask the developer:

7. **"Does this method emit any events or listen to events?"**
   - If YES, for each event ask:

   | Field | What to Ask |
   |---|---|
   | Event Name | "What is the event name?" (e.g., `agent:buddyListSuccess`) |
   | Direction | "Is this incoming (WebSocket) or outgoing (emitted by SDK)?" |
   | Listen/Emit Object | "Where do consumers subscribe?" (`cc`, `task`, `taskManager`, service) |
   | Payload Type/Shape | "What data does the event carry?" |
   | Emitted From | "Which class/file emits this?" |
   | Emission Trigger | "What causes this event to fire?" (e.g., API success, WebSocket message) |

   **If the developer needs new event constants, note the constant names and values.**

   - If NO: note "No events" and skip to section 5.

---

## 5. Metrics (MANDATORY)

Ask the developer:

8. **"What should the success and failure metric event names be?"**
   - e.g., `FETCH_BUDDY_AGENTS_SUCCESS` / `FETCH_BUDDY_AGENTS_FAILED`
   - If the developer is unsure, suggest names following the convention: `[ACTION]_[OPERATION]_SUCCESS` / `[ACTION]_[OPERATION]_FAILED`

9. **"Do new metric constants need to be added to `src/metrics/constants.ts`?"**

---

## 6. Behavior Details (MANDATORY)

Ask the developer:

10. **"What should happen on success? (e.g., return data, emit event, update state)"**

11. **"What should happen on failure? (e.g., throw error, emit failure event, retry)"**

12. **"Are there any edge cases or special scenarios to handle?"**
    - e.g., empty results, missing permissions, specific error codes

---

## Completion Gate

**Before proceeding, verify:**

- [ ] Target file identified by developer
- [ ] Method name provided by developer
- [ ] Purpose/behavior described by developer
- [ ] Parameters fully specified (names, types, required/optional)
- [ ] Return type fully specified
- [ ] API contract captured (or developer confirmed no API call)
- [ ] Event contract captured (or developer confirmed no events)
- [ ] Metric event names defined
- [ ] Success and failure behavior described

**If any MANDATORY field above is missing an explicit developer answer, ask a targeted follow-up question. Do not proceed.**

---

## Spec Summary

Once all questions are answered, present this summary to the developer for approval before proceeding to implementation:

```
## Spec Summary — New Method

**Method**: `[methodName]([params]): Promise<[ReturnType]>`
**Target file**: [file path]
**Purpose**: [from Q3]

### Parameters:
| Name | Type | Required | Description |
|---|---|---|---|
| [param] | [type] | [Yes/No] | [description] |

### API Contract:
- HTTP: [METHOD] [endpoint]
- Request: [payload structure]
- Response: [response structure]
- Errors: [reason codes]
(or "No API call")

### Events:
| Event | Direction | Object | Payload | Trigger |
|---|---|---|---|---|
| [event] | [in/out] | [object] | [payload] | [trigger] |
(or "No events")

### Metrics:
- Success: [METRIC_NAME_SUCCESS]
- Failure: [METRIC_NAME_FAILED]
- New constants needed: [Yes/No]

### Behavior:
- On success: [description]
- On failure: [description]
- Edge cases: [list or "None"]

---
Does this match your intent? (Yes / No / Adjust)
```

**Wait for developer approval. Do not proceed to [`02-implementation.md`](02-implementation.md) until confirmed.**

---

## Example: Adding getBuddyAgents

```
## Spec Summary — New Method

**Method**: `getBuddyAgents(data: BuddyAgents): Promise<BuddyAgentsResponse>`
**Target file**: cc.ts
**Purpose**: Get list of available agents for consult/transfer
**Types to create**: Define `BuddyAgents` (request params) and `BuddyAgentsResponse` (response) in the appropriate types file (`src/types.ts` for public types, or `src/services/[service]/types.ts` for internal types). Export public types from `src/types.ts`.

### Parameters:
| Name | Type | Required | Description |
|---|---|---|---|
| mediaType | 'telephony' \| 'chat' \| 'social' \| 'email' | Yes | Media type channel filter |
| state | 'Available' \| 'Idle' | No | Optional agent state filter |

### API Contract:
- HTTP: POST /v1/agents/buddyList
- Request: { agentProfileId: string, mediaType: string, state?: string }
- Response channel: HTTP response (synchronous)
- Response: { data: { agentList: BuddyDetails[] }, trackingId: string }
- Errors: INVALID_STATE, UNAUTHORIZED

### Events: No events (promise-based only)

### Metrics:
- Success: FETCH_BUDDY_AGENTS_SUCCESS
- Failure: FETCH_BUDDY_AGENTS_FAILED
- New constants needed: Yes

### Behavior:
- On success: return response data
- On failure: throw augmented error via getErrorDetails
- Edge cases: empty agentList returns { data: { agentList: [] } }

### Type Definitions:
- **Input type `BuddyAgents`**: Defined in `src/types.ts` (public, consumer-facing)
  and `src/services/agent/types.ts` (internal, includes `agentProfileId` added by cc.ts)
- **Response type `BuddyAgentsResponse`**: Defined in `src/types.ts` as
  `Agent.BuddyAgentsSuccess | Error`
- **Internal types `BuddyAgentsSuccess`, `BuddyDetails`**: Defined in
  `src/services/agent/types.ts`
- **Pattern**: Public types (what consumers see) go in `src/types.ts`.
  Internal/service types (with extra fields like `agentProfileId`) go in
  `src/services/[service]/types.ts`.
```

---

## Next Step

Once the developer approves the spec summary, proceed to:
[`02-implementation.md`](02-implementation.md)
