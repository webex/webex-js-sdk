# Core Service - AI Agent Guide

> **This is the authoritative documentation for the Core service scope.** Core infrastructure components including WebSocket management, HTTP requests, error handling, and utilities. For task routing, critical rules, and cross-service patterns, see the [root orchestrator AGENTS.md](../../../AGENTS.md).

---

## Key Capabilities

The Core service provides the foundational infrastructure layer that all other services depend on:

- **WebSocket Communication**: Real-time bidirectional messaging with the contact center backend, including automatic reconnection and keepalive management
- **HTTP Request Handling**: Authenticated REST API calls to WCC API Gateway with built-in error handling and log upload support
- **AQM Request/Response Pattern**: A structured pattern used by the routing and contact layers to send HTTP requests to the contact center backend and correlate responses/failures via WebSocket notifications
- **Error Handling & Logging**: Standardized error extraction, logging via `LoggerProxy`, and log upload utilities that all services use for consistent error reporting
- **Type System**: Shared types (`Msg<T>`, `Failure`, `AugmentedError`, `TaskError`) that define the message and error contracts used across the SDK

| Component | File | Description |
|-----------|------|-------------|
| `WebSocketManager` | [`WebSocketManager.ts`](../websocket/WebSocketManager.ts) | Manages the WebSocket connection lifecycle including initialization, message dispatch, and graceful shutdown. Emits `message` events for incoming data and `socketClose` when the connection drops while reconnect is allowed. |
| `ConnectionService` | [`connection-service.ts`](../websocket/connection-service.ts) | Orchestrates reconnection logic and keepalive heartbeats on top of `WebSocketManager`. Detects connection loss and triggers `silentRelogin()` to restore agent state transparently. |
| `WebexRequest` | [`WebexRequest.ts`](../WebexRequest.ts) | Singleton HTTP client that wraps authenticated requests to the WCC API Gateway. Handles service routing, response parsing, and provides a `uploadLogs` method for diagnostics. |
| `AqmReqs` | [`aqm-reqs.ts`](../aqm-reqs.ts) | Factory for creating request methods that send HTTP requests and wait for correlated WebSocket notifications (success or failure). Used by routing and task services to implement their API methods. |
| `Utils` | [`Utils.ts`](../Utils.ts) | Shared utility functions including `getErrorDetails()` for standardized error handling, `generateTaskErrorObject()` for task-specific errors, and `createErrDetailsObject()` for constructing error detail objects. |
| `Err` | [`Err.ts`](../Err.ts) | Error class definitions. `Err.Details` carries structured error metadata (status, type, trackingId) for consistent error propagation. |
| `GlobalTypes` | [`GlobalTypes.ts`](../GlobalTypes.ts) | Shared type definitions: `Msg<T>` (message wrapper), `Failure` (failure message), `TaskError` (task API errors), and `AugmentedError` (error with data). |
| `constants` | [`constants.ts`](../constants.ts) | Timeout values, interval durations, participant types, interaction states, and method name constants used throughout the core layer. Any new constants for core should be defined here. |

---

## File Structure

```
services/core/
├── aqm-reqs.ts           # AQM request handler
├── constants.ts          # Core constants
├── Err.ts                # Error classes
├── GlobalTypes.ts        # Failure, Msg<T>, etc.
├── types.ts              # Request/response types
├── Utils.ts              # Utility functions
├── WebexRequest.ts       # HTTP client
└── websocket/
    ├── WebSocketManager.ts    # Main WS handler
    ├── connection-service.ts  # Connection lifecycle
    ├── keepalive.worker.js    # Keepalive worker
    └── types.ts               # WS types
```

---


## WebSocketManager

`WebSocketManager` handles the raw WebSocket connection to the contact center backend. It is instantiated by the `Services` layer and used internally — other services interact with it through `ConnectionService`.

### Reference Usage

```typescript
// Initialize in Services
this.webSocketManager = new WebSocketManager({webex});

// Connect
const welcomeEvent = await webSocketManager.initWebSocket({
  body: connectionConfig,
});

// Listen for messages
webSocketManager.on('message', (event) => {
  const data = JSON.parse(event);
  // Handle event
});

// Close
webSocketManager.close(false, 'Reason');
```

### Events

| Event | Data | Description |
|-------|------|-------------|
| `message` | string (JSON) | WebSocket message received |
| `socketClose` | - | Socket closed while reconnect is allowed |

### Connection Lifecycle

`WebSocketManager` and `ConnectionService` work together to manage the full connection lifecycle. `WebSocketManager` owns the raw socket while `ConnectionService` adds reconnection intelligence and keepalive on top.

**Connection Flow:**

```
1. initWebSocket() called
2. ConnectionService listeners attached (`message`, `socketClose`) during construction
3. WebSocket connects to backend
4. Keepalive worker started on `onopen`
5. Welcome event received
6. Runtime messages/keepalive processed via existing listeners
```

**Reconnection Flow:**

```
1. Connection lost detected
2. ConnectionService emits 'connectionLost'
3. cc.handleConnectionLost() called
4. silentRelogin() attempted
5. On success: state restored
6. On AGENT_NOT_FOUND: handle silently
```

---

## WebexRequest

`WebexRequest` is a singleton HTTP client that all services use to make authenticated REST API calls to the contact center backend. It handles service URL resolution, request formatting, and response parsing.

### Reference Usage

```typescript
// Get singleton
const webexReq = WebexRequest.getInstance({webex});

// Make request
const response = await webexReq.request({
  service: WCC_API_GATEWAY,
  resource: '/v1/endpoint',
  method: HTTP_METHODS.GET,
});

// Upload logs
await webexReq.uploadLogs({
  correlationId: trackingId,
});
```

### Response Structure

```typescript
{
  statusCode: 200,
  body: { /* response data */ },
  headers: {
    trackingid: 'uuid',
  },
}
```

---

## AqmReqs

The AQM (Agent Queue Manager) layer provides a request/response pattern over HTTP + WebSocket. Services like **routing** and **contact** use `AqmReqs` to define API methods that:

1. Send an HTTP request to the contact center backend via `WebexRequest`
2. Wait for a correlated WebSocket notification indicating success or failure
3. Return the typed result or throw a structured error

This decouples the request initiation (HTTP) from the asynchronous result delivery (WebSocket), which matches the contact center backend's event-driven architecture.

### Reference Usage

```typescript
// Define request configuration
const serviceMethod = routing.req((p: {data: ParamType}) => ({
  url: '/v1/endpoint',
  host: WCC_API_GATEWAY,
  data: p.data,
  method: HTTP_METHODS.POST,
  err: errorHandler,
  notifSuccess: {
    bind: {type: CC_EVENTS.SUCCESS, data: {type: CC_EVENTS.SUCCESS}},
    msg: {} as SuccessType,
  },
  notifFail: {
    bind: {type: CC_EVENTS.FAIL, data: {type: CC_EVENTS.FAIL}},
    errId: 'Service.aqm.operation',
  },
}));

// Call method
const result = await serviceMethod({data: params});
```

---

## Error Handling Utilities

### `getErrorDetails()`

Standard error handler for SDK operations:

```typescript
import {getErrorDetails} from './services/core/Utils';

try {
  await operation();
} catch (error) {
  const {error: detailedError, reason} = getErrorDetails(
    error,
    'methodName',  // Method name for logging
    'ModuleName'   // Module name for logging
  );

  // getErrorDetails automatically:
  // 1. Logs the error
  // 2. Uploads logs (unless AGENT_NOT_FOUND in silentRelogin)
  // 3. Extracts reason from error.details
  // 4. Creates Error with reason as message

  throw detailedError;
}
```

### `generateTaskErrorObject()`

Error handler for task operations:

```typescript
import {generateTaskErrorObject} from './services/core/Utils';

try {
  await taskOperation();
} catch (error) {
  const taskError = generateTaskErrorObject(
    error,
    'transfer',
    'TaskModule'
  );
  throw taskError;
}
```

---

## Type Definitions

### Msg\<T\>

Generic message wrapper used throughout the SDK. All WebSocket messages and AQM responses conform to this shape:

```typescript
export type Msg<T = any> = {
  type: string;       // Message/Event type identifier
  orgId: string;      // Organization identifier
  trackingId: string; // Unique tracking identifier
  data: T;            // Message/Event payload data
};

// Usage — the payload type goes into `data`
export type LoginSuccess = Msg<{
  agentId: string;
  status: string;
  // ...
}>;
// Resulting shape: { type, orgId, trackingId, data: { agentId, status, ... } }
```

### Failure

A specific `Msg<T>` for failure responses. Access error details via `failure.data`:

```typescript
export type Failure = Msg<{
  agentId: string;
  trackingId: string;
  reasonCode: number;
  orgId: string;
  reason: string;
}>;

// Usage in catch
const failure = error.details as Failure;
LoggerProxy.error(`Operation failed: ${failure.data?.reason}`, {
  module: 'MyService',
  method: 'myMethod',
  trackingId: failure?.trackingId,
});
```

### AugmentedError

Error interface with a flexible data field for additional context:

```typescript
export interface AugmentedError extends Error {
  data?: Record<string, any>;
}
```

---

## Error Classes

### Err.Details

```typescript
import * as Err from './Err';

const error = new Err.Details('Service.aqm.agent.login', {
  status: 401,
  type: 'UNAUTHORIZED',
  trackingId: 'uuid',
});
```

### createErrDetailsObject

```typescript
import {createErrDetailsObject} from './Utils';

const errDetails = createErrDetailsObject(webexRequestPayload);
// Returns Err.Details with trackingId and body
```

---

## Constants

All core-level constants (timeouts, intervals, participant types, method names) are defined in [`constants.ts`](../constants.ts). Any new constants for the core layer should be added there.

---

## Best Practices

### Always Use Error Utilities

```typescript
// Correct
const {error: detailedError} = getErrorDetails(error, method, module);
throw detailedError;

// Wrong - loses context
throw error;
```

### Check Response Status

```typescript
const response = await webexReq.request({...});

if (response.statusCode !== 200) {
  throw new Error(`API call failed with ${response.statusCode}`);
}
```

### Extract TrackingId

```typescript
const trackingId = response.headers?.trackingid ||
                   response.headers?.TrackingID;
```

---

## Related

- [Root Orchestrator AGENTS.md](../../../AGENTS.md) - Task routing, critical rules, cross-service patterns
- [WebSocketManager.ts](../websocket/WebSocketManager.ts)
- [WebexRequest.ts](../WebexRequest.ts)
- [Utils.ts](../Utils.ts)
- [GlobalTypes.ts](../GlobalTypes.ts)
