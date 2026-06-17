# Line Module

## AI Agent Routing Instructions

**If you are an AI assistant or automated tool:**

- **First step:** Load the parent [CallingClient/ai-docs/AGENTS.md](../../ai-docs/AGENTS.md) for module-level context.
- **For registration-specific changes:** Also load [registration/ai-docs/AGENTS.md](../../registration/ai-docs/AGENTS.md).

---

## Overview

The `Line` class represents a single telephony line registered with the Webex Calling (Mobius) backend. It is the primary interface through which applications interact with calling capabilities — making calls, receiving incoming calls, and monitoring registration state.

A `Line` is created internally by `CallingClient.createLine()` during initialization. Applications access it via `callingClient.getLines()`.

**File:** `packages/calling/src/CallingClient/line/index.ts`

**Class:** `Line extends Eventing<LineEventTypes> implements ILine`

---

### Key Capabilities

The Line module is responsible for:

- **Exposing public registration API** — `register()` and `deregister()` for applications to control line registration state
- **Emitting line events to the application** — Provides the `lineEmitter` callback that `Registration` uses to signal state changes, which Line then re-emits as `LineEventTypes`
- **Incoming call forwarding** — Listens for `incoming_call` from `CallManager` and re-emits as `LINE_EVENTS.INCOMING_CALL`
- **Outbound call initiation** — Creates calls via `CallManager.createCall()` and returns the `ICall` object
- **Line normalization** — Populates line properties (SIP addresses, extension, voicemail, etc.) from device registration response
- **Registration orchestration** — Delegates to `Registration` but manages the mutex to prevent concurrent registration

---

## Line Object

### Constructor Parameters

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
  phoneNumber?: string,                        // Optional initial phone number (from provisioning)
  extension?: string,                          // Optional initial extension
  voicemail?: string,                          // Optional voicemail number
)
```

### ILine Interface

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `userId` | `string` | User ID associated with the line |
| `clientDeviceUri` | `string` | Device URI from Webex SDK |
| `lineId` | `string` | Unique line identifier (UUID) |
| `mobiusDeviceId` | `string?` | Mobius device ID (set after registration) |
| `phoneNumber` | `string?` | Phone number (set from provisioning data at construction) |
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

#### Methods / Public API

| Method | Signature | Description |
|--------|-----------|-------------|
| `register` | `(): Promise<void>` | Registers the line with Mobius (acquires mutex, emits CONNECTING, delegates to Registration) |
| `deregister` | `(): Promise<void>` | Deregisters the line (delegates to Registration, sets status IDLE) |
| `getActiveMobiusUrl` | `(): string` | Returns the currently active Mobius server URL |
| `getStatus` | `(): RegistrationStatus` | Returns current registration status (`IDLE`, `active`, `inactive`) |
| `getDeviceId` | `(): MobiusDeviceId \| undefined` | Returns the Mobius device ID |
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

This section covers three key aspects:

1. **Fetching and Managing Line Objects / Registration**
2. **Listening for Line Events**
3. **Working with Calls (Call API)**

---

### 1. Fetching Created Line Objects & Invoking Registration Methods

```typescript
// Get all line objects (if lines already exist)
const lines = callingClient.getLines();
const line = Object.values(lines)[0];

// Register the line: triggers connection to Mobius, acquiring mutex, emitting events, etc.
await line.register();

// Optionally, check registration status and get IDs
const status = line.getStatus(); // 'IDLE' | 'active' | 'inactive'
const deviceId = line.getDeviceId();
const mobiusUrl = line.getActiveMobiusUrl();

// Deregister the line
await line.deregister();
```

---

### 2. Listening for Line Events

```typescript
// Attach event listeners for registration lifecycle, errors, and incoming calls
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

### 3. Making and Handling Outbound Calls

```typescript
// Initiate an outbound call after registration
const call = line.makeCall({type: 'uri', address: 'sip:bob@example.com'});

if (call) {
  call.on('established', () => console.log('Call connected'));
  call.on('disconnect', () => console.log('Call ended'));
  call.dial(localAudioStream);
}
```

> **Note:** For detailed information on handling of the outbound call flow refer to the following references:
>
> 1. `line.makeCall()` — validates the destination and delegates to `callManager.createCall()`. See `src/CallingClient/line/index.ts` (`makeCall` method).
> 2. `callManager.createCall()` — instantiates a new `Call` object via the `createCall` factory. See `src/CallingClient/calling/callManager.ts` (`createCall` method).
> 3. `call.dial()` — initiates the media session with a `LocalMicrophoneStream`. See `src/CallingClient/calling/call.ts` (`dial` method).
> 4. Outbound call state machine handlers in `src/CallingClient/calling/call.ts`:
>    - `handleOutgoingCallSetup` — sends the initial call setup request to Mobius
>    - `handleOutgoingCallAlerting` — processes the alerting/ringing state
>    - `handleOutgoingCallConnect` — handles call establishment
>    - `handleOutgoingCallDisconnect` — handles call teardown
>    - `handleOutgoingRoapOffer` / `handleOutgoingRoapAnswer` — WebRTC ROAP media negotiation

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

### LineErrorEmitterCallback and Error Handling in `Line`

```typescript
/**
 * This callback is used for emitting errors related to the `Line` class.
 * The error is represented by a `LineError` object (sometimes called `LineErrorObject`).
 * The optional `finalError` boolean indicates if this is the terminal error state for the operation.
 */
type LineErrorEmitterCallback = (err: LineError, finalError?: boolean) => void;
```

#### LineError

The `LineError` object encapsulates structured information about errors occurring during Line operations. It typically includes:

- A human-readable error message (e.g., explaining the user-level issue, such as invalid numbers).
- An error data payload (for debugging or UI).
- A specific error type (`ERROR_TYPE`), identifying the domain of the failure (e.g., registration, call errors).
  - See `ERROR_TYPE` enum in `src/Errors/types.ts`.
- Optionally, a registration status describing the state when the error occurred.
  - See `RegistrationStatus` enum in `src/common/types.ts`.

> **File references:**
> - `LineError` class and `createLineError` factory — `src/Errors/catalog/LineError.ts`
> - `LineErrorObject` type definition — `src/Errors/types.ts`

Inside [`@packages/calling/src/CallingClient/line/index.ts`](../index.ts):

- All major asynchronous operations (such as `makeCall`, `register`, etc.) are instrumented with structured error handling.
  - See `makeCall` in `src/CallingClient/line/index.ts` (invalid phone number path).
- When an error occurs that should be signaled to clients, a `LineError` object is constructed with descriptive details and relevant context.
  - See `new LineError(...)` in `src/CallingClient/line/index.ts`.
  - See `createLineError(...)` in `src/common/Utils.ts` (used by `handleRegistrationErrors` and `emitFinalFailure`).
- This error object is emitted via the `LINE_EVENTS.ERROR` event, using the `lineEmitter` method as the emission pathway.
  - See `lineEmitter` switch case for `LINE_EVENTS.ERROR` in `src/CallingClient/line/index.ts`.
  - See registration error callbacks in `src/CallingClient/registration/register.ts` (`attemptRegistrationWithServers`, keepalive worker `onmessage`).
- Listeners on the `Line` instance (using `line.on(LINE_EVENTS.ERROR, ...)`) can receive, log, display, or escalate these errors through the callback signature shown above.
  - See listener examples in `src/CallingClient/line/line.test.ts`.

For example, in the implementation of `makeCall`:
- If the destination phone number is invalid, a `LineError` is created with a message and detail, and emitted to listeners using the error event. This ensures callers receive clear, structured error information, and can distinguish normal versus terminal errors using the `finalError` boolean.
  - See `src/CallingClient/line/index.ts` — the `else` branch of the phone number regex check in `makeCall`.

**Summary:**  
Error handling in the `Line` class centers on the use of the `LineError` object, with propagation through a typed emitter callback. This enables robust, structured, and type-safe error reporting to SDK consumers or UI components.

---

## Related Documentation

- [Line Architecture](./ARCHITECTURE.md) — Internal flow, lineEmitter pattern, normalization
- [CallingClient AGENTS.md](../../ai-docs/AGENTS.md) — Parent module overview
- [Registration AGENTS.md](../../registration/ai-docs/AGENTS.md) — Registration details
