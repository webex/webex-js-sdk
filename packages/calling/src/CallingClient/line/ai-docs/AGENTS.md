# Line Module

## AI Agent Routing Instructions

**If you are an AI assistant or automated tool:**

- **First step:** Load the parent [CallingClient/ai-docs/AGENTS.md](../../ai-docs/AGENTS.md) for module-level context.
- **For registration-specific changes:** Also load [registration/ai-docs/AGENTS.md](../../registration/ai-docs/AGENTS.md).
- **For package-level patterns:** See `packages/calling/ai-docs/patterns/`.

---

## Overview

The `Line` class represents a single telephony line registered with the Webex Calling (Mobius) backend. It is the primary interface through which applications interact with calling capabilities — making calls, receiving incoming calls, and monitoring registration state.

A `Line` is created internally by `CallingClient.createLine()` during initialization. Applications access it via `callingClient.getLines()`.

**File:** `packages/calling/src/CallingClient/line/index.ts`

**Class:** `Line extends Eventing<LineEventTypes> implements ILine`

---

## Purpose

The Line module is responsible for:

- **Registration orchestration** — Delegates to `Registration` but manages the mutex and emits line-level events
- **Incoming call forwarding** — Listens for `incoming_call` from `CallManager` and re-emits as `LINE_EVENTS.INCOMING_CALL`
- **Outbound call initiation** — Creates calls via `CallManager.createCall()` and returns the `ICall` object
- **Line normalization** — Populates line properties (phone number, SIP addresses, extension, voicemail, etc.) from device registration response
- **Line event emission** — Provides the `lineEmitter` callback that `Registration` uses to signal state changes

---

## Public API

### ILine Interface

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `userId` | `string` | User ID associated with the line |
| `clientDeviceUri` | `string` | Device URI from Webex SDK |
| `lineId` | `string` | Unique line identifier (UUID) |
| `mobiusDeviceId` | `string?` | Mobius device ID (set after registration) |
| `phoneNumber` | `string?` | Phone number (set after registration) |
| `extension` | `string?` | Extension number |
| `sipAddresses` | `string[]?` | SIP addresses |
| `voicemail` | `string?` | Voicemail number |
| `lastSeen` | `string?` | Last seen timestamp |
| `keepaliveInterval` | `number?` | Keepalive interval in seconds |
| `callKeepaliveInterval` | `number?` | Call keepalive interval |
| `rehomingIntervalMin` | `number?` | Min rehoming interval |
| `rehomingIntervalMax` | `number?` | Max rehoming interval |
| `voicePortalNumber` | `number?` | Voice portal number |
| `voicePortalExtension` | `number?` | Voice portal extension |
| `registration` | `IRegistration` | Registration instance for this line |

#### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(): void` | Registers the line with Mobius (acquires mutex, emits CONNECTING, delegates to Registration) |
| `deregister` | `(): void` | Deregisters the line (delegates to Registration, sets status IDLE) |
| `getActiveMobiusUrl` | `(): string` | Returns the currently active Mobius server URL |
| `getStatus` | `(): RegistrationStatus` | Returns current registration status (`IDLE`, `active`, `inactive`) |
| `getDeviceId` | `(): MobiusDeviceId \| undefined` | Returns the Mobius device ID |
| `lineEmitter` | `(event, deviceInfo?, lineError?) => void` | Callback for Registration to emit line events |
| `makeCall` | `(dest?: CallDetails): ICall \| undefined` | Initiates an outbound call |
| `getCall` | `(correlationId: CorrelationId): ICall` | Retrieves a call by correlation ID |

### Events Emitted

| Event | Enum | Payload | Trigger |
|-------|------|---------|---------|
| `connecting` | `LINE_EVENTS.CONNECTING` | _(none)_ | `register()` called |
| `registered` | `LINE_EVENTS.REGISTERED` | `ILine` | Device registration succeeded |
| `unregistered` | `LINE_EVENTS.UNREGISTERED` | _(none)_ | Device deregistered |
| `reconnecting` | `LINE_EVENTS.RECONNECTING` | _(none)_ | Keepalive failure, attempting recovery |
| `reconnected` | `LINE_EVENTS.RECONNECTED` | _(none)_ | Recovery succeeded |
| `error` | `LINE_EVENTS.ERROR` | `LineError` | Registration or line error |
| `line:incoming_call` | `LINE_EVENTS.INCOMING_CALL` | `ICall` | Incoming call from Mobius |

---

## Examples

### Listening to Line Events

```typescript
const lines = callingClient.getLines();
const line = Object.values(lines)[0];

line.on('connecting', () => {
  console.log('Registration in progress...');
});

line.on('registered', (lineInfo) => {
  console.log('Registered! Phone:', lineInfo.phoneNumber);
  console.log('Extension:', lineInfo.extension);
  console.log('SIP:', lineInfo.sipAddresses);
});

line.on('reconnecting', () => {
  console.log('Lost connection, reconnecting...');
});

line.on('reconnected', () => {
  console.log('Reconnected successfully');
});

line.on('error', (error) => {
  console.error('Line error:', error.getError());
});

line.on('line:incoming_call', (call) => {
  console.log('Incoming call!');
  call.answer(localAudioStream);
});
```

### Making an Outbound Call

```typescript
const call = line.makeCall({type: 'uri', address: 'sip:bob@example.com'});

if (call) {
  call.on('established', () => console.log('Call connected'));
  call.on('disconnect', () => console.log('Call ended'));
  call.dial(localAudioStream);
}
```

### Checking Registration Status

```typescript
const status = line.getStatus(); // 'IDLE' | 'active' | 'inactive'
const deviceId = line.getDeviceId();
const mobiusUrl = line.getActiveMobiusUrl();
```

---

## Constructor Parameters

```typescript
constructor(
  userId: string,                              // Webex user ID
  clientDeviceUri: string,                     // Device URL from webex.internal.device.url
  mutex: Mutex,                                // Shared mutex for registration serialization
  primaryMobiusUris: string[],                 // Primary Mobius server URIs
  backupMobiusUris: string[],                  // Backup Mobius server URIs
  logLevel: LOGGER,                            // Log verbosity
  serviceDataConfig?: CallingClientConfig['serviceData'],  // Backend config
  jwe?: string,                                // Optional JWE token
  phoneNumber?: string,                        // Optional initial phone number
  extension?: string,                          // Optional initial extension
  voicemail?: string,                          // Optional voicemail number
)
```

---

## Types

### LINE_EVENTS Enum

```typescript
export enum LINE_EVENTS {
  CONNECTING = 'connecting',
  ERROR = 'error',
  RECONNECTED = 'reconnected',
  RECONNECTING = 'reconnecting',
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
  INCOMING_CALL = 'line:incoming_call',
}
```

### LineEmitterCallback

```typescript
type LineEmitterCallback = (
  event: LINE_EVENTS,
  deviceInfo?: IDeviceInfo,
  clientError?: LineError,
) => void;
```

### LineErrorEmitterCallback

```typescript
type LineErrorEmitterCallback = (err: LineError, finalError?: boolean) => void;
```

---

## Related Documentation

- [Line Architecture](./ARCHITECTURE.md) — Internal flow, lineEmitter pattern, normalization
- [CallingClient AGENTS.md](../../ai-docs/AGENTS.md) — Parent module overview
- [Registration AGENTS.md](../../registration/ai-docs/AGENTS.md) — Registration details
- [Event Patterns](../../../../ai-docs/patterns/event-patterns.md) — Typed event system

---

_Last Updated: 2026-03-15_
