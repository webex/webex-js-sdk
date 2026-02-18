# New Service - Pre-Questions

> **Purpose**: Gather requirements before generating service code.

---

## Required Information

### 1. Service Identity

**Service Name**: (e.g., "AddressBook", "Queue", "EntryPoint")
- Must be PascalCase
- Will create `src/services/ServiceName.ts`

**Purpose**: (One sentence description)
- What problem does this service solve?
- What data does it manage?

### 2. API Contract (MANDATORY)

Capture the complete API signature for **each** API used by the new service:

| API Name | HTTP Method | Endpoint | Request Payload (type + required fields) | Response (type + structure) | Error Shape |
|---|---|---|---|---|---|
| `getXxx` | `GET` | `/v1/...` | `GetXxxParams` (`fieldA`, `fieldB?`) | `GetXxxResponse` (`data`, `trackingId`, `meta?`) | `reason`, `reasonCode`, `trackingId` |

**API Endpoint Base**: (e.g., `/v1/address-books`)
**HTTP Methods Needed**:
- [ ] GET (fetch data)
- [ ] POST (create/search)
- [ ] PUT (update)
- [ ] DELETE (remove)

Rules:
- Use exact endpoint path and method.
- Include payload/response type names and field structure.
- If any entry is unknown, stop and ask the developer before coding.

### 3. Event Contract (MANDATORY if feature uses events)

Fill only if the service listens to or emits events.

| Event | Direction | Listen/Emit Object | Payload (type + structure) | SDK Emits? | Emitted From (class/file/method) | Trigger |
|---|---|---|---|---|---|---|
| `AgentContactReserved` | Incoming | `TaskManager` | `TaskData` | N/A | N/A | WebSocket event |
| `task:incoming` | Outgoing | `task` | `ITask` | Yes | `Task` / state-machine action override | Transition on incoming task |

Must clarify:
- where consumers subscribe (`cc`, `task`, `taskManager`, service)
- exact payload shape subscribers receive
- source + trigger for every SDK-emitted event

### 4. Dependencies

**Requires Agent Profile Data?**
- [ ] Yes - list exact fields (e.g., `addressBookId`, `teamIds`)
- [ ] No

**Requires WebSocket Event Processing?**
- [ ] Yes - list event names and how they map to service behavior
- [ ] No

### 4. Exposure

**Exposed on ContactCenter?**
- [ ] Yes - `cc.serviceName` (public API)
- [ ] No - internal service only

**Methods to Expose**:
- `getXxx()` - Fetch list
- `getXxxById()` - Fetch single item
- Other methods?

### 5. Caching

**Caching Required?**
- [ ] Yes - in-memory cache
- [ ] No - always fetch fresh

---

## Example Answers (AddressBook)

```
Service Name: AddressBook
Purpose: Manage address book entries for agent speed dial and transfer

API Endpoint: /v1/address-books/{addressBookId}/entries
HTTP Methods: GET
Response: { data: AddressBookEntry[], meta: {...} }

Dependencies: Requires addressBookId from agent profile
WebSocket Events: No

Exposed: Yes, as cc.addressBook
Methods: getEntries(params)
Caching: No
```

---

## Next Step

Once questions are answered, proceed to:
[`02-code-generation.md`](02-code-generation.md)
