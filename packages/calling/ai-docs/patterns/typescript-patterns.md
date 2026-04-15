# TypeScript Patterns

> Quick reference for LLMs working with TypeScript in the `@webex/calling` package.

---

## Rules

- **MUST** prefix all interfaces with `I` (e.g., `ICall`, `ILine`, `ICallingClient`)
- **MUST** use PascalCase for class names and interfaces
- **MUST** use camelCase for functions, methods, and local variables
- **MUST** use SCREAMING_SNAKE_CASE for constants and enum members where appropriate
- **MUST** use `.ts` extension for all source files (no `.tsx` — this is a non-UI SDK package)
- **MUST** co-locate types in `types.ts` files within each module directory
- **MUST** document every interface property and public method with JSDoc comments
- **MUST** use enums for event names, error codes, and string constants
- **MUST** use `type` for object shapes and `interface` for contracts that classes implement
- **MUST** export public API through `src/api.ts`
- **NEVER** use `any` without an ESLint disable comment and explanation
- **NEVER** duplicate type definitions — derive from source or import from shared locations

---

## Naming Conventions

### Classes and File Names

Both class names and their file names use PascalCase:

| Class Name | File Name |
|------------|-----------|
| `CallingClient` | `CallingClient.ts` |
| `CallManager` | `callManager.ts` |
| `SDKConnector` | `index.ts` (in `SDKConnector/`) |
| `Call` | `call.ts` |
| `Line` | `index.ts` (in `line/`) |

### Interfaces

```typescript
// PascalCase with 'I' prefix — represent contracts for classes
interface ICall { ... }
interface ILine { ... }
interface ICallingClient { ... }
interface ICallManager { ... }
interface ISDKConnector { ... }
interface IMetricManager { ... }
```

### Type Aliases

```typescript
// PascalCase, no prefix — used for object shapes and primitives
type CallId = string;
type CorrelationId = string;
type DisplayInformation = { ... };
type WebexRequestPayload = { ... };
type MobiusServers = { ... };
```

### Enums

The codebase uses mixed enum casing conventions due to historical reasons:

| Convention | Used For | Example |
|-----------|---------|---------|
| `SCREAMING_SNAKE_CASE` name + members | Event keys, error codes, constants | `CALL_EVENT_KEYS`, `ERROR_TYPE`, `ERROR_CODE` |
| `PascalCase` name + `PascalCase` members | Domain value enums | `CallDirection`, `RegistrationStatus`, `SessionType` |
| `PascalCase` name + `SCREAMING_SNAKE_CASE` members | Backend/service enums | `CALLING_BACKEND` |

When creating new enums, prefer `SCREAMING_SNAKE_CASE` for both name and members if the enum represents constants/keys, and `PascalCase` for value enums:

```typescript
enum CALL_EVENT_KEYS { ... }    // Event key constants
enum ERROR_TYPE { ... }          // Error classification constants
enum CallDirection { ... }       // Domain values
enum RegistrationStatus { ... }  // Domain values
```

### Constants

```typescript
// SCREAMING_SNAKE_CASE
const MAX_RETRY_COUNT = 3;
const DEFAULT_SESSION_TIMER = 180;
const ICE_CANDIDATES_TIMEOUT = 3000;
```

### File Structure

```
packages/calling/src/{Module}/
├── {Module}.ts          # Main implementation
├── types.ts             # Types and interfaces for this module
├── constants.ts         # Module-specific constants
└── {Module}.test.ts     # Co-located unit tests
```

---

## Module Directory Layout

```
packages/calling/src/
├── api.ts                          # Public API re-exports
├── index.ts                        # Package entry point
├── common/
│   ├── types.ts                    # Shared types (CallId, enums, etc.)
│   ├── constants.ts                # Shared constants
│   ├── Utils.ts                    # Shared utilities
│   └── testUtil.ts                 # Test utilities
├── CallingClient/
│   ├── CallingClient.ts
│   ├── types.ts
│   ├── constants.ts
│   ├── calling/
│   │   ├── call.ts
│   │   ├── callManager.ts
│   │   ├── types.ts
│   │   └── CallerId/
│   ├── line/
│   │   ├── index.ts
│   │   └── types.ts
│   └── registration/
├── CallHistory/
├── CallSettings/
├── Contacts/
├── Voicemail/
├── Events/
│   ├── impl/index.ts               # Eventing base class
│   └── types.ts                    # Event type maps and enums
├── Errors/
│   ├── types.ts                    # Error enums and base types
│   ├── index.ts                    # Re-exports
│   └── catalog/                    # Error class implementations
├── Logger/
├── Metrics/
└── SDKConnector/
```

---

## Interface Patterns

### Pattern 1: Class Contract Interface

```typescript
export interface ICall extends Eventing<CallEventTypes> {
  lineId: string;
  isMuted(): boolean;
  isConnected(): boolean;
  isHeld(): boolean;
  dial(localAudioStream: LocalMicrophoneStream): Promise<void>;
  answer(localAudioStream: LocalMicrophoneStream): Promise<void>;
  end(): void;
  doHoldResume(): void;
  sendDigit(tone: string): Promise<void>;
  mute(localAudioStream: LocalMicrophoneStream): void;
  completeTransfer(transferType: TransferType, ...args: string[]): void;
}
```

### Pattern 2: Typed Event Maps

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
  [CALL_EVENT_KEYS.RESUMED]: (callId: CallId) => void;
};
```

### Pattern 3: Discriminated Union Types

```typescript
export type CallEvent =
  | {type: 'E_RECV_CALL_SETUP'; data?: unknown}
  | {type: 'E_RECV_CALL_PROGRESS'; data?: unknown}
  | {type: 'E_RECV_CALL_CONNECT'; data?: unknown}
  | {type: 'E_RECV_CALL_DISCONNECT'; data?: unknown}
  | {type: 'E_SEND_CALL_SETUP'; data?: unknown}
  | {type: 'E_SEND_CALL_ALERTING'; data?: unknown}
  | {type: 'E_SEND_CALL_CONNECT'; data?: unknown}
  | {type: 'E_SEND_CALL_DISCONNECT'; data?: unknown}
  | {type: 'E_CALL_ESTABLISHED'; data?: unknown}
  | {type: 'E_CALL_CLEARED'; data?: unknown}
  | {type: 'E_CALL_HOLD'; data?: unknown}
  | {type: 'E_CALL_RESUME'; data?: unknown};
```

---

## Enum Patterns

### Event Key Enums

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
  REGISTERED = 'registered',
  UNREGISTERED = 'unregistered',
  INCOMING_CALL = 'line:incoming_call',
}

export enum CALLING_CLIENT_EVENT_KEYS {
  ERROR = 'callingClient:error',
  OUTGOING_CALL = 'callingClient:outgoing_call',
  ALL_CALLS_CLEARED = 'callingClient:all_calls_cleared',
}
```

### Error Code Enums

```typescript
export enum ERROR_TYPE {
  CALL_ERROR = 'call_error',
  DEFAULT = 'default_error',
  BAD_REQUEST = 'bad_request',
  FORBIDDEN_ERROR = 'forbidden',
  NOT_FOUND = 'not_found',
  REGISTRATION_ERROR = 'registration_error',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  TIMEOUT = 'timeout',
  TOKEN_ERROR = 'token_error',
}

export enum ERROR_CODE {
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  DEVICE_NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}
```

### Value Enums

```typescript
export enum CallDirection {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

export enum RegistrationStatus {
  IDLE = 'IDLE',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export enum CALLING_BACKEND {
  WXC = 'WEBEX_CALLING',
  BWRKS = 'BROADWORKS_CALLING',
  UCM = 'UCM_CALLING',
}
```

---

## JSDoc Pattern

```typescript
/**
 * Represents an interface for managing a telephony line.
 */
export interface ILine extends Eventing<LineEventTypes> {
  /**
   * The unique identifier of the user associated with the line.
   */
  userId: string;

  /**
   * Registers the line.
   */
  register(): void;

  /**
   * Initiates a call to the specified destination.
   *
   * @param dest - The call details including destination information.
   *
   * @example
   * ```typescript
   * const callDetails: CallDetails = {type: 'uri', address: 'example@webex.com'};
   * const callObj: ICall = line.makeCall(callDetails);
   * ```
   */
  makeCall(dest?: CallDetails): ICall | undefined;
}
```

---

## Import Patterns

### Internal Module Imports

```typescript
// Relative imports within the package
import {Eventing} from '../../Events/impl';
import {CALL_EVENT_KEYS, CallEventTypes} from '../../Events/types';
import {CallError, createCallError} from '../../Errors/catalog/CallError';
import {CallDirection, CallId, CorrelationId} from '../../common/types';
import SDKConnector from '../../SDKConnector';
import log from '../../Logger';
```

### External Dependency Imports

```typescript
import {createMachine, interpret} from 'xstate';
import {v4 as uuid} from 'uuid';
import {Mutex} from 'async-mutex';
import {RoapMediaConnection, LocalMicrophoneStream} from '@webex/internal-media-core';
```

---

## Type Export Pattern

### Public API Exports (api.ts)

```typescript
// Interfaces
export {ILine, ICall, ICallHistory, ICallSettings, ICallingClient, IContacts, IVoicemail};

// Classes
export {CallHistory, CallSettings, CallingClient, ContactsClient, Voicemail};

// Types (use `export type` for type-only exports)
export type {ContactGroup, Contact, CallForwardSetting, VoicemailSetting};

// Factory Methods
export {
  createCallHistoryClient,
  createCallSettingsClient,
  createClient,
  createContactsClient,
  createVoicemailClient,
};
```

---

## Callback and Logging Pattern

### Logging Context Object

All log calls take a message string and a context object with `file` and `method` fields. The Logger module (`src/Logger/index.ts`) defines five log levels via the `LOGGING_LEVEL` enum with a cumulative threshold — setting level `n` enables all levels from 1 through `n`. The default level is `error` (1). Use log levels as follows, listed from lowest (most critical) to highest (most verbose):

| Level | `LOGGING_LEVEL` | Method | Format Prefix | When to Use | Example |
|-------|-----------------|--------|---------------|-------------|---------|
| 1 | `error` | `log.error()` | `[ERROR]` | Unrecoverable failures, critical errors | Device registration failed, unhandled exception |
| 2 | `warn` | `log.warn()` | `[WARN]` | Recoverable issues, degraded behavior, fallbacks | Invalid metric name received, missing optional config |
| 3 | `log` | `log.log()` | `[LOG]` | General-purpose operational messages, method entry/exit for non-critical paths | All calls cleared, setting Mobius servers |
| 4 | `info` | `log.info()` | `[INFO]` | Normal operations, method entry/exit, state transitions (most heavily used level) | Starting registration, call connected, listener registered |
| 5 | `trace` | `log.trace()` | `[TRACE]` | Full call-path stack traces for deep debugging (not currently used in production code) | Detailed diagnostic tracing |

All log output is formatted as: `CALLING_SDK: <UTC timestamp>: [LEVEL]: file:<filename> - method:<methodName> - message:<log message>`

```typescript
log.error(`Device creation failed: ${err}`, {
  file: CALLING_CLIENT_FILE,
  method: 'createDevice',
});

log.warn('Invalid metric name received. Rejecting request to submit metric.', {
  file: METRIC_MANAGER_FILE,
  method: this.submitMetric.name,
});

log.log('All calls have been cleared', {
  file: CALL_MANAGER_FILE,
  method: METHODS.DEQUEUE_WS_EVENTS,
});

log.info('Starting registration', {
  file: CALLING_CLIENT_FILE,
  method: 'register',
});

log.trace('Detailed diagnostic trace', {
  file: CALLING_CLIENT_FILE,
  method: 'init',
});
```

### Delete/Cleanup Callback

```typescript
type DeleteRecordCallBack = (correlationId: CorrelationId) => void;

const newCall = createCall(
  this.activeMobiusUrl,
  this.webex,
  direction,
  deviceId,
  lineId,
  (correlationId: CorrelationId) => {
    delete this.callCollection[correlationId];
  },
  this.serviceIndicator,
  destination
);
```

---

## Related

- [Architecture Patterns](./architecture-patterns.md)
- [Event Patterns](./event-patterns.md)
- [Error Handling Patterns](./error-handling-patterns.md)
- [Testing Patterns](./testing-patterns.md)

