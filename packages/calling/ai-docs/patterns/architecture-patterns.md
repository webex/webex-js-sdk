# Architecture Patterns

> Reusable architectural patterns for LLMs working with the `@webex/calling` package.
> For high-level architecture, call lifecycle, and module-specific details, see the module-level ai-docs (e.g., `CallingClient/`, `calling/`).

---

## Rules

- **MUST** use factory functions (`createClient`, `createCallHistoryClient`, etc.) to instantiate top-level clients
- **MUST** use singleton pattern for `SDKConnector`, `CallManager`, and `MetricManager`
- **MUST** extend `Eventing<T>` for any class that emits events
- **MUST** use `SDKConnector` for all Webex SDK interactions (requests, Mercury listeners)
- **MUST** separate backend-specific logic into connector classes (WxCall, UCM, Broadworks)
- **MUST** keep types co-located in `types.ts` within each module
- **MUST** export public API through `src/api.ts` (used for typeDoc documentation generation)
- **NEVER** instantiate `CallingClient`, `CallManager`, or `SDKConnector` directly — use factories/singletons
- **NEVER** access `webex` SDK directly from call/line classes — go through `SDKConnector`
- **NEVER** create more than one `SDKConnector` instance

---

## Naming Conventions for Classes and Interfaces

When defining new classes and their interfaces, follow this convention:

| Element | Convention | Example |
|---------|-----------|---------|
| Class name | PascalCase | `CallingClient`, `CallManager`, `SDKConnector` |
| Interface for class | `I` prefix + PascalCase | `ICallingClient`, `ICallManager`, `ISDKConnector` |
| Interface file location | Co-located `types.ts` | `CallingClient/types.ts` |

The interface defines the public contract; the class implements it:

```typescript
// In types.ts
export interface ICallingClient extends Eventing<CallingClientEventTypes> {
  getLine(): ILine | undefined;
  register(): Promise<void>;
}

// In CallingClient.ts
export class CallingClient extends Eventing<CallingClientEventTypes> implements ICallingClient {
  // implementation
}
```

---

## Singleton Pattern

Used for shared infrastructure that must have exactly one instance across the package.

### SDKConnector

Frozen singleton that wraps the Webex SDK instance. Set once, used everywhere.
It provides a centralized way to make HTTP requests (`request()`) and register/unregister Mercury WebSocket listeners.

```typescript
class SDKConnector implements ISDKConnector {
  public setWebex(webexInstance: WebexSDK): void {
    if (instance) {
      throw new Error('You cannot set the SDKConnector instance more than once');
    }
    const {error, success} = validateWebex(webexInstance);
    if (error) throw error;
    if (success) webex = webexInstance;
    instance = this;
  }

  public getWebex(): WebexSDK { return webex; }

  public request<T>(request: WebexRequestPayload): Promise<T> {
    return instance.getWebex().request(request);
  }

  public registerListener<T>(event: string, cb: (data?: T) => void): void {
    instance.getWebex().internal.mercury.on(event, (data: T) => cb(data));
  }

  public unregisterListener(event: string): void {
    instance.getWebex().internal.mercury.off(event);
  }
}

export default Object.freeze(new SDKConnector());
```

### CallManager

Module-level singleton obtained via `getCallManager()`. Manages the collection of active calls and dispatches incoming WebSocket events to the appropriate call instance.

```typescript
let callManager: ICallManager;

export const getCallManager = (webex: WebexSDK, indicator: ServiceIndicator): ICallManager => {
  if (!callManager) {
    callManager = new CallManager(webex, indicator);
  }
  return callManager;
};
```

### MetricManager

Same singleton pattern as CallManager. Collects and submits telemetry/metrics for calling operations.

```typescript
let metricManager: IMetricManager;

export const getMetricManager = (webex: WebexSDK, indicator: ServiceIndicator): IMetricManager => {
  if (!metricManager) {
    metricManager = new MetricManager(webex, indicator);
  }
  return metricManager;
};
```

---

## Factory Function Pattern

All top-level clients are created through async factory functions that handle initialization internally. Consumers receive a fully initialized instance.

### Creating Clients

```typescript
// CallingClient factory — async, returns initialized instance
export const createClient = async (
  webex: WebexSDK,
  config?: CallingClientConfig
): Promise<ICallingClient> => {
  const callingClientInstance = new CallingClient(webex, config);
  await callingClientInstance.init();
  return callingClientInstance;
};
```

**Important**: `createClient` is `async` and calls `init()` internally. Consumers must `await` the result and should **not** call `init()` separately.

```typescript
// CallingClient — async, takes optional CallingClientConfig
const client = await createClient(webex, config);

// Other client factories are synchronous and take a LoggerInterface ({ level: LOGGER })
// instead of CallingClientConfig:
const logger: LoggerInterface = {level: LOGGER.INFO};
const callHistory = createCallHistoryClient(webex, logger);
const callSettings = createCallSettingsClient(webex, logger, true /* useProdWebexApis */);
const contacts = createContactsClient(webex, logger);
const voicemail = createVoicemailClient(webex, logger);
```

**Important differences from `createClient`**: The other client module factories (`createCallHistoryClient`, `createCallSettingsClient`, `createContactsClient`, `createVoicemailClient`) are **synchronous** and take a `LoggerInterface` as their second argument — not a `CallingClientConfig`. `LoggerInterface` is defined as `{ level: LOGGER }` (where `LOGGER` is the string enum from `src/Logger/types.ts`). `createCallSettingsClient` additionally accepts an optional `useProdWebexApis?: boolean` third argument.

### Internal Call Factory

```typescript
export const createCall = (
  activeUrl: string,
  webex: WebexSDK,
  direction: CallDirection,
  deviceId: string,
  lineId: string,
  deleteCb: DeleteRecordCallBack,
  indicator: ServiceIndicator,
  destination?: CallDetails
): ICall => new Call(activeUrl, webex, direction, deviceId, lineId, deleteCb, indicator, destination);
```

### Error Factories

```typescript
export const createCallError = (
  msg: ErrorMessage,
  context: ErrorContext,
  type: ERROR_TYPE,
  correlationId: CorrelationId,
  errorLayer: ERROR_LAYER
) => new CallError(msg, context, type, correlationId, errorLayer);

export const createLineError = (
  msg: ErrorMessage,
  context: ErrorContext,
  type: ERROR_TYPE,
  status: RegistrationStatus
) => new LineError(msg, context, type, status);
```

---

## Backend Connector Pattern

Different calling backends share the same interface but have platform-specific implementations.
The appropriate connector is selected based on `ServiceIndicator` / `CALLING_BACKEND`.

```typescript
export enum CALLING_BACKEND {
  WXC = 'WEBEX_CALLING',
  BWRKS = 'BROADWORKS_CALLING',
  UCM = 'UCM_CALLING',
}

export enum ServiceIndicator {
  CALLING = 'calling',
  CONTACTCENTER = 'contactcenter',
}
```

Connector availability varies by module:

| Module | WxCallBackendConnector | UcmBackendConnector | BroadworksBackendConnector |
|--------|----------------------|--------------------|--------------------------:|
| CallSettings | Yes | Yes | No |
| Voicemail | Yes | Yes | Yes |

---

## Callback Pattern

The package uses typed callbacks for cleanup and error propagation between components.

### Delete/Cleanup Callback

When a call ends, the `CallManager` needs to remove it from its collection. This is done via a callback passed during call creation:

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

### Error Emitter Callbacks

Error handler utilities accept typed callbacks to propagate errors back to the emitting component:

```typescript
type CallErrorEmitterCallBack = (error: CallError) => void;
type CallingClientErrorEmitterCallback = (err: CallingClientError, finalError?: boolean) => void;
type LineErrorEmitterCallback = (err: LineError, finalError?: boolean) => void;
```

---

## Collection Patterns

### Line Dictionary

```typescript
// CallingClient maintains a dictionary of lines keyed by lineId
private lineDict: Record<string, ILine> = {};
```

### Call Collection

```typescript
// CallManager maintains active calls keyed by correlationId
private callCollection: Record<CorrelationId, ICall>;
```

---

## Concurrency Control

Uses `async-mutex` for critical sections like registration.

```typescript
import {Mutex} from 'async-mutex';

private mutex: Mutex;

constructor() {
  this.mutex = new Mutex();
}

async someOperation() {
  const release = await this.mutex.acquire();
  try {
    // critical section
  } finally {
    release();
  }
}
```

---

## Related

- [Event Patterns](./event-patterns.md)
- [Error Handling Patterns](./error-handling-patterns.md)
- [TypeScript Patterns](./typescript-patterns.md)
- [Testing Patterns](./testing-patterns.md)
