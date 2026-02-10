# Event-Driven Patterns - Contact Center SDK

> **Purpose**: Event handling patterns for the Contact Center SDK, including WebSocket events and EventEmitter usage.

---

## Event Constants

### Definition Pattern

Events are defined as const objects for type safety:

```typescript
// services/config/types.ts

// Agent-related events
export const CC_AGENT_EVENTS = {
  WELCOME: 'Welcome',
  AGENT_RELOGIN_SUCCESS: 'AgentReloginSuccess',
  AGENT_RELOGIN_FAILED: 'AgentReloginFailed',
  AGENT_LOGOUT: 'Logout',
  AGENT_LOGOUT_SUCCESS: 'AgentLogoutSuccess',
  AGENT_LOGOUT_FAILED: 'AgentLogoutFailed',
  AGENT_STATION_LOGIN: 'StationLogin',
  AGENT_STATION_LOGIN_SUCCESS: 'AgentStationLoginSuccess',
  AGENT_STATION_LOGIN_FAILED: 'AgentStationLoginFailed',
  AGENT_STATE_CHANGE: 'AgentStateChange',
  AGENT_STATE_CHANGE_SUCCESS: 'AgentStateChangeSuccess',
  AGENT_STATE_CHANGE_FAILED: 'AgentStateChangeFailed',
  AGENT_MULTI_LOGIN: 'AGENT_MULTI_LOGIN',
} as const;

// Task-related events
export const CC_TASK_EVENTS = {
  AGENT_CONTACT_HELD: 'AgentContactHeld',
  AGENT_CONTACT_UNHELD: 'AgentContactUnheld',
  AGENT_CONSULT_CREATED: 'AgentConsultCreated',
  AGENT_BLIND_TRANSFERRED: 'AgentBlindTransferred',
  CONTACT_ENDED: 'ContactEnded',
  AGENT_WRAPUP: 'AgentWrapup',
  AGENT_WRAPPEDUP: 'AgentWrappedUp',
  // ... more events
} as const;

// Combined events
export const CC_EVENTS = {
  ...CC_AGENT_EVENTS,
  ...CC_TASK_EVENTS,
} as const;

// Type extraction
type Enum<T extends Record<string, unknown>> = T[keyof T];
export type CC_EVENTS = Enum<typeof CC_EVENTS>;
```

### Agent Events (AGENT_EVENTS)

```typescript
// services/agent/types.ts
export const AGENT_EVENTS = {
  AGENT_STATE_CHANGE: 'agent:stateChange',
  AGENT_STATE_CHANGE_SUCCESS: 'agent:stateChangeSuccess',
  AGENT_STATE_CHANGE_FAILED: 'agent:stateChangeFailed',
  AGENT_STATION_LOGIN_SUCCESS: 'agent:stationLoginSuccess',
  AGENT_STATION_LOGIN_FAILED: 'agent:stationLoginFailed',
  AGENT_LOGOUT_SUCCESS: 'agent:logoutSuccess',
  AGENT_LOGOUT_FAILED: 'agent:logoutFailed',
  AGENT_RELOGIN_SUCCESS: 'agent:reloginSuccess',
  AGENT_DN_REGISTERED: 'agent:dnRegistered',
  AGENT_MULTI_LOGIN: 'agent:multiLogin',
} as const;
```

### Task Events (TASK_EVENTS)

```typescript
// services/task/types.ts
export const TASK_EVENTS = {
  TASK_INCOMING: 'task:incoming',
  TASK_HYDRATE: 'task:hydrate',
  TASK_MERGED: 'task:merged',
  TASK_ESTABLISHED: 'task:established',
  TASK_ENDED: 'task:ended',
  TASK_ERROR: 'task:error',
} as const;
```

---

## WebSocket Event Flow

### Message Reception

```
WebSocket → WebSocketManager → cc.handleWebsocketMessage → Event Emission
```

### Handling Pattern

```typescript
// cc.ts
private handleWebsocketMessage = (event: string) => {
  const eventData = JSON.parse(event);
  
  // Skip keepalives
  if (eventData.keepalive) {
    return;
  }
  
  // Log received event
  LoggerProxy.log(`Received event: ${eventData?.data?.type ?? eventData.type}`, {
    module: CC_FILE,
    method: 'handleWebsocketMessage',
  });
  
  // Track metrics for non-welcome events
  if (eventData.type !== CC_EVENTS.WELCOME && eventData.keepalive !== 'true') {
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.WEBSOCKET_EVENT_RECEIVED,
      { ws_event_type: eventData?.data?.type || eventData.type },
      ['operational']
    );
  }
  
  // Route based on event type
  switch (eventData.type) {
    case CC_EVENTS.AGENT_STATE_CHANGE:
      this.emit(AGENT_EVENTS.AGENT_STATE_CHANGE, eventData.data);
      break;
    case CC_EVENTS.AGENT_MULTI_LOGIN:
      this.emit(AGENT_EVENTS.AGENT_MULTI_LOGIN, eventData.data);
      break;
  }
  
  // Handle nested data.type events
  if (eventData.data && eventData.data.type) {
    switch (eventData.data.type) {
      case CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS:
        this.emit(AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS, eventData.data);
        break;
      case CC_EVENTS.AGENT_LOGOUT_SUCCESS:
        this.emit(AGENT_EVENTS.AGENT_LOGOUT_SUCCESS, eventData.data);
        break;
      // ... more cases
    }
  }
};
```

---

## Event Emission

### From Plugin Class

```typescript
// Using WebexPlugin's emit method
this.emit(AGENT_EVENTS.AGENT_STATE_CHANGE, eventData);

// Using trigger for some events (alternative method)
this.trigger(TASK_EVENTS.TASK_INCOMING, task);
```

### From TaskManager

```typescript
// TaskManager extends EventEmitter
export default class TaskManager extends EventEmitter {
  private emitTaskEvent(eventType: string, task: ITask) {
    this.emit(eventType, task);
  }
  
  public handleIncomingTask(taskData: TaskData) {
    const task = this.createTask(taskData);
    this.emit(TASK_EVENTS.TASK_INCOMING, task);
  }
}
```

---

## Event Subscription

### In Application Code

```typescript
// Subscribe to events
const cc = webex.cc;

cc.on('agent:stateChange', (event) => {
  console.log('Agent state changed:', event.state);
});

cc.on('task:incoming', (task) => {
  console.log('New task:', task.interactionId);
});

// Unsubscribe
const handler = (event) => { /* handle */ };
cc.on('agent:stateChange', handler);
cc.off('agent:stateChange', handler);
```

### Internal Subscription

```typescript
// In constructor
constructor() {
  this.$webex.once(READY, () => {
    this.services.webSocketManager.on('message', this.handleWebsocketMessage);
    this.services.connectionService.on('connectionLost', this.handleConnectionLost);
    
    this.taskManager.on(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
    this.taskManager.on(TASK_EVENTS.TASK_HYDRATE, this.handleTaskHydrate);
  });
}

// Cleanup in deregister
public async deregister() {
  this.taskManager.off(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
  this.services.webSocketManager.off('message', this.handleWebsocketMessage);
}
```

---

## Event Data Transformation

### Login Success Transformation

```typescript
case CC_EVENTS.AGENT_STATION_LOGIN_SUCCESS: {
  // Transform channelsMap to mmProfile
  const {channelsMap, ...loginData} = eventData.data;
  const stationLoginData = {
    ...loginData,
    mmProfile: {
      chat: channelsMap.chat?.length,
      email: channelsMap.email?.length,
      social: channelsMap.social?.length,
      telephony: channelsMap.telephony?.length,
    },
    notifsTrackingId: eventData.trackingId,
  };
  
  this.emit(AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS, stationLoginData);
  break;
}
```

---

## Adding New Events

### Step 1: Define Event Constant

```typescript
// In appropriate types file
export const CC_MY_EVENTS = {
  MY_NEW_EVENT: 'MyNewEvent',
  MY_NEW_EVENT_SUCCESS: 'MyNewEventSuccess',
  MY_NEW_EVENT_FAILED: 'MyNewEventFailed',
} as const;

// Add to CC_EVENTS if needed
export const CC_EVENTS = {
  ...CC_AGENT_EVENTS,
  ...CC_TASK_EVENTS,
  ...CC_MY_EVENTS,
} as const;
```

### Step 2: Define External Event Name

```typescript
export const AGENT_EVENTS = {
  // ... existing
  MY_NEW_EVENT: 'agent:myNewEvent',
  MY_NEW_EVENT_SUCCESS: 'agent:myNewEventSuccess',
  MY_NEW_EVENT_FAILED: 'agent:myNewEventFailed',
} as const;
```

### Step 3: Handle in WebSocket Handler

```typescript
case CC_EVENTS.MY_NEW_EVENT_SUCCESS:
  this.emit(AGENT_EVENTS.MY_NEW_EVENT_SUCCESS, eventData.data);
  break;
case CC_EVENTS.MY_NEW_EVENT_FAILED:
  this.emit(AGENT_EVENTS.MY_NEW_EVENT_FAILED, eventData.data);
  break;
```

### Step 4: Document the Event

```typescript
/**
 * @fires agent:myNewEvent When event occurs
 * @fires agent:myNewEventSuccess When event succeeds
 * @fires agent:myNewEventFailed When event fails
 */
```

---

## Event Type Safety

### Typed Event Handlers

```typescript
// Define event data types
type AgentStateChangeEvent = {
  agentId: string;
  state: string;
  auxCodeId: string;
  timestamp: number;
};

type TaskIncomingEvent = {
  interactionId: string;
  taskId: string;
  channelType: string;
};

// Type-safe event handler
function onAgentStateChange(handler: (event: AgentStateChangeEvent) => void) {
  cc.on(AGENT_EVENTS.AGENT_STATE_CHANGE, handler);
}
```

---

## Connection Events

### Connection Lost/Reconnected

```typescript
// services/core/websocket/types.ts
export type ConnectionLostDetails = {
  isConnectionLost: boolean;
  isSocketReconnected: boolean;
};

// Handling in cc.ts
private async handleConnectionLost(msg: ConnectionLostDetails): Promise<void> {
  if (msg.isConnectionLost) {
    LoggerProxy.info('Connection lost', {
      module: CC_FILE,
      method: 'handleConnectionLost',
    });
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

## Best Practices

### Always Use Constants

```typescript
// ✅ CORRECT
this.emit(AGENT_EVENTS.AGENT_STATE_CHANGE, data);
cc.on(TASK_EVENTS.TASK_INCOMING, handler);

// ❌ WRONG
this.emit('stateChange', data);
cc.on('task:incoming', handler);
```

### Always Clean Up Listeners

```typescript
// Store handler reference for cleanup
private handleIncomingTask = (task: ITask) => {
  this.trigger(TASK_EVENTS.TASK_INCOMING, task);
};

// Register
this.taskManager.on(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);

// Cleanup
this.taskManager.off(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
```

### Log Event Reception

```typescript
LoggerProxy.log(`Received event: ${eventType}`, {
  module: 'ModuleName',
  method: 'handleEvent',
});
```
