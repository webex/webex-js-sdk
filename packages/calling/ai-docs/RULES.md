# @webex/calling - Coding Standards & Rules

> All rules derived from actual calling package conventions. When in doubt, follow existing code patterns.

---

## TypeScript Standards

- **Strict mode** is enforced via `tsconfig.json`
- **Avoid `any`** - prefer `unknown` with type narrowing. If `any` is truly necessary, add an ESLint disable comment with justification.
- **Explicit return types** on all public API methods
- **No implicit `any`** in function parameters
- All source files use `.ts` extension
- All test files use `test.ts` extension

---

## File Naming

| File Type        | Convention                       | Examples                                             |
| ---------------- | -------------------------------- | ---------------------------------------------------- |
| Main class       | PascalCase                       | `CallingClient.ts`, `CallHistory.ts`, `Voicemail.ts` |
| Sub-module class | camelCase                        | `call.ts`, `callManager.ts`, `register.ts`           |
| Type definitions | `types.ts`                       | `CallingClient/types.ts`, `common/types.ts`          |
| Constants        | `constants.ts`                   | `CallingClient/constants.ts`, `common/constants.ts`  |
| Test files       | `*.test.ts` (co-located)         | `CallingClient.test.ts`, `call.test.ts`              |
| Test fixtures    | `*Fixtures.ts` or `*fixtures.ts` | `callingClientFixtures.ts`, `registerFixtures.ts`    |
| Index files      | `index.ts`                       | `Logger/index.ts`, `SDKConnector/index.ts`           |

---

## Naming Conventions

| Element        | Convention                                   | Examples                                                                                 |
| -------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Classes        | PascalCase                                   | `CallingClient`, `CallHistory`, `Registration`, `CallManager`                            |
| Interfaces     | `I` prefix + PascalCase                      | `ICall`, `ILine`, `ICallingClient`, `IRegistration`, `ICallManager`, `ICallerId`         |
| Type aliases   | PascalCase                                   | `CallId`, `CorrelationId`, `MobiusDeviceId`, `DisplayInformation`, `WebexRequestPayload` |
| Enums          | PascalCase name, SCREAMING_SNAKE_CASE values | `CALL_EVENT_KEYS.PROGRESS`, `ERROR_TYPE.CALL_ERROR`, `METRIC_EVENT.CALL`                 |
| Constants      | SCREAMING_SNAKE_CASE                         | `DISCOVERY_URL`, `DEFAULT_KEEPALIVE_INTERVAL`, `NETWORK_FLAP_TIMEOUT`                    |
| Methods        | camelCase                                    | `getLines()`, `makeCall()`, `doHoldResume()`, `triggerRegistration()`                    |
| Private fields | `private` keyword                            | `private webex: WebexSDK`, `private metricManager: IMetricManager`                       |
| Event keys     | SCREAMING_SNAKE_CASE in enum                 | `CALL_EVENT_KEYS.ESTABLISHED`, `LINE_EVENT_KEYS.INCOMING_CALL`                           |

---

## Logging Standards

### Logger Module

Use the Logger module (`src/Logger/index.ts`), never `console.log`:

```typescript
import log from '../Logger';

// Always provide file and method names in logger context
log.info('Registration successful', {file: REGISTRATION_FILE, method: 'triggerRegistration'});
log.error('Registration failed', {file: REGISTRATION_FILE, method: 'triggerRegistration'});
log.warn('Retrying registration', {file: REGISTRATION_FILE, method: 'reconnectOnFailure'});
log.trace('Detailed debug info', {file: CALL_FILE, method: 'dial'});
log.log('General message', {file: LINE_FILE, method: 'register'});
```

### Log Format

```
webex-calling: <timestamp>: [LEVEL]: file:<file> - method:<method> - message:<message>
```

Example output:

```
webex-calling: Thu, 15 Mar 2026 10:30:00 GMT: [INFO]: file:CallingClient - method:init - message:Initialization complete
```

### Log Levels (in order)

| Level   | Numeric | Purpose                  |
| ------- | ------- | ------------------------ |
| `error` | 1       | Errors only              |
| `warn`  | 2       | Warnings + errors        |
| `log`   | 3       | General messages + above |
| `info`  | 4       | Informational + above    |
| `trace` | 5       | Full stack trace + above |

Log levels are cumulative — setting level `n` means all levels from 1 through `n` are logged. The default level is `error` (1). During SDK initialization, users can set the log level via `setLogger(level, module)`, which determines which log messages they will see at runtime.

### When to Use Each Level

| Level       | Use For                                                                                    | Example                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `log.info`  | Method entry and exit points — marks the start and completion of significant operations    | `log.info('makeCall initiated', {file: CALL_FILE, method: 'makeCall'});`                    |
| `log.log`   | API success details and important action outcomes — the substantive result of an operation | `log.log('Call connected successfully', {file: CALL_FILE, method: 'dial'});`                |
| `log.error` | Blocking failures that prevent an operation from completing                                | `log.error('Registration failed', {file: REGISTRATION_FILE, method: 'register'});`          |
| `log.warn`  | Non-blocking errors — something failed but execution can continue or a fallback was used   | `log.warn('Keepalive missed, will retry', {file: REGISTRATION_FILE, method: 'keepalive'});` |
| `log.trace` | Verbose debugging detail — full state dumps, raw payloads, internal decision paths         | `log.trace('ROAP offer details', {file: CALL_FILE, method: 'sendRoapOffer'});`              |

### File Constants for Logging

Use predefined file constants from `CallingClient/constants.ts`:

```typescript
export const CALLING_CLIENT_FILE = 'CallingClient';
export const LINE_FILE = 'line';
export const CALL_FILE = 'call';
export const CALL_MANAGER_FILE = 'callManager';
export const REGISTRATION_FILE = 'register';
export const METRIC_FILE = 'metric';
export const CALLER_ID_FILE = 'CallerId';
```

---

## Error Handling

### Error Class Hierarchy

```
ExtendedError (base)
├── CallError         - Call-level errors (with correlationId, errorLayer)
├── LineError         - Line/registration errors (with RegistrationStatus)
└── CallingClientError - Client-level errors (with RegistrationStatus)
```

### Error Types (`ERROR_TYPE` enum)

```typescript
enum ERROR_TYPE {
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

### Error Layers (`ERROR_LAYER` enum)

```typescript
enum ERROR_LAYER {
  CALL_CONTROL = 'call_control',
  MEDIA = 'media',
}
```

### Usage Pattern

```typescript
import {CallError, createCallError} from '../Errors/catalog/CallError';
import {ERROR_TYPE, ERROR_LAYER} from '../Errors/types';

// Create a call error
const error = createCallError(
  'Call setup failed',
  {file: CALL_FILE, method: 'dial'},
  ERROR_TYPE.CALL_ERROR,
  correlationId,
  ERROR_LAYER.CALL_CONTROL
);

// Always log errors with context
log.error('Call setup failed', {file: CALL_FILE, method: 'dial'});

// Emit error events with typed error objects
this.emit(CALL_EVENT_KEYS.CALL_ERROR, error);
```

### Rules

- Never swallow errors silently - always log with context
- Always emit error events so consumers can react
- Use the appropriate error class for the scope (CallError for calls, LineError for lines, CallingClientError for client-level)
- Include `file` and `method` in error context

---

## Metrics Standards

### MetricManager

Use the singleton `MetricManager` (`src/Metrics/index.ts`) via factory function:

```typescript
import {getMetricManager} from '../Metrics';

const metricManager = getMetricManager(webex, serviceIndicator);
```

### Metric Types

```typescript
enum METRIC_TYPE {
  OPERATIONAL = 'operational',
  BEHAVIORAL = 'behavioral',
}
```

### Metric Events (`METRIC_EVENT` enum)

| Event                 | Purpose                           |
| --------------------- | --------------------------------- |
| `REGISTRATION`        | Successful registration           |
| `REGISTRATION_ERROR`  | Registration failure              |
| `KEEPALIVE_ERROR`     | Keepalive failure                 |
| `CALL`                | Call control event                |
| `CALL_ERROR`          | Call control error                |
| `MEDIA`               | Media event                       |
| `MEDIA_ERROR`         | Media error                       |
| `CONNECTION_ERROR`    | Connection event                  |
| `VOICEMAIL`           | Voicemail operation               |
| `VOICEMAIL_ERROR`     | Voicemail error                   |
| `UPLOAD_LOGS_SUCCESS` | Log upload success                |
| `UPLOAD_LOGS_FAILED`  | Log upload failure                |
| `MOBIUS_DISCOVERY`    | Mobius server discovery           |
| `BNR_ENABLED`         | Background noise removal enabled  |
| `BNR_DISABLED`        | Background noise removal disabled |

### IMetricManager Methods

| Method                           | Purpose                      |
| -------------------------------- | ---------------------------- |
| `submitRegistrationMetric(...)`  | Registration success/failure |
| `submitCallMetric(...)`          | Call control events          |
| `submitMediaMetric(...)`         | Media events                 |
| `submitConnectionMetrics(...)`   | Network connection events    |
| `submitVoicemailMetric(...)`     | Voicemail operations         |
| `submitUploadLogsMetric(...)`    | Log upload events            |
| `submitBNRMetric(...)`           | Background noise removal     |
| `submitRegionInfoMetric(...)`    | Region discovery             |
| `submitMobiusServersMetric(...)` | Mobius server discovery      |

### Rules

- Submit metrics for both success and failure paths
- Include `callId` and `correlationId` for call-related metrics
- Include `trackingId` for registration metrics
- Set device info via `setDeviceInfo()` after registration

---

## Event Standards

### Eventing Base Class

All event emitters extend `Eventing<T>` from `src/Events/impl/index.ts`, which wraps `typed-emitter`:

```typescript
import {Eventing} from '../Events/impl';
import {CallEventTypes} from '../Events/types';

class Call extends Eventing<CallEventTypes> implements ICall {
  // ...
}
```

### Event Key Enums

| Enum                        | Scope            | Key Values                                                                                                                                                                   |
| --------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CALL_EVENT_KEYS`           | Call events      | `ALERTING`, `CONNECT`, `ESTABLISHED`, `HELD`, `RESUMED`, `DISCONNECT`, `REMOTE_MEDIA`, `CALLER_ID`, `CALL_ERROR`, `HOLD_ERROR`, `RESUME_ERROR`, `TRANSFER_ERROR`, `PROGRESS` |
| `LINE_EVENT_KEYS`           | Line events      | `INCOMING_CALL`                                                                                                                                                              |
| `CALLING_CLIENT_EVENT_KEYS` | Client events    | `ERROR`, `OUTGOING_CALL`, `USER_SESSION_INFO`, `ALL_CALLS_CLEARED`                                                                                                           |
| `COMMON_EVENT_KEYS`         | Shared events    | `CB_VOICEMESSAGE_CONTENT_GET`, `CALL_HISTORY_USER_SESSION_INFO`, `CALL_HISTORY_USER_VIEWED_SESSIONS`, `CALL_HISTORY_USER_SESSIONS_DELETED`                                   |
| `MOBIUS_EVENT_KEYS`         | WebSocket events | `SERVER_EVENT_INCLUSIVE`, `CALL_SESSION_EVENT_INCLUSIVE`, `CALL_SESSION_EVENT_LEGACY`, `CALL_SESSION_EVENT_VIEWED`, `CALL_SESSION_EVENT_DELETED`                             |

### Event Type Maps

```typescript
// Each event key maps to a typed callback signature
type CallEventTypes = {
  [CALL_EVENT_KEYS.PROGRESS]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.CALL_ERROR]: (error: CallError) => void;
  [CALL_EVENT_KEYS.CONNECT]: (callId: CallId) => void;
  // ...
};
```

### Rules

- **Always use enum constants** for event keys, never raw string literals
- **Type all event payloads** via event type maps
- **Use `on/off/emit`** from the `Eventing` base class
- **Log all emitted events** (handled automatically by `Eventing.emit()`)

---

## Testing Standards

For full testing patterns including test file location, mock setup, singleton mocking, Logger mocking, and test structure, see [`patterns/testing-patterns.md`](patterns/testing-patterns.md).

### Key Rules

- Tests are co-located with source files (`ModuleName.test.ts` alongside `ModuleName.ts`)
- Use test fixtures from `*Fixtures.ts` or `*fixtures.ts` files for mock data
- Mock singletons (`SDKConnector`, `CallManager`, `MetricManager`) at module level
- Never call real network endpoints in unit tests
- Cover both success and failure paths for every public method

---

## Import Standards

Follow this 3-tier import order:

```typescript
// 1. External packages
import {Machine} from 'xstate';
import {Mutex} from 'async-mutex';
import {v4 as uuid} from 'uuid';

// 2. Internal packages (within @webex)
import * as Media from '@webex/internal-media-core';

// 3. Relative imports (parent → sibling → child)
import {METRIC_EVENT, METRIC_TYPE} from '../Metrics/types';
import {CallError} from '../Errors';
import log from '../Logger';
import {CALL_FILE, METHODS} from './constants';
import {ICall} from './types';
```

### Export Standards

- Public types and interfaces: Export from module's `types.ts`
- Public factory functions: Export from `src/api.ts`
- Internal types: Keep in service-level `types.ts`, don't re-export from api
- Use named exports for types; default export for main class when only one primary export exists

---

## Module Organization

### Factory Functions

Every top-level module exposes a factory function:

```typescript
// CallingClient
export const createClient = async (webex: WebexSDK, config?: CallingClientConfig): Promise<ICallingClient> => { ... };

// Public factory exports from src/api.ts
export const createCallHistoryClient = (webex: WebexSDK, logger: LoggerInterface): ICallHistory => { ... };
export const createCallSettingsClient = (webex: WebexSDK, logger: LoggerInterface, useProdWebexApis?: boolean): ICallSettings => { ... };
export const createContactsClient = (webex: WebexSDK, logger: LoggerInterface): IContacts => { ... };
export const createVoicemailClient = (webex: WebexSDK, logger: LoggerInterface): IVoicemail => { ... };

// Internal singletons (not exported from src/api.ts)
export const getMetricManager = (webex?: WebexSDK, indicator?: ServiceIndicator): IMetricManager => { ... };
export const getCallManager = (webex: WebexSDK, indicator: ServiceIndicator): ICallManager => { ... };
```

### Per-Module File Structure

Each module should contain:

| File                          | Purpose                                         |
| ----------------------------- | ----------------------------------------------- |
| `ModuleName.ts` or `index.ts` | Main class implementation                       |
| `types.ts`                    | Interfaces, type aliases, enums for this module |
| `constants.ts`                | Constants for this module                       |
| `ModuleName.test.ts`          | Co-located unit tests                           |
| `*Fixtures.ts`                | Test mock data (optional)                       |

### Singleton Pattern

Used by `SDKConnector`, `CallManager`, and `MetricManager`:

```typescript
let instance: ISomeManager;

export const getSomeManager = (webex?: WebexSDK): ISomeManager => {
  if (!instance && webex) {
    instance = new SomeManager(webex);
  }
  return instance;
};
```

---

## Accessibility & Security

### No Hardcoded Credentials

Never commit:

- API keys, tokens, secrets
- Passwords or authentication data
- Private keys or certificates

### Sensitive Data Logging

Never log sensitive data:

```typescript
// ❌ WRONG
log.info(`User token: ${token}`, {file: CALL_FILE, method: 'dial'});

// ✅ CORRECT
log.info('Token received successfully', {file: CALL_FILE, method: 'dial'});
// No sensitive data in log messages
```

---

## Performance Standards

### Async/Await

Always use async/await over raw Promises:

```typescript
// ✅ CORRECT
public async makeCall(dest: CallDetails): Promise<ICall> {
  const call = await this.callManager.createCall(dest);
  return call;
}

// ❌ AVOID (when possible)
public makeCall(dest: CallDetails): Promise<ICall> {
  return this.callManager.createCall(dest).then(call => call);
}
```

### Cleanup on Deregistration

Always clean up resources when lines or calls are torn down:

```typescript
// Remove event listeners
line.off(LINE_EVENT_KEYS.INCOMING_CALL, this.handleIncomingCall);

// Clear timers and intervals
clearInterval(this.keepaliveTimer);

// Close connections
this.deregister();
```

---

## JSDoc Standards

All public APIs must have JSDoc:

````typescript
/**
 * Retrieves details of the line object(s) belonging to a user.
 *
 * @example
 * ```typescript
 * const lines = callingClient.getLines();
 * ```
 *
 * @returns Dictionary of line objects keyed by lineId.
 */
getLines(): Record<string, ILine>;
````

Required tags for public methods:

- `@example` with code snippet
- `@param` for each parameter
- `@returns` describing the return value
- `@throws` if the method can throw (optional)
- `@public` for explicitly public APIs

---

## Code Review Checklist

Before submitting code changes, verify:

- [ ] No `any` types without ESLint disable + justification
- [ ] JSDoc on all public APIs
- [ ] Logger used with `{ file, method }` context
- [ ] Metrics tracked for success and failure paths
- [ ] Error hierarchy followed (CallError/LineError/CallingClientError)
- [ ] Events typed and emitted with enum constants
- [ ] Unit tests added/updated
- [ ] No `console.log/warn/error`
- [ ] Import order follows 3-tier convention
- [ ] Constants defined in `constants.ts`, not inline
- [ ] Types defined in `types.ts`, not inline

---

## Need More Context?

- **TypeScript patterns**: [`patterns/typescript-patterns.md`](patterns/typescript-patterns.md)
- **Testing patterns**: [`patterns/testing-patterns.md`](patterns/testing-patterns.md)
- **Event patterns**: [`patterns/event-patterns.md`](patterns/event-patterns.md)
- **Error patterns**: [`patterns/error-handling-patterns.md`](patterns/error-handling-patterns.md)
