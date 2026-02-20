# Core Service - AI Agent Guide

> **Purpose**: Core infrastructure components including WebSocket management, HTTP requests, error handling, and utilities.

---

## Overview

The Core service provides foundational infrastructure:
- **WebSocketManager**: Manages WebSocket connections
- **ConnectionService**: Handles connection lifecycle
- **WebexRequest**: HTTP request wrapper
- **AqmReqs**: AQM request/response pattern
- **Utils**: Error handling and helper functions
- **Err**: Error class definitions

---

## Key Components

| Component | Purpose |
|-----------|---------|
| `WebSocketManager` | WebSocket connection, message handling |
| `ConnectionService` | Reconnection, keepalive |
| `WebexRequest` | HTTP API requests |
| `AqmReqs` | Request-response over WebSocket |
| `Utils` | `getErrorDetails`, `generateTaskErrorObject` |
| `Err` | Error class factories |
| `GlobalTypes` | `Failure`, `Msg<T>`, `AugmentedError` |

---

## WebSocketManager

### Usage (Internal)

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

---

## WebexRequest

### Usage (Internal)

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

AQM (Agent Queue Manager) pattern for request/response:

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

### Failure

```typescript
export type Failure = {
  type: string;
  orgId?: string;
  trackingId?: string;
  data?: {
    agentId?: string;
    reason?: string;
    reasonCode?: string | number;
  };
};

// Usage in catch
const failure = error.details as Failure;
console.log(failure.data?.reason);
```

### Msg<T>

Message wrapper for typed responses:

```typescript
export type Msg<T> = T & {
  trackingId: string;
};

// Usage
export type LoginSuccess = Msg<{
  agentId: string;
  status: string;
  // ...
}>;
```

### AugmentedError

Error with additional data:

```typescript
export type AugmentedError = Error & {
  data?: {
    message?: string;
    errorType?: string;
    errorData?: string;
    reasonCode?: number;
    trackingId?: string;
  };
};
```

---

## Connection Lifecycle

### Connection Flow

```
1. initWebSocket() called
2. ConnectionService listeners attached (`message`, `socketClose`) during construction
3. WebSocket connects to backend
4. Keepalive worker started on `onopen`
5. Welcome event received
6. Runtime messages/keepalive processed via existing listeners
```

### Reconnection Flow

```
1. Connection lost detected
2. ConnectionService emits 'connectionLost'
3. cc.handleConnectionLost() called
4. silentRelogin() attempted
5. On success: state restored
6. On AGENT_NOT_FOUND: handle silently
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

```typescript
// HTTP Methods
export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
} as const;

// API Gateway
export const WCC_API_GATEWAY = 'wcc-api-gateway';
```

---

## Best Practices

### Always Use Error Utilities

```typescript
// ✅ Correct
const {error: detailedError} = getErrorDetails(error, method, module);
throw detailedError;

// ❌ Wrong - loses context
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

- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical deep-dive
- [WebSocketManager.ts](../websocket/WebSocketManager.ts)
- [WebexRequest.ts](../WebexRequest.ts)
- [Utils.ts](../Utils.ts)
- [GlobalTypes.ts](../GlobalTypes.ts)
