# STOP -- Ask These Questions First

**Do NOT generate any code until every MANDATORY section below is answered.**

Present these questions to the user and collect their answers. If the user cannot answer a question, help them reason through it using the reference implementations listed in `00-master.md`.

---

## 1. Module Identity (MANDATORY)

Ask the user:

> **a) What is the module name?**
> Must be PascalCase (e.g., `CallRecording`, `Presence`, `MeetingControls`).
> The interface will be `IModuleName`, the file constant will be `'ModuleNameFile'`, and the factory function will be `createModuleNameClient`.

> **b) What is the module's purpose?**
> One-sentence description (e.g., "Manages voicemail retrieval, playback, and deletion across calling backends").

> **c) What is the placement type?**
> Choose one:
>
> | Placement | When to Use | Example |
> |-----------|-------------|---------|
> | **Top-level** (`src/ModuleName/`) | Independent module with its own factory function | CallHistory, Voicemail, CallSettings, Contacts |
> | **Sub-module** (`src/CallingClient/moduleName/`) | Tightly coupled to CallingClient lifecycle | Line, Call, Registration, CallerId |
> | **Single-file** (`src/ModuleName.ts` or within existing module) | Very small utility, no subdirectory needed | Rare; most modules get a directory |

---

## 2. API Contract (MANDATORY)

Ask the user to define every backend API endpoint the module will call:

> **For each endpoint, provide:**
>
> | Field | Description | Example |
> |-------|-------------|---------|
> | **HTTP Method** | GET, POST, PUT, PATCH, DELETE | `GET` |
> | **Path** | URL path pattern | `/history/userSessions?from={date}&limit={limit}` |
> | **Service** | Which Webex service (mobius, janus, hydra, identity, etc.) | `janus` |
> | **Request Body** | TypeScript type or shape of request payload | `{ endTimeSessionIds: EndTimeSessionId[] }` |
> | **Success Response** | TypeScript type or shape | `{ statusCode: number; data: { userSessions: UserSession[] }; message: string }` |
> | **Error Responses** | Expected error codes and meanings | `400 Bad Request, 401 Unauthorized, 404 Not Found` |

Example format:

```
Endpoint 1: getRecordings
  Method: GET
  Path: /recordings?from={date}&limit={limit}
  Service: janus
  Request: query params only (date: string, limit: number)
  Response: { statusCode: number; data: { recordings: Recording[] }; message: string }
  Errors:
    400 - invalid date/limit input
    401 - auth token missing/expired
    404 - recordings resource not found for tenant/user
    500 - server-side processing failure
```

---

## 3. Event Contract (MANDATORY if the module emits or listens to events)

If the module does NOT use events, the user may write "None" and skip this section.

> **a) Does the module emit events to consumers?**
> If yes, list each event:
>
> | Event Key | Direction | Payload Type | Description |
> |-----------|-----------|-------------|-------------|
> | `moduleName:event_name` | Outbound (to consumer) | `EventPayloadType` | When is it fired |

> **b) Does the module listen to Mercury WebSocket events?**
> If yes, list each Mercury event key:
>
> | Mercury Event Key | Handler Method | Description |
> |-------------------|---------------|-------------|
> | `event:janus.some_event` | `handleSomeEvent` | What triggers it |

> **c) Does the module listen to internal events from other modules?**
> (e.g., CallingClient events, Line events)

**Reference -- Existing event key enums:**
- `COMMON_EVENT_KEYS` -- Shared events (call history sessions, voicemail content)
- `CALLING_CLIENT_EVENT_KEYS` -- CallingClient-level events (error, outgoing_call, all_calls_cleared)
- `CALL_EVENT_KEYS` -- Per-call events (alerting, connect, disconnect, held, resumed)
- `LINE_EVENT_KEYS` -- Per-line events (incoming_call)
- `MOBIUS_EVENT_KEYS` -- Mercury WebSocket event filters (event:mobius, event:janus.*)

---

## 4. Dependencies (MANDATORY)

> **a) Which SDK features does the module need?**
>
> | Feature | Import Path | Notes |
> |---------|-------------|-------|
> | SDKConnector | `../SDKConnector` | Always needed for webex.request() and Mercury listeners |
> | Logger | `../Logger` | Always needed (`import log from '../Logger'`) |
> | MetricManager | `../Metrics` | Needed if the module submits metrics (`getMetricManager()`) |
> | Eventing | `../Events/impl` | Needed if the module emits events (`extends Eventing<T>`) |
> | Error classes | `../Errors` | Needed if the module throws typed errors |
> | Common utilities | `../common/Utils` | `serviceErrorCodeHandler`, `getCallingBackEnd`, `uploadLogs`, etc. |

> **b) Does the module need multi-backend support?**
> The calling package supports three backends:
>
> | Backend | Enum Value | When Used |
> |---------|-----------|-----------|
> | Webex Calling (WXC) | `CALLING_BACKEND.WXC` | User has WXC entitlement |
> | Broadworks | `CALLING_BACKEND.BWRKS` | User has Broadworks connector entitlement |
> | UCM (Unified CM) | `CALLING_BACKEND.UCM` | User's calling behavior is NATIVE_SIP_CALL_TO_UCM |
>
> If the module behaves identically across backends, answer "No -- single implementation."
> If the module has different API endpoints or logic per backend, answer "Yes" and specify which backends.

---

## 5. Exposure (MANDATORY)

> **a) Should the module be exported from `src/api.ts`?**
> Top-level modules: almost always Yes.
> Sub-modules of CallingClient: usually No (exposed through CallingClient interface instead).

> **b) Which items should be exported?**
>
> | Export Category | Items | Example |
> |----------------|-------|---------|
> | Interface | `IModuleName` | `ICallHistory` |
> | Class | `ModuleName` | `CallHistory` |
> | Factory function | `createModuleNameClient` | `createCallHistoryClient` |
> | Types | Response types, setting types | `JanusResponseEvent`, `VoicemailResponseEvent` |
> | Event types (if applicable) | Event type maps | `CallHistoryEventTypes` |

---

## 6. Caching (OPTIONAL)

> **Does the module need client-side caching?**
> - If yes, describe what data is cached and the invalidation strategy
> - Reference: Voicemail uses `storeVoicemailList` / `fetchVoicemailList` for caching

---

## Completion Gate

All MANDATORY sections must be answered before proceeding. Verify:

- [ ] Module name is PascalCase and unique within `src/`
- [ ] Placement type is chosen (top-level, sub-module, or single-file)
- [ ] At least one API endpoint is defined with method, path, request, response, and error codes
- [ ] Event contract is defined (or explicitly marked "None")
- [ ] Multi-backend decision is made (single or multi with specific backends listed)
- [ ] Exposure model is defined (what gets exported from `src/api.ts`)

---

## Spec Summary Template

Once all questions are answered, compile the specification into this format:

```
MODULE SPECIFICATION
====================
Name:        {ModuleName}
Placement:   {top-level | sub-module of X | single-file}
Purpose:     {one-sentence description}

API CONTRACT
------------
Endpoint 1: {methodName}
  HTTP:     {GET|POST|PUT|DELETE}
  Path:     {url pattern}
  Service:  {mobius|janus|hydra|...}
  Request:  {type shape}
  Response: {type shape}
  Errors:   {status code1} - {reason1}, {status code2} - {reason2}, ..., {status codeN} - {reasonN}

[...repeat for each endpoint]

EVENT CONTRACT
--------------
Outbound Events:  {list or "None"}
Mercury Listeners: {list or "None"}
Internal Listeners: {list or "None"}

DEPENDENCIES
------------
Multi-backend: {Yes (WXC, UCM, BWRKS) | No}
MetricManager: {Yes | No}
Eventing:      {Yes | No}

EXPOSURE
--------
Exported from api.ts: {Yes | No}
Exports: {list of interfaces, classes, types, factory functions}

FILE STRUCTURE
--------------
src/
  {ModuleName}/
    {ModuleName}.ts          # Main service class + factory function
    types.ts                 # Interface, response types, LoggerInterface
    constants.ts             # File constant, METHODS, module constants
    {ModuleName}.test.ts     # Co-located tests
    {moduleName}Fixtures.ts  # Test fixtures
    [WxCallBackendConnector.ts]        # If multi-backend
    [BroadworksBackendConnector.ts]    # If multi-backend
    [UcmBackendConnector.ts]           # If multi-backend
    [WxCallBackendConnector.test.ts]   # If multi-backend
    [BroadworksBackendConnector.test.ts] # If multi-backend
    [UcmBackendConnector.test.ts]      # If multi-backend
```

---

**Next Step:** [02-code-generation.md](./02-code-generation.md) -- Generate the module files based on the completed specification.
