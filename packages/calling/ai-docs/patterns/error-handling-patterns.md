# Error Handling Patterns

> Quick reference for LLMs working with errors in the `@webex/calling` package.

---

## Rules

- **MUST** use the error class hierarchy (`ExtendedError` → `CallError` / `LineError` / `CallingClientError`)
- **MUST** use factory functions (`createCallError`, `createLineError`, `createClientError`) to instantiate errors
- **MUST** use `ERROR_TYPE` enum for error classification
- **MUST** use `ERROR_LAYER` enum to distinguish call control vs media errors
- **MUST** emit errors via typed events (e.g., `CALL_EVENT_KEYS.CALL_ERROR`, `LINE_EVENTS.ERROR`)
- **MUST** include `ErrorContext` (file and method) for traceability
- **MUST** use `handleCallErrors()` / `handleCallingClientErrors()` for HTTP/API error mapping
- **MUST** log errors and optionally upload logs for diagnostics
- **NEVER** throw raw `Error` objects — always use the typed error classes
- **NEVER** swallow errors silently — emit, log, or propagate

---

## Error Class Hierarchy

```
Error (native)
  └── ExtendedError
        ├── CallError          (call-level errors with correlationId + errorLayer)
        ├── LineError           (line/registration errors with status)
        └── CallingClientError  (client/device errors with status)
```

### ExtendedError (Base)

```typescript
export default class ExtendedError extends Error {
  public type: ERROR_TYPE;
  public context: ErrorContext;

  constructor(msg: ErrorMessage, context: ErrorContext, type: ERROR_TYPE) {
    super(msg);
    this.type = type || ERROR_TYPE.DEFAULT;
    this.context = context;
  }
}
```

### CallError

For errors occurring during an active call. Carries `correlationId` to associate with the specific call and `errorLayer` to indicate whether the issue is in call control or media.

```typescript
export class CallError extends ExtendedError {
  private correlationId: CorrelationId;
  private errorLayer: ERROR_LAYER;

  constructor(
    msg: ErrorMessage,
    context: ErrorContext,
    type: ERROR_TYPE,
    correlationId: CorrelationId,
    errorLayer: ERROR_LAYER
  ) {
    super(msg, context, type);
    this.correlationId = correlationId;
    this.errorLayer = errorLayer;
  }

  public getCallError(): CallErrorObject {
    return {
      message: this.message,
      context: this.context,
      type: this.type,
      correlationId: this.correlationId,
      errorLayer: this.errorLayer,
    };
  }

  public setCallError(error: CallErrorObject) {
    this.message = error.message;
    this.correlationId = error.correlationId;
    this.context = error.context;
    this.type = error.type;
  }
}
```

### LineError

For line registration and deregistration errors. Carries `status` to indicate the registration state.

```typescript
export class LineError extends ExtendedError {
  public status: RegistrationStatus = RegistrationStatus.INACTIVE;

  constructor(
    msg: ErrorMessage,
    context: ErrorContext,
    type: ERROR_TYPE,
    status: RegistrationStatus
  ) {
    super(msg, context, type);
    this.status = status;
  }

  public getError(): LineErrorObject {
    return {
      message: this.message,
      context: this.context,
      type: this.type,
      status: this.status,
    };
  }
}
```

### CallingClientError

For client and device-level errors (device registration, Mobius discovery, etc.).

```typescript
export class CallingClientError extends ExtendedError {
  public status: RegistrationStatus = RegistrationStatus.INACTIVE;

  constructor(
    msg: ErrorMessage,
    context: ErrorContext,
    type: ERROR_TYPE,
    status: RegistrationStatus
  ) {
    super(msg, context, type);
    this.status = status;
  }

  public getError(): ErrorObject {
    return {message: this.message, context: this.context, type: this.type};
  }
}
```

---

## Factory Functions

Always use factory functions instead of `new` for error instantiation.

```typescript
// Call error
const error = createCallError(
  'Hold operation failed',
  {file: CALL_FILE, method: 'doHoldResume'},
  ERROR_TYPE.CALL_ERROR,
  this.correlationId,
  ERROR_LAYER.CALL_CONTROL
);

// Line error
const error = createLineError(
  'Registration failed',
  {file: 'line/index.ts', method: 'register'},
  ERROR_TYPE.REGISTRATION_ERROR,
  RegistrationStatus.INACTIVE
);

// Client error
const error = createClientError(
  'Device creation failed',
  {file: CALLING_CLIENT_FILE, method: 'createDevice'},
  ERROR_TYPE.DEFAULT,
  RegistrationStatus.INACTIVE
);
```

---

## Error Type Enums

### ERROR_TYPE

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
  TOO_MANY_REQUESTS = 'too_many_requests',
  SERVER_ERROR = 'server_error',
}
```

### ERROR_LAYER

```typescript
export enum ERROR_LAYER {
  CALL_CONTROL = 'call_control',
  MEDIA = 'media',
}
```

### ERROR_CODE (HTTP status mapping)

```typescript
export enum ERROR_CODE {
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  DEVICE_NOT_FOUND = 404,
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  SERVICE_UNAVAILABLE = 503,
  BAD_REQUEST = 400,
  REQUEST_TIMEOUT = 408,
  TOO_MANY_REQUESTS = 429,
}
```

### CALL_ERROR_CODE (domain-specific)

```typescript
export enum CALL_ERROR_CODE {
  INVALID_STATUS_UPDATE = 111,
  DEVICE_NOT_REGISTERED = 112,
  CALL_NOT_FOUND = 113,
  ERROR_PROCESSING = 114,
  USER_BUSY = 115,
  PARSING_ERROR = 116,
  TIMEOUT_ERROR = 117,
  NOT_ACCEPTABLE = 118,
  CALL_REJECTED = 119,
  NOT_AVAILABLE = 120,
}
```

---

## Error Handler Utilities

### handleCallErrors

Maps HTTP/API failures to `CallError` and optionally triggers retries.

```typescript
handleCallErrors(
  (error: CallError) => {
    this.emit(CALL_EVENT_KEYS.CALL_ERROR, error);
  },
  responsePayload,
  ERROR_LAYER.CALL_CONTROL,
  this.correlationId,
  {file: CALL_FILE, method: 'dial'},
  // optional retry callback
  () => this.retryOperation()
);
```

### handleCallingClientErrors

Maps errors to `CallingClientError` and returns an `abort` flag.

```typescript
const {abort} = handleCallingClientErrors(
  responsePayload,
  {file: CALLING_CLIENT_FILE, method: 'getMobiusServers'}
);

if (abort) {
  this.emit(CALLING_CLIENT_EVENT_KEYS.ERROR, callingClientError);
  return;
}
```

### serviceErrorCodeHandler

Internal utility that maps HTTP status codes to `ERROR_TYPE`.

```typescript
// 401 → ERROR_TYPE.TOKEN_ERROR
// 403 → ERROR_TYPE.FORBIDDEN_ERROR
// 404 → ERROR_TYPE.NOT_FOUND
// 408 → ERROR_TYPE.TIMEOUT
// 429 → ERROR_TYPE.TOO_MANY_REQUESTS
// 500 → ERROR_TYPE.SERVER_ERROR
// 503 → ERROR_TYPE.SERVICE_UNAVAILABLE
```

---

## Error Emission Pattern

### Call Errors

```typescript
// Direct emission
this.emit(CALL_EVENT_KEYS.CALL_ERROR, callError);

// Hold/Resume specific errors
this.emit(CALL_EVENT_KEYS.HOLD_ERROR, holdError);
this.emit(CALL_EVENT_KEYS.RESUME_ERROR, resumeError);
this.emit(CALL_EVENT_KEYS.TRANSFER_ERROR, transferError);
```

### Line Errors

```typescript
this.lineEmitter(LINE_EVENTS.ERROR, undefined, lineError);
```

### CallingClient Errors

```typescript
this.emit(CALLING_CLIENT_EVENT_KEYS.ERROR, callingClientError);
```

---

## Error Flow

```
API/WebSocket Error
        │
        ▼
handleCallErrors() / handleCallingClientErrors()
        │
        ├── Map HTTP status → ERROR_TYPE
        ├── Create typed error (CallError, LineError, etc.)
        │
        ▼
Emit via typed event
        │
        ├── CALL_EVENT_KEYS.CALL_ERROR
        ├── LINE_EVENTS.ERROR
        └── CALLING_CLIENT_EVENT_KEYS.ERROR
        │
        ▼
Optionally: submit metrics + uploadLogs()
```

---

## Log Upload Pattern

For critical errors, upload diagnostic logs to the server.

```typescript
try {
  await someOperation();
} catch (err) {
  const callError = createCallError(
    'Operation failed',
    {file: CALL_FILE, method: 'someOperation'},
    ERROR_TYPE.CALL_ERROR,
    this.correlationId,
    ERROR_LAYER.CALL_CONTROL
  );
  this.emit(CALL_EVENT_KEYS.CALL_ERROR, callError);
  uploadLogs(this.webex);
}
```

---

## Error Object Types

```typescript
export type ErrorObject = {
  message: ErrorMessage;
  type: ERROR_TYPE;
  context: ErrorContext;
};

export interface LineErrorObject extends ErrorObject {
  status: RegistrationStatus;
}

export interface CallErrorObject extends ErrorObject {
  correlationId: CorrelationId;
  errorLayer: ERROR_LAYER;
}

export interface ErrorContext {
  file: string;
  method: string;
}
```

---

## Related

- [Architecture Patterns](./architecture-patterns.md)
- [Event Patterns](./event-patterns.md)
- [State Machine Patterns](./state-machine-patterns.md)
- [Testing Patterns](./testing-patterns.md)
