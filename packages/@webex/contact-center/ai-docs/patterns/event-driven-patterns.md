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
  AGENT_DN_REGISTERED: 'AgentDNRegistered',
  AGENT_LOGOUT: 'Logout',
  AGENT_LOGOUT_SUCCESS: 'AgentLogoutSuccess',
  AGENT_LOGOUT_FAILED: 'AgentLogoutFailed',
  AGENT_STATION_LOGIN: 'StationLogin',
  AGENT_STATION_LOGIN_SUCCESS: 'AgentStationLoginSuccess',
  AGENT_STATION_LOGIN_FAILED: 'AgentStationLoginFailed',
  AGENT_STATE_CHANGE: 'AgentStateChange',
  AGENT_MULTI_LOGIN: 'AGENT_MULTI_LOGIN',
  AGENT_STATE_CHANGE_SUCCESS: 'AgentStateChangeSuccess',
  AGENT_STATE_CHANGE_FAILED: 'AgentStateChangeFailed',
  AGENT_BUDDY_AGENTS: 'BuddyAgents',
  AGENT_BUDDY_AGENTS_SUCCESS: 'BuddyAgents',
  AGENT_BUDDY_AGENTS_RETRIEVE_FAILED: 'BuddyAgentsRetrieveFailed',
  AGENT_CONTACT_RESERVED: 'AgentContactReserved',
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
export enum AGENT_EVENTS {
  AGENT_STATE_CHANGE = 'agent:stateChange',
  AGENT_MULTI_LOGIN = 'agent:multiLogin',
  AGENT_STATION_LOGIN_SUCCESS = 'agent:stationLoginSuccess',
  AGENT_STATION_LOGIN_FAILED = 'agent:stationLoginFailed',
  AGENT_LOGOUT_SUCCESS = 'agent:logoutSuccess',
  AGENT_LOGOUT_FAILED = 'agent:logoutFailed',
  AGENT_DN_REGISTERED = 'agent:dnRegistered',
  AGENT_RELOGIN_SUCCESS = 'agent:reloginSuccess',
  AGENT_STATE_CHANGE_SUCCESS = 'agent:stateChangeSuccess',
  AGENT_STATE_CHANGE_FAILED = 'agent:stateChangeFailed',
}
```

### Task Events (TASK_EVENTS)

```typescript
// services/task/types.ts
export enum TASK_EVENTS {
  TASK_INCOMING = 'task:incoming',
  TASK_ASSIGNED = 'task:assigned',
  TASK_MEDIA = 'task:media',
  TASK_UNASSIGNED = 'task:unassigned',
  TASK_HOLD = 'task:hold',
  TASK_RESUME = 'task:resume',
  TASK_HYDRATE = 'task:hydrate',
  TASK_MERGED = 'task:merged',
  TASK_END = 'task:end',
  TASK_WRAPUP = 'task:wrapup',
  TASK_CLEANUP = 'task:cleanup',
  // ... more events (consult, recording, etc.)
}
```

---

## Event Flow

### Generic Event Reception

Events flow through a standard pipeline: receive from transport, parse, log, route, and emit to listeners.

```
Transport (WebSocket/EventEmitter)
    │
    ▼
Handler receives raw event
    │
    ├── Parse / validate
    ├── Log reception
    ├── Route by event type
    └── Emit to subscribers
```

Handlers use one of two patterns to preserve `this` binding: **arrow function properties** (e.g., `handleWebsocketMessage`) or **regular methods with `.bind(this)`** (e.g., `handleConnectionLost`):

```typescript
// Pattern 1: Arrow function property (used by handleWebsocketMessage)
private handleEvent = (event: string) => {
  const eventData = JSON.parse(event);

  // Skip non-actionable events (e.g., keepalives)
  if (eventData.keepalive) {
    return;
  }

  // Log reception
  LoggerProxy.log(`Received event: ${eventData?.data?.type ?? eventData.type}`, {
    module: CC_FILE,
    method: 'handleEvent',
  });

  // Route by type and emit to subscribers
  switch (eventData.type) {
    case CC_EVENTS.AGENT_STATE_CHANGE:
      // @ts-ignore
      this.trigger(AGENT_EVENTS.AGENT_STATE_CHANGE, eventData.data);
      break;
    // ... more cases
  }
};
```

---

## Event Emission

There are **two methods** for emitting events: `trigger` and `emit`. They are **not interchangeable** — which one to use depends on what the class extends.

### `trigger` — for classes extending `WebexPlugin` (e.g., cc.ts)

`cc.ts` (`ContactCenter`) extends `WebexPlugin`, **not** `EventEmitter`. The `emit` method does not exist on `WebexPlugin`. The correct method for emitting events from `cc` is `trigger`, which comes from the Ampersand event system that `WebexPlugin` is built on.

```typescript
// cc.ts — ContactCenter extends WebexPlugin
// @ts-ignore
this.trigger(TASK_EVENTS.TASK_INCOMING, task);

// @ts-ignore
this.trigger(TASK_EVENTS.TASK_HYDRATE, task);
```

> **Note**: `trigger` requires `// @ts-ignore` because WebexPlugin's TypeScript type definitions don't expose it.

### `emit` — for classes extending `EventEmitter` (e.g., Task, TaskManager, WebCallingService)

`emit` is the standard Node.js `EventEmitter` method. It works natively on classes that extend `EventEmitter` — no `@ts-ignore` needed.

```typescript
// Task extends EventEmitter — emit works natively
export default abstract class Task extends EventEmitter implements ITask {
  private autoAnswerIfNeeded() {
    // ...
    this.emit(TASK_EVENTS.TASK_AUTO_ANSWERED, this);
  }
}

// TaskManager extends EventEmitter — emit works natively
export default class TaskManager extends EventEmitter {
  private handleIncomingTask(taskData: TaskData) {
    const task = this.createTask(taskData);
    this.emit(TASK_EVENTS.TASK_INCOMING, task);
  }
}
```

> **Note on existing code**: The `cc` object currently uses `this.emit()` in `handleWebsocketMessage` for agent events with `// @ts-ignore`. This works at runtime but is not type-safe. For new code on the `cc` object, always use `trigger`.

### When to Use Which

| Class extends | Method | `@ts-ignore` needed? | Example classes |
|---------------|--------|----------------------|-----------------|
| `WebexPlugin` | `trigger` | Yes | `cc.ts` (ContactCenter) |
| `EventEmitter` | `emit` | No | Task, TaskManager, WebCallingService, WebSocketManager |

---

## Event Subscription

### How to Add / Remove a Listener

```typescript
// Add a listener
source.on(EVENT_CONSTANT, handler);

// Remove a listener (must pass the same function reference)
source.off(EVENT_CONSTANT, handler);
```

> **Important**: Always store the callback as a named function reference. Using inline anonymous functions makes it impossible to call `.off()` because you can't pass the same reference back.

#### Example

Store handler references so you can remove them later. Use **arrow function properties** or **`.bind(this)`** depending on the pattern:

```typescript
// Pattern 1: Arrow function property (preserves `this` automatically)
private handleIncomingTask = (task: ITask) => {
  // @ts-ignore
  this.trigger(TASK_EVENTS.TASK_INCOMING, task);
};

// Register
this.taskManager.on(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);

// Cleanup
this.taskManager.off(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);

// Pattern 2: Regular method with .bind(this) (used by handleConnectionLost in cc.ts)
private async handleConnectionLost(msg: ConnectionLostDetails): Promise<void> {
  // handle connection lost
}

// Register with .bind(this)
this.services.connectionService.on('connectionLost', this.handleConnectionLost.bind(this));
```

### Internal Event Listening (between services)

Internal services listen to each other during initialization, and clean up during deregistration:

```typescript
// Register listeners after SDK is ready
this.$webex.once(READY, () => {
  this.services.webSocketManager.on('message', this.handleWebsocketMessage);
  this.services.connectionService.on('connectionLost', this.handleConnectionLost);
  this.taskManager.on(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
  this.taskManager.on(TASK_EVENTS.TASK_HYDRATE, this.handleTaskHydrate);
});

// Remove all listeners on deregister
public async deregister() {
  this.taskManager.off(TASK_EVENTS.TASK_INCOMING, this.handleIncomingTask);
  this.taskManager.off(TASK_EVENTS.TASK_HYDRATE, this.handleTaskHydrate);
  this.services.webSocketManager.off('message', this.handleWebsocketMessage);
  this.services.connectionService.off('connectionLost', this.handleConnectionLost);
}
```

### Events Sent to Application (from cc, task)

Application consumers subscribe to events on the `cc` object or on task instances. Always use named callbacks so `.off()` can reference the same function:

```typescript
const cc = webex.cc;

// Define named callbacks (required for .off() to work)
const handleStateChange = (event) => {
  // handle agent state change
};

const handleLoginSuccess = (event) => {
  // handle login success
};

const handleIncomingTask = (task) => {
  // handle incoming task
};

// Subscribe — agent events (from cc)
cc.on(AGENT_EVENTS.AGENT_STATE_CHANGE, handleStateChange);
cc.on(AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS, handleLoginSuccess);

// Subscribe — task events (from cc)
cc.on(TASK_EVENTS.TASK_INCOMING, handleIncomingTask);

// Unsubscribe — pass the same function reference
cc.off(AGENT_EVENTS.AGENT_STATE_CHANGE, handleStateChange);
cc.off(AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS, handleLoginSuccess);
cc.off(TASK_EVENTS.TASK_INCOMING, handleIncomingTask);
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
  
  // @ts-ignore
  this.trigger(AGENT_EVENTS.AGENT_STATION_LOGIN_SUCCESS, stationLoginData);
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
export enum AGENT_EVENTS {
  // ... existing
  MY_NEW_EVENT = 'agent:myNewEvent',
  MY_NEW_EVENT_SUCCESS = 'agent:myNewEventSuccess',
  MY_NEW_EVENT_FAILED = 'agent:myNewEventFailed',
}
```

### Step 3: Handle in WebSocket Handler

```typescript
case CC_EVENTS.MY_NEW_EVENT_SUCCESS:
  // @ts-ignore
  this.trigger(AGENT_EVENTS.MY_NEW_EVENT_SUCCESS, eventData.data);
  break;
case CC_EVENTS.MY_NEW_EVENT_FAILED:
  // @ts-ignore
  this.trigger(AGENT_EVENTS.MY_NEW_EVENT_FAILED, eventData.data);
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

## WebSocket Lifecycle

### Registration (subscribing to messages)

```typescript
// Subscribe to WebSocket messages during initialization
this.services.webSocketManager.on('message', this.handleWebsocketMessage);

// Subscribe to connection state changes
this.services.connectionService.on('connectionLost', this.handleConnectionLost);
```

### Connection

```typescript
// Establish WebSocket connection via initWebSocket
const welcomeData = await this.services.webSocketManager.initWebSocket({
  body: this.getConnectionConfig(),
});
// welcomeData contains the Welcome event with agentId
```

### Reconnection

```typescript
// ConnectionService emits 'connectionLost' with connection state details
// The handler checks whether the socket was lost or reconnected
this.services.connectionService.on('connectionLost', this.handleConnectionLost);

// On reconnection, perform a silent relogin to restore agent state
private async silentRelogin(): Promise<void> {
  await this.services.agent.reload();
}
```

### Disconnection

```typescript
// 1. Remove all listeners first
this.services.webSocketManager.off('message', this.handleWebsocketMessage);
this.services.connectionService.off('connectionLost', this.handleConnectionLost);

// 2. Check socket state before closing
if (!this.services.webSocketManager.isSocketClosed) {
  this.services.webSocketManager.close(false, 'Unregistering the SDK');
}
```

---

## Best Practices

### Always Use Constants

```typescript
// CORRECT — use event constants, not raw strings
this.trigger(AGENT_EVENTS.AGENT_STATE_CHANGE, data);  // WebexPlugin (cc.ts)
this.emit(TASK_EVENTS.TASK_INCOMING, task);            // EventEmitter (Task, TaskManager)
cc.on(TASK_EVENTS.TASK_INCOMING, handler);

// WRONG — never use raw string event names
this.trigger('stateChange', data);
cc.on('task:incoming', handler);
```

### Always Clean Up Listeners

Every `on()` must have a corresponding `off()` in the deregister/cleanup path. See the [Event Subscription](#event-subscription) section for the full pattern.

### Log Event Reception

```typescript
LoggerProxy.log(`Received event: ${eventType}`, {
  module: CC_FILE,
  method: 'handleEvent',
});
```
