# Line Module — Architecture

## Component Overview

The `Line` class acts as the bridge between the application, the `Registration` subsystem, and the `CallManager`. It does not perform registration or call management itself — instead, it orchestrates these subsystems and provides a unified event interface to the application.

### Responsibilities

| Concern | How Line Handles It |
|---------|-------------------|
| Registration | Delegates to `Registration` via `registration.triggerRegistration()`, protected by `Mutex` |
| Registration events | Receives via `lineEmitter` callback; normalizes and re-emits as `LineEventTypes` |
| Incoming calls | Subscribes to `CallManager` `incoming_call`; re-emits as `LINE_EVENTS.INCOMING_CALL` |
| Outbound calls | Delegates to `CallManager.createCall()`; returns `ICall` to application |
| Line metadata | Populated from device registration response via `normalizeLine()` |

---

## Internal Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Application                         │
│  line.on('registered' | 'incoming_call' | 'error' ...)  │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                       Line                              │
│  Eventing<LineEventTypes>  implements ILine              │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │ Registration │◄───│ lineEmitter  │ (callback)        │
│  │ (delegate)   │───►│ normalizeLine│                   │
│  └──────────────┘    └──────────────┘                   │
│                                                         │
│  ┌──────────────┐    ┌──────────────┐                   │
│  │ CallManager  │◄───│makeCall()    │                   │
│  │ (singleton)  │───►│incomingCall  │                   │
│  │              │    │  Listener()  │                   │
│  └──────────────┘    └──────────────┘                   │
└─────────────────────────────────────────────────────────┘
```

---

## lineEmitter Pattern

The `lineEmitter` is the critical callback passed from `Line` to `Registration` during construction. It is the **only mechanism** by which `Registration` communicates state changes back to `Line`.

### How It Works

1. `Line` constructor creates `Registration` and passes `this.lineEmitter` as a callback
2. `Registration` calls `lineEmitter(event, deviceInfo?, lineError?)` at key points
3. `lineEmitter` handles each event type:

```
lineEmitter(event, deviceInfo?, lineError?)
  │
  ├── LINE_EVENTS.REGISTERED
  │   ├── normalizeLine(deviceInfo)   → populate phoneNumber, extension, SIP, etc.
  │   ├── callManager.updateLine()    → update callManager's reference
  │   └── this.emit(REGISTERED, this) → notify application
  │
  ├── LINE_EVENTS.UNREGISTERED
  │   └── this.emit(UNREGISTERED)     → notify application
  │
  ├── LINE_EVENTS.RECONNECTED
  │   └── this.emit(RECONNECTED)      → notify application
  │
  ├── LINE_EVENTS.RECONNECTING
  │   └── this.emit(RECONNECTING)     → notify application
  │
  └── LINE_EVENTS.ERROR
      └── this.emit(ERROR, lineError) → notify application
```

### normalizeLine

When `REGISTERED` is received, `normalizeLine(deviceInfo)` extracts:

| Field | Source |
|-------|--------|
| `mobiusDeviceId` | `deviceInfo.device.deviceId` |
| `mobiusUri` | `deviceInfo.device.uri` |
| `phoneNumber` | First address from `deviceInfo.device.addresses` |
| `lastSeen` | `deviceInfo.device.lastSeen` |
| `keepaliveInterval` | `deviceInfo.keepaliveInterval` (or default 30s) |
| `callKeepaliveInterval` | `deviceInfo.callKeepaliveInterval` (or default) |
| `rehomingIntervalMin/Max` | From `deviceInfo` (or defaults 60s/120s) |
| `voicePortalNumber` | `deviceInfo.voicePortalNumber` |
| `voicePortalExtension` | `deviceInfo.voicePortalExtension` |

---

## Incoming Call Listener

The `incomingCallListener()` method subscribes to `CallManager`'s `incoming_call` event and re-emits it as a `LINE_EVENTS.INCOMING_CALL`:

```
Mercury WS
  │ event:mobius (callSetup)
  ▼
CallManager.dequeueWsEvents()
  │ new Call(INBOUND, ...)
  │ emit(LINE_EVENT_KEYS.INCOMING_CALL, call)
  ▼
Line.incomingCallListener()
  │ this.emit(LINE_EVENTS.INCOMING_CALL, call)
  ▼
Application handler
```

This indirection ensures that:
- `CallManager` remains decoupled from `Line`
- `Line` controls which events reach the application
- The application gets a consistent `LINE_EVENTS` interface

---

## makeCall Flow

```
Application: line.makeCall({type: 'uri', address: 'sip:user@...'})
  │
  ├── Validate: registration.isDeviceRegistered()
  │   └── If not registered → log warning, return undefined
  │
  ├── callManager.createCall(OUTBOUND, deviceId, lineId, destination)
  │   └── Returns ICall
  │
  └── Return ICall to application
```

The `Call` object is then used by the application to `dial()`, listen for events, and control the call.

---

## Registration Orchestration

### register()

```typescript
async register(): Promise<void> {
  // 1. Acquire mutex (prevents concurrent registration)
  const release = await this.#mutex.acquire();
  try {
    // 2. Emit CONNECTING to notify application
    this.emit(LINE_EVENTS.CONNECTING);
    // 3. Delegate to Registration
    await this.registration.triggerRegistration();
  } finally {
    release();
  }
}
```

### deregister()

```typescript
async deregister(): Promise<void> {
  // 1. Delegate to Registration
  await this.registration.deregister();
  // 2. Set status to IDLE
  this.registration.setStatus(RegistrationStatus.IDLE);
}
```

---

## File Structure

```
line/
├── index.ts          # Line class implementation
├── types.ts          # ILine interface, LINE_EVENTS enum, callback types
├── line.test.ts      # Unit tests
└── ai-docs/
    ├── AGENTS.md     # Overview, API, examples
    └── ARCHITECTURE.md  # This file
```

---

## Related Documentation

- [Line AGENTS.md](./AGENTS.md) — Public API, events, examples
- [Registration ARCHITECTURE.md](../../registration/ai-docs/ARCHITECTURE.md) — Registration internals
- [CallingClient ARCHITECTURE.md](../../ai-docs/ARCHITECTURE.md) — Parent module architecture
- [Event Patterns](../../../../ai-docs/patterns/event-patterns.md) — Typed event system

---

_Last Updated: 2026-03-15_
