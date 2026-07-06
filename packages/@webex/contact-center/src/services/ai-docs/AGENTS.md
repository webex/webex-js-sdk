# Services Layer - AI Agent Guide

> **Scope Authority**: This is the authoritative documentation for the **Services** orchestration layer. It describes how all service modules are composed, instantiated, and how they interact. For task routing, critical rules, and code generation workflows, see the [root orchestrator AGENTS.md](../../../AGENTS.md).

---

## Purpose

The `src/services/` directory is the service layer of the `@webex/contact-center` SDK. It sits between the public plugin class (`cc.ts`) and the backend APIs/WebSocket. Every backend interaction — HTTP requests, WebSocket messages, agent operations, task lifecycle, configuration fetching — flows through this layer.

### Scenarios this document resolves

- Understanding service composition and which service owns which responsibility
- Determining the correct instantiation/bootstrap order for services
- Tracing request flow from `cc.ts` through services to the backend
- Choosing between AqmReqs and direct REST patterns for a new method
- Adding a new data service (AddressBook/Queue/EntryPoint pattern)
- Adding a new AqmReqs method to agent, task, or dialer factories
- Routing to the correct service-level docs for task/agent/config/core changes
- Clarifying what the Services singleton creates vs what `cc.ts` creates

---

## When to Load This Document

Load this services-layer guide when:
- Understanding **how services are composed** or **instantiation order**
- Adding a **new data service** (follow AddressBook/Queue/EntryPoint pattern)
- Adding a **new AqmReqs method** (follow agent/contact factory pattern)
- Debugging **cross-service interactions** or **bootstrap failures**
- Understanding the **request/response flow** (AqmReqs vs direct REST)

For implementation details within a specific service, follow the links in the [Service Routing table](#service-routing-scope-level-ai-docs).

---

## File Structure

```
src/services/
├── index.ts                    # Services singleton — composes all services
├── constants.ts                # Shared constants (gateway id, API paths, WebRTC domains/prefixes, timeout, method-name constants)
├── ai-docs/
│   └── AGENTS.md               # THIS FILE — services layer orchestrator
│
├── agent/                      # Agent operations service
│   ├── index.ts                # routingAgent factory — stationLogin, stateChange, logout, buddyAgents
│   ├── types.ts                # Agent types: StateChange, Logout, AGENT_EVENTS, LoginOption
│   └── ai-docs/                # Agent-specific documentation
│       ├── AGENTS.md
│       └── ARCHITECTURE.md
│
├── task/                       # Task management service
│   ├── TaskManager.ts          # Task lifecycle manager — creates/destroys Task instances
│   ├── Task.ts                 # Individual task — hold, transfer, conference, wrapup
│   ├── TaskFactory.ts          # Creates Task with config flags
│   ├── contact.ts              # routingContact factory — task operations via AqmReqs
│   ├── dialer.ts               # aqmDialer factory — outbound dialing
│   ├── AutoWrapup.ts           # Auto wrapup timer handler
│   ├── TaskUtils.ts            # Task utility functions
│   ├── taskDataNormalizer.ts   # Normalizes task data from events
│   ├── types.ts                # Task types: ITask, TASK_EVENTS, TaskResponse
│   ├── constants.ts            # Task constants
│   ├── voice/                  # Voice-specific task handling
│   │   ├── Voice.ts            # Voice task operations
│   │   └── WebRTC.ts           # WebRTC-specific voice operations
│   ├── digital/                # Digital channel task handling
│   │   └── Digital.ts          # Digital task operations
│   ├── state-machine/          # XState-based task state machine
│   │   ├── TaskStateMachine.ts # State machine definition
│   │   ├── index.ts            # Barrel export for state machine public API
│   │   ├── constants.ts        # TaskState, TaskEvent enums
│   │   ├── types.ts            # TaskContext type
│   │   ├── guards.ts           # State transition guards
│   │   ├── actions.ts          # State transition actions
│   │   ├── uiControlsComputer.ts # Computes UI controls from state
│   │   └── ai-docs/            # State machine documentation
│   │       ├── AGENTS.md
│   │       └── ARCHITECTURE.md
│   └── ai-docs/                # Task-specific documentation
│       ├── AGENTS.md
│       └── ARCHITECTURE.md
│
├── config/                     # Configuration service
│   ├── index.ts                # AgentConfigService — getAgentConfig(), profile aggregation
│   ├── Util.ts                 # parseAgentConfigs, getFilterAuxCodes, helper functions
│   ├── types.ts                # CC_EVENTS, Profile, CC_AGENT_EVENTS, CC_TASK_EVENTS
│   ├── constants.ts            # endPointMap (API URL builders), pagination defaults
│   └── ai-docs/                # Config-specific documentation
│       ├── AGENTS.md
│       └── ARCHITECTURE.md
│
├── core/                       # Core infrastructure
│   ├── WebexRequest.ts         # HTTP client singleton — request(), uploadLogs()
│   ├── aqm-reqs.ts             # AqmReqs — HTTP request + WebSocket notification correlation
│   ├── Utils.ts                # getErrorDetails, generateTaskErrorObject, isValidDialNumber
│   ├── Err.ts                  # Err.Details error class with structured metadata
│   ├── GlobalTypes.ts          # Msg<T>, Failure, AugmentedError, TaskError
│   ├── types.ts                # Req, Conf, Res types for AqmReqs
│   ├── constants.ts            # Core constants
│   ├── websocket/
│   │   ├── WebSocketManager.ts # WebSocket connection handler
│   │   ├── connection-service.ts # Connection lifecycle, reconnection, keepalive
│   │   └── types.ts            # WebSocket types
│   └── ai-docs/                # Core-specific documentation
│       ├── AGENTS.md
│       └── ARCHITECTURE.md
│
├── AddressBook.ts              # Address book entries — getEntries() with pagination/cache
├── EntryPoint.ts               # Entry points — getEntryPoints() with pagination/cache
├── Queue.ts                    # Queues — getQueues() with pagination/cache
└── WebCallingService.ts        # WebRTC calling — register/deregister line, answer/mute/decline
```

Note: The `src/utils/` folder (sibling to `src/services/`) contains shared utilities like [`PageCache.ts`](../../utils/PageCache.ts) which provides generic pagination caching with `BaseSearchParams`, `PaginatedResponse`, and `PaginationMeta` types used by all data services.

### Shared Constants (`src/services/constants.ts`)

Use [`constants.ts`](../constants.ts) as the canonical source for service-level naming and routing constants:
- `WCC_API_GATEWAY` — service identifier used by `WebexRequest` calls
- `SUBSCRIBE_API`, `LOGIN_API`, `STATE_CHANGE_API` — common API path constants
- `WEB_RTC_PREFIX` — path prefix for WebRTC-related endpoints
- `WEBSOCKET_EVENT_TIMEOUT` — default notification correlation timeout (`20000` ms)
- `DEFAULT_RTMS_DOMAIN`, `WCC_CALLING_RTMS_DOMAIN` — RTMS/WebRTC domain constants
- `METHODS` — method name constants used by `WebCallingService`

---

## Key Capabilities

| Capability | Owner | Description |
|---|---|---|
| **Service Singleton** | [`index.ts`](../index.ts) | Central `Services` class that instantiates and provides access to all service modules via `Services.getInstance()` |
| **Agent Operations** | [`agent/`](../agent/index.ts) | Station login/logout, state changes, buddy agents — uses AqmReqs factory pattern |
| **Task Management** | [`task/`](../task/TaskManager.ts) | Task lifecycle (accept, hold, transfer, conference, wrapup), Task state machine, contact operations, outbound dialing |
| **Configuration** | [`config/`](../config/index.ts) | Agent profile aggregation from 8+ API endpoints, org settings, teams, aux codes, dial plans |
| **Core Infrastructure** | [`core/`](../core/WebexRequest.ts) | HTTP requests (`WebexRequest`), WebSocket management (`WebSocketManager`), connection lifecycle (`ConnectionService`), AQM request/response correlation (`AqmReqs`), error handling (`Utils`, `Err`) |
| **Data Services** | [`AddressBook.ts`](../AddressBook.ts), [`Queue.ts`](../Queue.ts), [`EntryPoint.ts`](../EntryPoint.ts) | Standalone REST-based data services with pagination and caching for address books, queues, and entry points |
| **Utilities** | [`src/utils/PageCache.ts`](../../utils/PageCache.ts) | Shared `PageCache<T>` generic class for pagination caching, plus `BaseSearchParams`, `PaginatedResponse`, and `PaginationMeta` types used by all data services |
| **WebRTC Calling** | [`WebCallingService.ts`](../WebCallingService.ts) | Browser-based voice calling via `@webex/calling`, line registration, call answer/mute/decline |

---

## Service Routing (Scope-Level ai-docs)

Each service folder contains its own `ai-docs/` with detailed documentation. **Always load the relevant service docs before making changes.**

| Service | Scope / Keywords | AGENTS.md | ARCHITECTURE.md |
|---------|-----------------|-----------|-----------------|
| **Agent** | login, logout, state change, buddy agents, station, RONA | [`agent/ai-docs/AGENTS.md`](../agent/ai-docs/AGENTS.md) | [`agent/ai-docs/ARCHITECTURE.md`](../agent/ai-docs/ARCHITECTURE.md) |
| **Task** | task, hold, transfer, conference, wrapup, outdial, consult, accept, decline, state machine, XState, task states, guards, actions | [`task/ai-docs/AGENTS.md`](../task/ai-docs/AGENTS.md) | [`task/ai-docs/ARCHITECTURE.md`](../task/ai-docs/ARCHITECTURE.md) |
| **Config** | profile, register, teams, aux codes, desktop profile, org settings, dial plan | [`config/ai-docs/AGENTS.md`](../config/ai-docs/AGENTS.md) | [`config/ai-docs/ARCHITECTURE.md`](../config/ai-docs/ARCHITECTURE.md) |
| **Core** | websocket, HTTP, connection, reconnect, aqm, utils, errors, keepalive | [`core/ai-docs/AGENTS.md`](../core/ai-docs/AGENTS.md) | [`core/ai-docs/ARCHITECTURE.md`](../core/ai-docs/ARCHITECTURE.md) |

> **Note**: The task state machine (`task/state-machine/`) is part of the Task service, not a separate service. Its dedicated docs live at [`task/state-machine/ai-docs/AGENTS.md`](../task/state-machine/ai-docs/AGENTS.md) and [`ARCHITECTURE.md`](../task/state-machine/ai-docs/ARCHITECTURE.md). Load these when working on state transitions, guards, or actions.

**Data services** (AddressBook, Queue, EntryPoint) do not have dedicated ai-docs. Read their source files directly — they follow shared REST/pagination/caching patterns documented in [`ai-docs/patterns/typescript-patterns.md`](../../../ai-docs/patterns/typescript-patterns.md).

**WebCallingService** also has no dedicated ai-docs, but it follows a different pattern: EventEmitter-based call lifecycle orchestration around `@webex/calling` (`createClient`, line registration/deregistration, `ICall` events), `callTaskMap` tracking, and async registration flows with timeout handling. Read [`WebCallingService.ts`](../WebCallingService.ts) directly when changing browser calling behavior.

---

## Architecture Overview

### How cc.ts Uses the Services Layer

The `ContactCenter` plugin class (`cc.ts`) is the **only public entry point**. It delegates all backend work to the services layer:

```
ContactCenter (cc.ts) — public API surface
│
├── WebexRequest.getInstance({webex})     ← initialized FIRST (singleton)
├── Services.getInstance({webex, connectionConfig}) ← initialized SECOND (singleton)
│   │
│   ├── WebSocketManager                  ← real-time message transport
│   ├── AqmReqs                           ← HTTP request + WebSocket notification correlation
│   ├── ConnectionService                 ← WebSocket lifecycle, reconnection, keepalive
│   ├── AgentConfigService (config)       ← profile aggregation via REST APIs
│   ├── routingAgent (agent)              ← agent operations via AqmReqs factory
│   ├── routingContact (contact)          ← task/contact operations via AqmReqs factory
│   └── aqmDialer (dialer)               ← outbound dialing via AqmReqs factory
│
├── TaskManager                           ← task lifecycle, created during register()
├── WebCallingService                     ← WebRTC calling, created during register() (line registration is conditional)
├── AddressBook                           ← REST data service, created during register()
├── EntryPoint                            ← REST data service, created during register()
├── Queue                                 ← REST data service, created during register()
└── MetricsManager.getInstance({webex})   ← telemetry singleton
```

### Bootstrap Order (Critical)

Understanding the instantiation order is essential — getting it wrong causes runtime errors:

1. **`WebexRequest.getInstance({webex})`** — Must be called first. The singleton HTTP client that all services depend on.
2. **`Services.getInstance({webex, connectionConfig})`** — Creates `WebSocketManager`, `AqmReqs`, `ConnectionService`, `AgentConfigService`, `routingAgent`, `routingContact`, `aqmDialer`.
3. **`WebCallingService`** — Created during `register()` for calling lifecycle management. `registerWebCallingLine()` is later invoked conditionally for `loginOption === 'BROWSER'`.
4. **`MetricsManager.getInstance({webex})`** — Telemetry singleton.
5. **`TaskManager`** — Created during `register()` and wired to services/WebSocket.
6. **Data services** (`AddressBook`, `EntryPoint`, `Queue`) — Created during `register()`.

### Request/Response Flow Pattern

There are two distinct patterns used across services:

#### Pattern 1: AqmReqs (Agent + Task operations)

Used by `routingAgent`, `routingContact`, and `aqmDialer`. This pattern sends an HTTP REST request to the backend and waits for a correlated WebSocket notification:

```
cc.ts method call
  → services.agent.methodName({data})     (or services.contact / services.dialer)
    → AqmReqs.req() sends HTTP request    (via WebexRequest.request())
      → Backend REST API processes
      → Backend sends WebSocket notification (success or failure)
    → AqmReqs correlates notification to pending request
  → Promise resolves/rejects
```

Key detail: **The HTTP request goes directly to the backend. The WebSocket only carries the notification back.** This is NOT request-over-WebSocket.

#### Pattern 2: Direct REST (Config + Data services)

Used by `AgentConfigService`, `AddressBook`, `Queue`, `EntryPoint`. These make direct HTTP calls and return the response:

```
cc.ts method call
  → service.method()
    → WebexRequest.request({service, resource, method})
      → Backend REST API
    → Response returned directly
  → Promise resolves/rejects
```

---

## Services Singleton (index.ts)

The `Services` class is the central composition root. It uses a singleton pattern:

```typescript
const services = Services.getInstance({
  webex: this.$webex,
  connectionConfig: subscribeRequest,
});
```

### What Services creates in its constructor

| Component | How Created | Purpose |
|---|---|---|
| `webSocketManager` | `new WebSocketManager({webex})` | WebSocket transport for real-time messages |
| `aqmReq` (internal) | `new AqmReqs(webSocketManager)` | Correlates HTTP requests with WebSocket notifications |
| `config` | `new AgentConfigService()` | REST-based profile aggregation |
| `agent` | `routingAgent(aqmReq)` | Agent operations factory |
| `contact` | `routingContact(aqmReq)` | Task/contact operations factory |
| `dialer` | `aqmDialer(aqmReq)` | Outbound dialing factory |
| `connectionService` | `new ConnectionService({webSocketManager, subscribeRequest})` | WebSocket lifecycle management |

### What Services does NOT create

- `WebexRequest` — initialized by `cc.ts` before `Services.getInstance()`
- `TaskManager` — created by `cc.ts` during `register()`
- `WebCallingService` — created by `cc.ts` during `register()` (line registration is conditional on `loginOption === 'BROWSER'`)
- `AddressBook`, `EntryPoint`, `Queue` — created by `cc.ts` during `register()`
- `MetricsManager` — independent singleton initialized by `cc.ts`

---

## Data Services Pattern (AddressBook, Queue, EntryPoint)

These three services share an identical pattern. Use any one as a reference when creating similar services:

| Aspect | Pattern |
|---|---|
| **Class structure** | Standalone class with `WebexRequest`, `WebexSDK`, `MetricsManager`, `PageCache` |
| **Constructor** | `constructor(webex: WebexSDK)` — gets singletons via `.getInstance()` |
| **HTTP calls** | `this.webexRequest.request({service: WCC_API_GATEWAY, resource, method: HTTP_METHODS.GET})` |
| **Endpoints** | Uses `endPointMap` functions from `config/constants.ts` to build URL paths |
| **Pagination** | Query params with `page`, `pageSize`; uses `PageCache` for caching |
| **Caching** | `PageCache<T>` — caches pages for simple pagination, bypasses cache for search/filter |
| **Metrics** | `timeEvent` on API call start, `trackEvent` on success/failure |
| **Logging** | `LoggerProxy` with `{module: 'ClassName', method: 'methodName'}` context |
| **Error handling** | try/catch with `LoggerProxy.error` + `metricsManager.trackEvent` for failures, then re-throw so callers receive the error |

Reference files:
- [`AddressBook.ts`](../AddressBook.ts) — includes `addressBookId` parameter
- [`Queue.ts`](../Queue.ts) — includes additional query params (sortBy, sortOrder, etc.)
- [`EntryPoint.ts`](../EntryPoint.ts) — simplest example

---

## AqmReqs Factory Pattern (Agent + Task operations)

Agent and task operations use a factory pattern where each method is defined as a `routing.req()` call:

```typescript
export default function routingAgent(routing: AqmReqs) {
  return {
    stationLogin: routing.req((p: {data: LoginPayload}) => ({
      url: '/v1/agents/login',
      host: WCC_API_GATEWAY,
      data: p.data,
      err: createErrDetailsObject,
      notifSuccess: { bind: {...}, msg: {} as SuccessType },
      notifFail: { bind: {...}, errId: 'Service.aqm.agent.stationLogin' },
    })),
  };
}
```

Key points:
- `url` + `host` define the HTTP endpoint
- `data` is the request body (POST by default, GET if no data)
- `notifSuccess.bind` specifies which WebSocket event type indicates success
- `notifFail.bind` specifies which WebSocket event type indicates failure
- `errId` maps to an `Err.Details` error identifier
- The returned function is a `Promise` that resolves when the correlated WebSocket notification arrives

Reference files:
- [`agent/index.ts`](../agent/index.ts) — agent operations
- [`task/contact.ts`](../task/contact.ts) — task operations
- [`task/dialer.ts`](../task/dialer.ts) — outbound dialing

---

## Cross-Service Dependencies

```
cc.ts
 ├─ uses → Services.agent       (stationLogin, stateChange, logout, buddyAgents)
 ├─ uses → Services.config      (getAgentConfig)
 ├─ uses → Services.contact     (task operations, forwarded through TaskManager/Task)
 ├─ uses → Services.dialer      (startOutdial)
 ├─ uses → Services.webSocketManager  (message listener for event routing)
 ├─ uses → Services.connectionService (connection lifecycle events)
 ├─ uses → WebexRequest         (uploadLogs)
 ├─ uses → TaskManager          (task lifecycle, created during register())
 ├─ uses → WebCallingService    (WebRTC, created during register(); line registration is conditional on BROWSER login)
 ├─ uses → AddressBook          (address book queries)
 ├─ uses → EntryPoint           (entry point queries)
 └─ uses → Queue                (queue queries)

TaskManager
 ├─ uses → Services.contact     (task operations via AqmReqs)
 ├─ uses → Services.dialer      (outbound dialing)
 ├─ uses → Services.config      (config flags)
 └─ creates → Task instances    (each with its own state machine)

AgentConfigService (config)
 └─ uses → WebexRequest         (direct REST calls for profile data)

AqmReqs
 ├─ uses → WebexRequest         (sends HTTP requests)
 └─ uses → WebSocketManager     (listens for correlated notifications)
```

---

## Event Flow Through Services

WebSocket messages are fanned out to multiple independent listeners on `WebSocketManager`:

```
CC Backend
  → WebSocket message arrives at WebSocketManager
    → WebSocketManager emits 'message'
      → AqmReqs listener (`aqm-reqs.ts`) — correlates pending request notifications
      → cc.ts listener (`cc.ts`) — handles plugin-level events:
        → Agent events use `this.emit(...)` (EventEmitter API)
        → Task notifications use `this.trigger(...)` (WebexPlugin API)
      → TaskManager listener (`TaskManager.ts`) — processes task events for task lifecycle/state
      → ConnectionService listener (`connection-service.ts`) — processes connection/keepalive events
```

---

## Related

- [Root orchestrator AGENTS.md](../../../AGENTS.md) — task classification, critical rules, templates
- [ai-docs/RULES.md](../../../ai-docs/RULES.md) — coding standards
- [ai-docs/patterns/](../../../ai-docs/patterns/) — TypeScript, testing, and event patterns
- [types.ts](../../types.ts) — public type definitions
- [cc.ts](../../cc.ts) — main plugin class (public API surface)
