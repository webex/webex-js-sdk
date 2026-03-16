# @webex/calling Coding Standards

This document defines the coding standards and conventions for the `@webex/calling` package. All contributions must follow these rules.

---

## 1. TypeScript Standards

- **Strict mode** is enabled. Do not bypass the compiler with `@ts-ignore` unless absolutely necessary.
- **Never use `any`**. If a type cannot be determined, define a proper type or use `unknown`. Existing `eslint-disable` comments for `@typescript-eslint/no-explicit-any` are legacy and should not be copied into new code.
- **Explicit return types** are required on all public methods and exported functions.
- **Enums over union strings** -- prefer `enum` declarations for finite sets of values.
- **Null checks** -- use optional chaining (`?.`) and nullish coalescing where appropriate, as seen throughout `Metrics/index.ts` (e.g., `this.deviceInfo?.device?.deviceId`).

---

## 2. Naming Conventions

| Construct           | Convention                    | Example from codebase                                      |
|---------------------|-------------------------------|------------------------------------------------------------|
| Classes             | PascalCase                    | `CallingClient`, `CallManager`, `MetricManager`, `CallError` |
| Interfaces          | `I` prefix + PascalCase       | `ICall`, `ILine`, `ICallingClient`, `IRegistration`, `ISDKConnector`, `IMetricManager`, `IDeviceInfo` |
| Types               | PascalCase                    | `CallId`, `CorrelationId`, `MobiusServers`, `ServiceData`, `CallEventTypes`, `LineEventTypes` |
| Enums               | PascalCase name, SCREAMING_SNAKE values | `enum CALL_EVENT_KEYS { ALERTING = 'alerting', DISCONNECT = 'disconnect' }` |
| Constants           | SCREAMING_SNAKE_CASE          | `REPO_NAME`, `CALL_ENDPOINT_RESOURCE`, `DEFAULT_KEEPALIVE_INTERVAL`, `NETWORK_FLAP_TIMEOUT` |
| Methods / functions | camelCase                     | `createClient`, `getMetricManager`, `submitCallMetric`, `triggerRegistration` |
| Private members     | `private` keyword (no underscore prefix) | `private webex: WebexSDK`, `private correlationId: CorrelationId` |
| File-level context constants | SCREAMING_SNAKE_CASE | `CALLING_CLIENT_FILE = 'CallingClient'`, `METRIC_FILE = 'metric'`, `CALL_MANAGER_FILE = 'callManager'` |
| Method name constants | `METHODS` object with SCREAMING_SNAKE keys | `METHODS.CREATE_CALL = 'createCall'`, `METHODS.ANSWER = 'answer'` |

---

## 3. File Naming

| File type          | Convention          | Example                                           |
|--------------------|---------------------|---------------------------------------------------|
| Main class module  | PascalCase          | `CallingClient.ts`, `CallHistory.ts`              |
| Sub-module         | camelCase           | `callManager.ts`, `call.ts`, `register.ts`        |
| Type definitions   | `types.ts`          | `CallingClient/types.ts`, `common/types.ts`, `Events/types.ts` |
| Constants          | `constants.ts`      | `CallingClient/constants.ts`, `common/constants.ts` |
| Test files         | Co-located, `*.test.ts` | `CallingClient.test.ts`, `callManager.test.ts`, `index.test.ts` |
| Test fixtures      | `*Fixtures.ts`      | `callingClientFixtures.ts`, `registerFixtures.ts`, `callRecordFixtures.ts` |
| Test utilities     | `testUtil.ts`       | `common/testUtil.ts`                              |
| Barrel exports     | `index.ts`          | `Errors/index.ts`, `Events/impl/index.ts`        |
| Public API         | `api.ts`            | `src/api.ts`                                      |

---

## 4. Logging Standards

### Logger module

All logging goes through the centralized `Logger` module at `src/Logger/index.ts`. **Never use `console.log` directly**.

```typescript
import log from '../Logger';

// Always provide file and method context
log.info('Registration successful', {
  file: CALLING_CLIENT_FILE,
  method: METHODS.REGISTER,
});
```

### Log format

The Logger formats messages as:

```
webex-calling: <timestamp>: [LEVEL]: file:<filename> - method:<methodName> - message:<actual message>
```

This format is produced by `src/Logger/index.ts` using `REPO_NAME` from `CallingClient/constants.ts` and `LOG_PREFIX` from `Logger/types.ts`.

### Log levels

Defined in `src/Logger/types.ts`:

| Level   | Numeric | Enum value       | Logger method | Usage                                    |
|---------|---------|------------------|---------------|------------------------------------------|
| ERROR   | 1       | `LOGGING_LEVEL.error` | `log.error()` | Errors and failures only                 |
| WARN    | 2       | `LOGGING_LEVEL.warn`  | `log.warn()`  | Warnings, degraded behavior              |
| LOG     | 3       | `LOGGING_LEVEL.log`   | `log.log()`   | Useful operational information           |
| INFO    | 4       | `LOGGING_LEVEL.info`  | `log.info()`  | Informational messages, method entry     |
| TRACE   | 5       | `LOGGING_LEVEL.trace` | `log.trace()` | Full stack traces, detailed debugging    |

Setting log level N enables levels 1 through N. For example, `LOGGING_LEVEL.log` (3) enables error, warn, and log.

### Context pattern

Every log call must include a context object (`LogContext`) with `file` and `method` fields. Use the constants defined in `CallingClient/constants.ts`:

```typescript
log.info(`${METHOD_START_MESSAGE} with ${direction}`, {
  file: CALL_MANAGER_FILE,
  method: METHODS.CREATE_CALL,
});
```

---

## 5. Error Handling

### Error class hierarchy

All errors extend from `ExtendedError` (defined in `src/Errors/catalog/ExtendedError.ts`), which extends the native `Error` class:

```
Error
  +-- ExtendedError (msg, context, type)
       +-- CallError (+ correlationId, errorLayer)
       +-- LineError (+ status)
       +-- CallingClientError (+ status)
```

### Error enums

Defined in `src/Errors/types.ts`:

- `ERROR_TYPE` -- Categorizes the error: `CALL_ERROR`, `DEFAULT`, `BAD_REQUEST`, `FORBIDDEN_ERROR`, `NOT_FOUND`, `REGISTRATION_ERROR`, `SERVICE_UNAVAILABLE`, `TIMEOUT`, `TOKEN_ERROR`, `TOO_MANY_REQUESTS`, `SERVER_ERROR`
- `ERROR_LAYER` -- Where the error occurred: `CALL_CONTROL`, `MEDIA`
- `ERROR_CODE` -- HTTP status codes: `UNAUTHORIZED` (401), `FORBIDDEN` (403), `DEVICE_NOT_FOUND` (404), etc.
- `CALL_ERROR_CODE` -- Domain-specific codes: `INVALID_STATUS_UPDATE` (111), `DEVICE_NOT_REGISTERED` (112), etc.

### Factory functions

Always use factory functions to create error instances:

```typescript
import { createCallError } from '../Errors/catalog/CallError';
import { createLineError } from '../Errors/catalog/LineError';
import { createClientError } from '../Errors/catalog/CallingDeviceError';

const error = createCallError(
  'Call failed due to timeout',
  { file: CALL_FILE, method: METHODS.DIAL },
  ERROR_TYPE.TIMEOUT,
  correlationId,
  ERROR_LAYER.CALL_CONTROL
);
```

### Error retrieval

Error objects expose `getCallError()`, `getError()` methods that return typed objects (`CallErrorObject`, `LineErrorObject`, `ErrorObject`).

---

## 6. Metrics Standards

### Singleton access

The `MetricManager` is accessed as a singleton via the `getMetricManager()` factory in `src/Metrics/index.ts`:

```typescript
import { getMetricManager } from '../Metrics';

const metricManager = getMetricManager(webex, ServiceIndicator.CALLING);
metricManager.setDeviceInfo(deviceInfo);
```

### Metric types

Defined in `src/Metrics/types.ts`:

| Enum           | Values                            |
|----------------|-----------------------------------|
| `METRIC_TYPE`  | `OPERATIONAL`, `BEHAVIORAL`       |

### Metric events

The `METRIC_EVENT` enum defines all metric event names:

| Event                  | Value                                  |
|------------------------|----------------------------------------|
| `CALL`                 | `web-calling-sdk-callcontrol`          |
| `CALL_ERROR`           | `web-calling-sdk-callcontrol-error`    |
| `MEDIA`                | `web-calling-sdk-media`                |
| `MEDIA_ERROR`          | `web-calling-sdk-media-error`          |
| `REGISTRATION`         | `web-calling-sdk-registration`         |
| `REGISTRATION_ERROR`   | `web-calling-sdk-registration-error`   |
| `KEEPALIVE_ERROR`      | `web-calling-sdk-keepalive-error`      |
| `VOICEMAIL`            | `web-calling-sdk-voicemail`            |
| `VOICEMAIL_ERROR`      | `web-calling-sdk-voicemail-error`      |
| `BNR_ENABLED`          | `web-calling-sdk-bnr-enabled`          |
| `BNR_DISABLED`         | `web-calling-sdk-bnr-disabled`         |
| `CONNECTION_ERROR`     | `web-calling-sdk-connection`           |
| `UPLOAD_LOGS_SUCCESS`  | `web-calling-sdk-upload-logs-success`  |
| `UPLOAD_LOGS_FAILED`   | `web-calling-sdk-upload-logs-failed`   |
| `MOBIUS_DISCOVERY`     | `web-calling-sdk-mobius-discovery`     |

### IMetricManager methods

| Method                      | Purpose                                |
|-----------------------------|----------------------------------------|
| `setDeviceInfo`             | Store device info for metric tags      |
| `submitRegistrationMetric`  | Registration success/failure metrics   |
| `submitCallMetric`          | Call control metrics                   |
| `submitMediaMetric`         | Media layer metrics                    |
| `submitVoicemailMetric`     | Voicemail operation metrics            |
| `submitBNRMetric`           | Background noise reduction metrics     |
| `submitConnectionMetrics`   | Network/Mercury connection metrics     |
| `submitUploadLogsMetric`    | Log upload success/failure metrics     |
| `submitRegionInfoMetric`    | Region discovery metrics               |
| `submitMobiusServersMetric` | Mobius server discovery metrics         |

---

## 7. Event Standards

### Eventing base class

All event-emitting classes extend `Eventing<T>` from `src/Events/impl/index.ts`. This class extends `TypedEmitter` and automatically logs every emitted event.

### Event key enums

Defined in `src/Events/types.ts` and `src/CallingClient/line/types.ts`:

| Enum                         | Examples                                               |
|------------------------------|--------------------------------------------------------|
| `CALL_EVENT_KEYS`            | `ALERTING`, `CONNECT`, `DISCONNECT`, `ESTABLISHED`, `HELD`, `RESUMED`, `REMOTE_MEDIA`, `CALL_ERROR`, `CALLER_ID`, `HOLD_ERROR`, `RESUME_ERROR`, `TRANSFER_ERROR`, `PROGRESS` |
| `LINE_EVENT_KEYS`            | `INCOMING_CALL`                                        |
| `LINE_EVENTS`                | `CONNECTING`, `ERROR`, `RECONNECTED`, `RECONNECTING`, `REGISTERED`, `UNREGISTERED`, `INCOMING_CALL` |
| `CALLING_CLIENT_EVENT_KEYS`  | `ERROR`, `OUTGOING_CALL`, `USER_SESSION_INFO`, `ALL_CALLS_CLEARED` |
| `COMMON_EVENT_KEYS`          | `CB_VOICEMESSAGE_CONTENT_GET`, `CALL_HISTORY_USER_SESSION_INFO`, `CALL_HISTORY_USER_VIEWED_SESSIONS` |
| `MOBIUS_EVENT_KEYS`          | `SERVER_EVENT_INCLUSIVE`, `CALL_SESSION_EVENT_INCLUSIVE`, `CALL_SESSION_EVENT_LEGACY`, `CALL_SESSION_EVENT_VIEWED`, `CALL_SESSION_EVENT_DELETED` |

### Event type maps

Event type maps define the callback signatures for each event:

```typescript
export type CallEventTypes = {
  [CALL_EVENT_KEYS.ALERTING]: (callId: CallId) => void;
  [CALL_EVENT_KEYS.CALL_ERROR]: (error: CallError) => void;
  [CALL_EVENT_KEYS.DISCONNECT]: (callId: CallId) => void;
  // ...
};
```

### Rules

- Always use enum constants for event names, never raw strings.
- Define event type maps as `type` aliases with callback signatures for each key.
- Event emitters must extend `Eventing<T>` where `T` is the event type map.

---

## 8. Import Standards

Imports must follow a three-tier ordering:

```typescript
// 1. External packages
import { Mutex } from 'async-mutex';
import * as Media from '@webex/internal-media-core';

// 2. Internal @webex packages
import { ISDKConnector, WebexSDK } from '../../SDKConnector/types';

// 3. Relative imports
import { CallId, CorrelationId } from '../../common/types';
import log from '../../Logger';
```

---

## 9. Module Organization

### Factory functions

Public modules expose factory functions as the primary creation mechanism:

```typescript
// src/CallingClient/CallingClient.ts
export const createClient = async (webex: WebexSDK, config?: CallingClientConfig): Promise<ICallingClient> => { ... };

// src/Metrics/index.ts
export const getMetricManager = (webex?: WebexSDK, indicator?: ServiceIndicator): IMetricManager => { ... };
```

### Per-module file structure

Each module follows this structure:

```
ModuleName/
  index.ts          -- Barrel exports or main implementation
  types.ts          -- Interfaces, types, enums
  constants.ts      -- Module-specific constants
  ModuleName.ts     -- Primary class implementation
  ModuleName.test.ts -- Co-located tests
  *Fixtures.ts      -- Test fixture data
```

### Singleton pattern

Singletons use a module-level variable and a getter/factory function:

```typescript
// src/SDKConnector/index.ts
let instance: ISDKConnector;
class SDKConnector implements ISDKConnector { ... }
export default Object.freeze(new SDKConnector());

// src/Metrics/index.ts
let metricManager: IMetricManager;
export const getMetricManager = (webex?: WebexSDK, indicator?: ServiceIndicator): IMetricManager => {
  if (!metricManager && webex) {
    metricManager = new MetricManager(webex, indicator);
  }
  return metricManager;
};

// src/CallingClient/calling/callManager.ts
let callManager: ICallManager;
export const getCallManager = (webex: WebexSDK, indicator: ServiceIndicator): ICallManager => { ... };
```

---

## 10. JSDoc Standards

All public interfaces, methods, and exported functions require JSDoc comments with the following tags as applicable:

```typescript
/**
 * Retrieves a dictionary of active calls grouped by lineId.
 *
 * @example
 * ```typescript
 * const activeCalls = callingClient.getActiveCalls();
 * ```
 *
 * @param userId - The user identifier whose devices should be fetched.
 * @returns List of devices associated with the user.
 * @public
 */
```

Required tags:
- `@example` with a code block for all public API methods
- `@param` for every parameter
- `@returns` when the function returns a value
- `@public` for public API surface
- `@ignore` for internal methods not intended for external consumers

---

## 11. Public API Surface

The `src/api.ts` file is the barrel export for the entire package. It exports:
- **Interfaces**: `ILine`, `ICall`, `ICallHistory`, `ICallSettings`, `ICallingClient`, `IContacts`, `IVoicemail`
- **Classes**: `CallHistory`, `CallSettings`, `CallingClient`, `ContactsClient`, `Voicemail`
- **Types**: `ContactGroup`, `Contact`, `CallForwardSetting`, etc.
- **Factory methods**: `createCallHistoryClient`, `createCallSettingsClient`, `createClient`, `createContactsClient`, `createVoicemailClient`

Any new public API must be added to `src/api.ts`.

---

## 12. Code Review Checklist

Before submitting a PR, verify:

- [ ] No `any` types introduced (use proper types or `unknown`)
- [ ] All public methods have JSDoc with `@example`, `@param`, `@returns`
- [ ] Logging uses `log` module with `{file, method}` context -- no `console.log`
- [ ] Errors use the `ExtendedError` hierarchy with factory functions
- [ ] Metrics use `IMetricManager` methods with proper `METRIC_EVENT` and `METRIC_TYPE`
- [ ] Events use enum constants, not raw strings
- [ ] Event type maps are updated if new events are added
- [ ] Imports follow the three-tier ordering
- [ ] New modules follow the standard file structure (types.ts, constants.ts, etc.)
- [ ] Factory/singleton patterns used for new services
- [ ] Tests are co-located and follow `should [verb] [outcome] when [condition]` naming
- [ ] Test fixtures are in separate `*Fixtures.ts` files
- [ ] New public APIs are exported from `src/api.ts`
- [ ] Constants use SCREAMING_SNAKE_CASE
- [ ] Interface names start with `I` prefix
