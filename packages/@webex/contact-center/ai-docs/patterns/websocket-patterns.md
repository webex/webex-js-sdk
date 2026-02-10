# WebSocket Patterns - Contact Center SDK

> **Purpose**: WebSocket connection management and real-time communication patterns.

---

## Architecture Overview

```
ContactCenter (cc.ts)
    │
    ├── Services.webSocketManager (WebSocketManager)
    │       ├── initWebSocket()
    │       ├── on('message', handler)
    │       ├── close()
    │       └── keepAliveWorker
    │
    └── Services.connectionService (ConnectionService)
            ├── on('connectionLost', handler)
            └── subscribeRequest configuration
```

---

## WebSocketManager

### Location
`src/services/core/websocket/WebSocketManager.ts`

### Initialization

```typescript
// In cc.ts constructor
this.$webex.once(READY, () => {
  this.services = Services.getInstance({
    webex: this.$webex,
    connectionConfig: this.getConnectionConfig(),
  });
  
  // Subscribe to messages
  this.services.webSocketManager.on('message', this.handleWebsocketMessage);
});
```

### Connection Config

```typescript
private getConnectionConfig(): SubscribeRequest {
  return {
    force: this.$config?.force ?? true,
    isKeepAliveEnabled: this.$config?.isKeepAliveEnabled ?? false,
    clientType: this.$config?.clientType ?? 'WebexCCSDK',
    allowMultiLogin: this.$config?.allowMultiLogin ?? true,
  };
}
```

### Connecting

```typescript
// In register() method
const resp = await this.services.webSocketManager
  .initWebSocket({
    body: this.getConnectionConfig(),
  })
  .then(async (data: WelcomeEvent) => {
    const agentId = data.agentId;
    // Handle welcome event
    return agentId;
  });
```

---

## Message Handling

### WebSocket Message Flow

```
WebSocket Event
    │
    ▼
WebSocketManager.emit('message', eventString)
    │
    ▼
cc.handleWebsocketMessage(eventString)
    │
    ├── Parse JSON
    ├── Skip keepalives
    ├── Log event
    ├── Track metrics
    ├── Route by eventData.type
    └── Route by eventData.data.type
```

### Handler Pattern

```typescript
private handleWebsocketMessage = (event: string) => {
  const eventData = JSON.parse(event);
  
  // 1. Skip keepalive messages
  if (eventData.keepalive) {
    return;
  }
  
  // 2. Re-emit all events with data.type (except keepalives)
  if (eventData.data && eventData.data.type) {
    this.emit(eventData.data.type, eventData.data);
  }
  
  // 3. Guard against missing type
  if (!eventData.type) {
    return;
  }
  
  // 4. Log received event
  LoggerProxy.log(`Received event: ${eventData?.data?.type ?? eventData.type}`, {
    module: CC_FILE,
    method: 'handleWebsocketMessage',
  });
  
  // 5. Track metrics
  if (eventData.type !== CC_EVENTS.WELCOME && eventData.keepalive !== 'true') {
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.WEBSOCKET_EVENT_RECEIVED,
      {
        ws_event_type: eventData?.data?.type || eventData.type,
        top_level_type: eventData.type,
        has_data: Boolean(eventData.data),
      },
      ['operational']
    );
  }
  
  // 6. Route by top-level type
  switch (eventData.type) {
    case CC_EVENTS.AGENT_MULTI_LOGIN:
      this.emit(AGENT_EVENTS.AGENT_MULTI_LOGIN, eventData.data);
      break;
    case CC_EVENTS.AGENT_STATE_CHANGE:
      this.emit(AGENT_EVENTS.AGENT_STATE_CHANGE, eventData.data);
      break;
  }
  
  // 7. Route by nested data.type
  if (eventData.data && eventData.data.type) {
    switch (eventData.data.type) {
      case CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS:
        // Transform and emit
        break;
      // ... more cases
    }
  }
};
```

---

## Connection Service

### Location
`src/services/core/websocket/connection-service.ts`

### Connection Events

```typescript
// Types
export type ConnectionLostDetails = {
  isConnectionLost: boolean;
  isSocketReconnected: boolean;
};
```

### Connection Handler

```typescript
// Setup in cc.ts
private setupEventListeners() {
  this.services.connectionService.on(
    'connectionLost',
    this.handleConnectionLost.bind(this)
  );
}

// Handler
private async handleConnectionLost(msg: ConnectionLostDetails): Promise<void> {
  if (msg.isConnectionLost) {
    LoggerProxy.info('Connection lost', {
      module: CC_FILE,
      method: 'handleConnectionLost',
    });
    // TODO: Emit connection lost event
  } else if (msg.isSocketReconnected) {
    LoggerProxy.info('Connection reconnected', {
      module: CC_FILE,
      method: 'handleConnectionLost',
    });
    
    if (this.$config?.allowAutomatedRelogin) {
      await this.silentRelogin();
    }
  }
}
```

---

## KeepAlive Worker

### Location
`src/services/core/websocket/keepalive.worker.js`

### Purpose
- Maintains WebSocket connection with periodic pings
- Runs in Web Worker to avoid blocking main thread
- Controlled by `isKeepAliveEnabled` config

---

## Closing Connection

### Graceful Close

```typescript
public async deregister(): Promise<void> {
  // Remove listeners first
  this.services.webSocketManager.off('message', this.handleWebsocketMessage);
  this.services.connectionService.off('connectionLost', this.handleConnectionLost);
  
  // Close WebSocket
  if (!this.services.webSocketManager.isSocketClosed) {
    this.services.webSocketManager.close(false, 'Unregistering the SDK');
  }
  
  // Clear state
  this.agentConfig = null;
}
```

---

## Request/Response Pattern (AQM)

### AQM Requests

The SDK uses AQM (Agent Queue Manager) for request/response over WebSocket:

```typescript
// services/core/aqm-reqs.ts
export default class AqmReqs {
  private webSocketManager: WebSocketManager;
  
  constructor(webSocketManager: WebSocketManager) {
    this.webSocketManager = webSocketManager;
  }
  
  // Request with parameters
  req<T, R>(configFn: (params: T) => RequestConfig): (params: T) => Promise<R> {
    return async (params: T) => {
      const config = configFn(params);
      // Send request and wait for response via WebSocket
      return this.sendAndWait(config);
    };
  }
  
  // Request without parameters
  reqEmpty<R>(configFn: () => RequestConfig): () => Promise<R> {
    return async () => {
      const config = configFn();
      return this.sendAndWait(config);
    };
  }
}
```

### Service Usage

```typescript
// services/agent/index.ts
export default function routingAgent(routing: AqmReqs) {
  return {
    stationLogin: routing.req((p: {data: Agent.UserStationLogin}) => ({
      url: '/v1/agents/login',
      host: WCC_API_GATEWAY,
      data: p.data,
      err: errorHandler,
      notifSuccess: {
        bind: {
          type: CC_EVENTS.AGENT_STATION_LOGIN,
          data: {type: CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS},
        },
        msg: {} as Agent.StationLoginSuccess,
      },
      notifFail: {
        bind: {
          type: CC_EVENTS.AGENT_STATION_LOGIN,
          data: {type: CC_EVENTS.AGENT_STATION_LOGIN_FAILED},
        },
        errId: 'Service.aqm.agent.stationLoginFailed',
      },
    })),
    
    reload: routing.reqEmpty(() => ({
      url: '/v1/agents/reload',
      host: WCC_API_GATEWAY,
      data: {},
      err: errorHandler,
      notifSuccess: {/* ... */},
      notifFail: {/* ... */},
    })),
  };
}
```

---

## Message Format

### Incoming WebSocket Message

```typescript
// Standard format
{
  type: 'AgentStateChange',  // Top-level event type
  trackingId: 'uuid-string',
  data: {
    type: 'AgentStateChangeSuccess',  // Nested event type
    agentId: 'agent-123',
    state: 'Available',
    // ... event-specific fields
  }
}

// Keepalive format
{
  keepalive: 'true'
}
```

### Welcome Event

```typescript
{
  type: 'Welcome',
  data: {
    agentId: 'agent-123',
    // Initial connection data
  }
}
```

---

## Error Handling

### Connection Errors

```typescript
this.services.webSocketManager
  .initWebSocket({body: config})
  .then((data) => {
    // Success
  })
  .catch((error) => {
    LoggerProxy.error(`WebSocket connection failed: ${error}`, {
      module: CC_FILE,
      method: 'connectWebsocket',
    });
    throw error;
  });
```

### Reconnection

```typescript
// Silent relogin on reconnection
private async silentRelogin(): Promise<void> {
  try {
    const reLoginResponse = await this.services.agent.reload();
    // Handle relogin success
  } catch (error) {
    const {reason} = getErrorDetails(error, 'silentRelogin', CC_FILE);
    
    if (reason === 'AGENT_NOT_FOUND') {
      // Agent wasn't logged in, handle silently
      return;
    }
    throw error;
  }
}
```

---

## Best Practices

### Always Remove Listeners on Cleanup

```typescript
// Use arrow function properties for consistent `this` binding
private handleWebsocketMessage = (event: string) => { /* ... */ };

// Register
this.services.webSocketManager.on('message', this.handleWebsocketMessage);

// Cleanup
this.services.webSocketManager.off('message', this.handleWebsocketMessage);
```

### Always Check Socket State Before Closing

```typescript
if (!this.services.webSocketManager.isSocketClosed) {
  this.services.webSocketManager.close(false, 'Reason for closing');
}
```

### Log WebSocket Events

```typescript
LoggerProxy.log(`Received event: ${eventType}`, {
  module: CC_FILE,
  method: 'handleWebsocketMessage',
});
```

### Track WebSocket Metrics

```typescript
this.metricsManager.trackEvent(
  METRIC_EVENT_NAMES.WEBSOCKET_EVENT_RECEIVED,
  { ws_event_type: eventType },
  ['operational']
);
```
