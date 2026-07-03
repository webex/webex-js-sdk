# New Service - Pre-Questions

> **Purpose**: Gather requirements from the developer before generating service code.

---

## STOP — Ask These Questions First

**You MUST present the following questions to the developer and wait for their answers before proceeding.** Do not infer answers from the developer's initial request. Do not fill in fields yourself. Do not read code or load patterns yet.

Present questions grouped by section. If the developer cannot answer a MANDATORY question, ask follow-up questions to help them clarify. Only proceed to code generation when all MANDATORY fields have explicit developer-provided answers.

---

## 1. Service Identity (MANDATORY)

Ask the developer:

1. **"What should the service be named?"**
   - Must be PascalCase (e.g., "AddressBook", "Queue", "EntryPoint")

2. **"What problem does this service solve? What data does it manage?"**
   - Need a one-sentence purpose description.

3. **"Where should this service live?"**
   - **Folder-based service**: `src/services/ServiceName/` — complex service with its own folder, `index.ts`, `types.ts`, and optionally `constants.ts` (e.g., `agent/`, `config/`, `task/`)
   - **Single-file service**: `src/services/ServiceName.ts` — lightweight service as a single file; types go in `src/types.ts`, constants go in `src/services/constants.ts` (e.g., `AddressBook.ts`, `EntryPoint.ts`, `Queue.ts`)
   - **Sub-module under existing service**: a file within an existing service folder (e.g., `task/Voice.ts`, `task/Digital.ts`)

   This determines the file structure and where types/constants are placed.

---

## 2. API Contract (MANDATORY)

Ask the developer to provide the complete API signature for **each** API the service will use:

4. **"What API endpoint(s) will this service call? For each, provide:"**

   | Field | What to Ask |
   |---|---|
   | API Name | "What should the method be called?" (e.g., `getEntries`, `createItem`) |
   | HTTP Method | "Is this a GET, POST, PUT, or DELETE?" |
   | Endpoint | "What is the full endpoint path?" (e.g., `/v1/address-books/{id}/entries`) |
   | Request Payload | "What fields does the request body contain? Which are required vs optional?" |
   | Response Structure | "What does the response look like? What fields does `data` contain?" |
   | Error Shape | "What error reason codes can this return?" |

   **If any API field is unknown, STOP and ask the developer before proceeding. Do not guess endpoint structures or payload shapes.**

---

## 3. Event Contract (MANDATORY if the service uses events, otherwise skip)

Ask the developer:

5. **"Does this service listen to or emit any events?"**
   - If YES, for each event ask:

   | Field | What to Ask |
   |---|---|
   | Event Name | "What is the event name?" |
   | Direction | "Is this incoming (received from WebSocket) or outgoing (emitted by SDK)?" |
   | Source | "Is this a WebSocket event, or an internal EventEmitter event?" |
   | Listen/Emit Object | "Where do consumers subscribe to this event?" (`cc`, `task`, `taskManager`, service) |
   | Payload Type/Shape | "What data does the event carry? What are the field names and types?" |
   | Emitted From | "Which class/file/method emits this event?" |
   | Emission Trigger | "What causes this event to fire?" |

   - If any events come from WebSocket: "How should these WebSocket events map to service behavior?"
   - If NO events at all, skip to section 4.

---

## 4. Dependencies & Exposure (MANDATORY)

Ask the developer:

6. **"Does this service need any data from the agent profile?"**
   - If YES: "Which specific fields?" (e.g., `addressBookId`, `teamIds`)
   - If NO: note "No profile dependency"

7. **"Should this service be accessible as `cc.serviceName` (public API), or is it internal only?"**
   - If public: it will be exposed on the `cc` object and types will be re-exported from `src/types.ts`
   - If internal: it will only be used by other services within the SDK

8. **"What methods should be exposed? For each method, what is the expected behavior?"**
   - e.g., `getEntries(params)` — Fetch paginated list
   - e.g., `getEntryById(id)` — Fetch single item

---

## 6. Caching (OPTIONAL)

Ask the developer:

9. **"Should responses be cached in memory, or should every call fetch fresh data?"**
   - If caching: "What is the cache invalidation strategy?"

---

## Completion Gate

**Before proceeding, verify:**

- [ ] Service name provided by developer
- [ ] Service purpose described by developer
- [ ] Service placement decided (top-level, sub-module, or single file)
- [ ] At least one API endpoint fully specified (method, path, request, response, errors)
- [ ] Event contract captured (or developer confirmed no events)
- [ ] Dependencies identified (or developer confirmed none)
- [ ] Exposure decision made (public vs internal)
- [ ] Methods to expose listed

**If any MANDATORY field above is missing an explicit developer answer, ask a targeted follow-up question. Do not proceed.**

---

## Spec Summary

Once all questions are answered, present this summary to the developer for approval before proceeding to code generation:

```
## Spec Summary — New Service

**Service Name**: [from Q1]
**Purpose**: [from Q2]
**Placement**: [from Q3 — folder-based / single-file / sub-module under {parent}]
**Target location**: [derived from Q3, e.g., `src/services/ServiceName/` or `src/services/ServiceName.ts` or `src/services/{parent}/ServiceName.ts`]

### API Contract:
| Method | HTTP | Endpoint | Request | Response |
|---|---|---|---|---|
| [method] | [GET/POST/...] | [path] | [payload] | [response] |

### Events:
[event table or "None"]

### Dependencies:
- Profile fields: [list or "None"]

### Exposure:
- Public API: [Yes/No] — `cc.[serviceName]`
- Methods: [list]

### Caching: [Yes/No]

---
Does this match your intent? (Yes / No / Adjust)
```

**Wait for developer approval. Do not proceed to [`02-code-generation.md`](02-code-generation.md) until confirmed.**

---

## Next Step

Once the developer approves the spec summary, proceed to:
[`02-code-generation.md`](02-code-generation.md)
