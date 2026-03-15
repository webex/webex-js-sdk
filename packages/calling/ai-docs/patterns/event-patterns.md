# Event Patterns

> Quick reference for LLMs working with the typed event system in the `@webex/calling` package.

---

## Rules

- **MUST** extend `Eventing<T>` for any class that emits events
- **MUST** define event type maps that associate event keys to callback signatures
- **MUST** use enum-based event keys (never raw strings)
- **MUST** register/unregister Mercury WebSocket listeners through `SDKConnector`
- **MUST** clean up listeners with `off()` when disposing resources
- **MUST** log every emitted event with timestamp in the `Eventing` base class
- **NEVER** use untyped `EventEmitter` directly — always use `Eventing<T>`
- **NEVER** emit events with raw string keys — use the corresponding enum value

---

## Eventing Base Class

All event-emitting classes extend this generic typed emitter.

```typescript
import EventEmitter from 'events';
import TypedEmitter, {EventMap} from 'typed-emitter';

export class Eventing<T extends EventMap> extends (EventEmitter as {
  new <T extends EventMap>(): TypedEmitter<T>;
})<T> {

  emit<E extends keyof T>(event: E, ...args: Parameters<T[E]>): boolean {
    const timestamp = new Date().toUTCString();
    Logger.info(`${timestamp} ${LOG_PREFIX.EVENT}: ${event.toString()} - event emitted`);
    return super.emit(event, ...args);
  }

  on<E extends keyof T>(event: E, listener: T[E]): this {
    return super.on(event, listener);
  }

  off<E extends keyof T>(event: E, listener: T[E]): this {
    return super.off(event, listener);
  }
}
```

---

## Event Type Maps

Each emitter class has a corresponding type map that constrains event keys and callback signatures.

### Call Events

```typescript
export type CallEventTypes = {
  [CALL_EVENT_KEYS.ALERTING]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.CALL_ERROR]: (error: CallError) => void;
  [CALL_EVENT_KEYS.CALLER_ID]: (display: CallerIdDisplay) => void;
  [CALL_EVENT_KEYS.CONNECT]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.DISCONNECT]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.ESTABLISHED]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.HELD]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.HOLD_ERROR]: (error: CallError) => void;
  [CALL_EVENT_KEYS.PROGRESS]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.REMOTE_MEDIA]: (track: MediaStreamTrack) => void;
  [CALL_EVENT_KEYS.RESUME_ERROR]: (error: CallError) => void;
  [CALL_EVENT_KEYS.RESUMED]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.TRANSFER_ERROR]: (error: CallError) => void;
};
```

### Line Events

```typescript
export type LineEventTypes = {
  [LINE_EVENTS.CONNECTING]: () => void;
  [LINE_EVENTS.ERROR]: (error: LineError) => void;
  [LINE_EVENTS.RECONNECTED]: () => void;
  [LINE_EVENTS.RECONNECTING]: () => void;
  [LINE_EVENTS.REGISTERED]: (lineInfo: ILine) => void;
  [LINE_EVENTS.UNREGISTERED]: () => void;
  [LINE_EVENTS.INCOMING_CALL]: (callObj: ICall) => void;
};
```

### CallingClient Events

```typescript
export type CallingClientEventTypes = {
  [CALLING_CLIENT_EVENT_KEYS.ERROR]: (error: CallingClientError) => void;
  [CALLING_CLIENT_EVENT_KEYS.USER_SESSION_INFO]: (event: CallSessionEvent) => void;
  [CALLING_CLIENT_EVENT_KEYS.OUTGOING_CALL]: (callId: string) => void;
  [CALLING_CLIENT_EVENT_KEYS.ALL_CALLS_CLEARED]: () => void;
};
```

### CallHistory Events

```typescript
export type CallHistoryEventTypes = {
  [COMMON_EVENT_KEYS.CALL_HISTORY_USER_SESSION_INFO]: (event: CallSessionEvent) => void;
  [COMMON_EVENT_KEYS.CALL_HISTORY_USER_VIEWED_SESSIONS]: (event: CallSessionViewedEvent) => void;
  [COMMON_EVENT_KEYS.CALL_HISTORY_USER_SESSIONS_DELETED]: (event: CallSessionDeletedEvent) => void;
};
```

### Voicemail Events

```typescript
export type VoicemailEventTypes = {
  [COMMON_EVENT_KEYS.CB_VOICEMESSAGE_CONTENT_GET]: (messageId: MessageId) => void;
};
```

---

## Event Key Enums

### External Events (consumed by application)

```typescript
export enum CALL_EVENT_KEYS {
  ALERTING = 'alerting',
  CALL_ERROR = 'call_error',
  CALLER_ID = 'caller_id',
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ESTABLISHED = 'established',
  HELD = 'held',
  HOLD_ERROR = 'hold_error',
  PROGRESS = 'progress',
  REMOTE_MEDIA = 'remote_media',
  RESUME_ERROR = 'resume_error',
  RESUMED = 'resumed',
  TRANSFER_ERROR = 'transfer_error',
}

export enum LINE_EVENTS {
  CONNECTING = 'connecting',
  ERROR = 'error',
  RECONNECTED = 'reconnected',
  RECONNECTING = 'reconnecting',
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
  INCOMING_CALL = 'line:incoming_call',
}

export enum CALLING_CLIENT_EVENT_KEYS {
  ERROR = 'callingClient:error',
  OUTGOING_CALL = 'callingClient:outgoing_call',
  USER_SESSION_INFO = 'callingClient:user_recent_sessions',
  ALL_CALLS_CLEARED = 'callingClient:all_calls_cleared',
}
```

### Internal Events (Mobius WebSocket)

```typescript
export enum MOBIUS_EVENT_KEYS {
  SERVER_EVENT_INCLUSIVE = 'event:mobius',
  CALL_SESSION_EVENT_INCLUSIVE = 'event:janus.user_recent_sessions',
  CALL_SESSION_EVENT_LEGACY = 'event:janus.user_sessions',
  CALL_SESSION_EVENT_VIEWED = 'event:janus.user_viewed_sessions',
  CALL_SESSION_EVENT_DELETED = 'event:janus.user_sessions_deleted',
}

export enum WEBSOCKET_KEYS {
  CALL_PROGRESS = 'callprogress',
  CALL_CONNECTED = 'callconnected',
  CALL_DISCONNECTED = 'callconnected',
  CALL_INFO = 'callinfo',
  CALL = 'call',
  ROAP = 'ROAP',
}
```

---

## Event Emission Pattern

### Emitting from a Call

```typescript
// Emit with callId
this.emit(CALL_EVENT_KEYS.ALERTING, this.correlationId);

// Emit with error
this.emit(CALL_EVENT_KEYS.CALL_ERROR, callError);

// Emit caller ID information
const emitObj = {
  correlationId: this.correlationId,
  callerId: this.callerInfo,
};
this.emit(CALL_EVENT_KEYS.CALLER_ID, emitObj);

// Emit remote media track
this.emit(CALL_EVENT_KEYS.REMOTE_MEDIA, track);
```

### Emitting from a Line

```typescript
lineEmitter: (event: LINE_EVENTS, deviceInfo?: IDeviceInfo, lineError?: LineError) => void;

// Usage
this.lineEmitter(LINE_EVENTS.REGISTERED, deviceInfo);
this.lineEmitter(LINE_EVENTS.ERROR, undefined, lineError);
this.lineEmitter(LINE_EVENTS.UNREGISTERED);
```

---

## Event Listening Pattern

### Application Listening to Line Events

```typescript
const line = callingClient.getLine();

line.on(LINE_EVENTS.REGISTERED, (lineInfo: ILine) => {
  console.log('Line registered:', lineInfo.lineId);
});

line.on(LINE_EVENTS.INCOMING_CALL, (call: ICall) => {
  console.log('Incoming call from:', call.getCallerInfo());
});

line.on(LINE_EVENTS.ERROR, (error: LineError) => {
  console.error('Line error:', error.getError());
});
```

### Application Listening to Call Events

```typescript
const call = line.makeCall({type: CallType.URI, address: 'user@example.com'});

call.on(CALL_EVENT_KEYS.ESTABLISHED, (callId: CallId) => {
  console.log('Call established:', callId);
});

call.on(CALL_EVENT_KEYS.DISCONNECT, (callId: CallId) => {
  console.log('Call disconnected:', callId);
});

call.on(CALL_EVENT_KEYS.CALL_ERROR, (error: CallError) => {
  console.error('Call error:', error.getCallError());
});
```

---

## WebSocket Event Flow

Mercury WebSocket events flow from the server through `SDKConnector` to the appropriate handler.

```
Mercury WS ──> SDKConnector.registerListener('event:mobius', cb)
                     │
                     ▼
               CallManager.dequeueWsEvents()
                     │
           ┌─────────┼──────────┐
           ▼         ▼          ▼
     New Call    Existing    Mid-Call
     Setup       Call Evt    Service
           │         │          │
           ▼         ▼          ▼
    Line.emit    Call.emit  Call state
    (INCOMING)   (event)    machine
```

### Registering Mercury Listeners

```typescript
// In SDKConnector
public registerListener<T>(event: string, cb: (data?: T) => void): void {
  instance.getWebex().internal.mercury.on(event, (data: T) => {
    cb(data);
  });
}

public unregisterListener(event: string): void {
  instance.getWebex().internal.mercury.off(event);
}
```

### CallManager Subscribes to WebSocket Events

```typescript
private listenForWsEvents() {
  this.sdkConnector.registerListener<MobiusCallEvent>(
    MOBIUS_EVENT_KEYS.SERVER_EVENT_INCLUSIVE,
    (event?: MobiusCallEvent) => {
      if (event) {
        this.dequeueWsEvents(event);
      }
    }
  );
}
```

### Session Listener Pattern in CallingClient

```typescript
private registerSessionsListener() {
  this.sdkConnector.registerListener<CallSessionEvent>(
    MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_INCLUSIVE,
    (event?: CallSessionEvent) => {
      if (event) {
        this.emit(CALLING_CLIENT_EVENT_KEYS.USER_SESSION_INFO, event);
      }
    }
  );
}
```

---

## Related

- [Architecture Patterns](./architecture-patterns.md)
- [State Machine Patterns](./state-machine-patterns.md)
- [Error Handling Patterns](./error-handling-patterns.md)
- [TypeScript Patterns](./typescript-patterns.md)
