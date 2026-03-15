# Architecture Patterns

> Quick reference for LLMs working with the `@webex/calling` package architecture.

---

## Rules

- **MUST** use factory functions (`createClient`, `createCallHistoryClient`, etc.) to instantiate top-level clients
- **MUST** use singleton pattern for `SDKConnector`, `CallManager`, and `MetricManager`
- **MUST** extend `Eventing<T>` for any class that emits events
- **MUST** use `SDKConnector` for all Webex SDK interactions (requests, Mercury listeners)
- **MUST** separate backend-specific logic into connector classes (WxCall, UCM, Broadworks)
- **MUST** keep types co-located in `types.ts` within each module
- **MUST** export public API through `src/api.ts` only
- **NEVER** instantiate `CallingClient`, `CallManager`, or `SDKConnector` directly — use factories/singletons
- **NEVER** access `webex` SDK directly from call/line classes — go through `SDKConnector`
- **NEVER** create more than one `SDKConnector` instance

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      Application Layer                           │
└──────────────────────────────────────────────────────────────────┘
                                │
                      createClient(webex, config)
                                │
┌──────────────────────────────────────────────────────────────────┐
│  CallingClient (Eventing<CallingClientEventTypes>)               │
│  ├── Line (Eventing<LineEventTypes>)                             │
│  │   └── Registration (Web Worker keepalive)                     │
│  ├── CallManager (Eventing<CallEventTypes>) [singleton]          │
│  │   └── Call (Eventing<CallEventTypes>)                         │
│  │       ├── Call State Machine (XState)                         │
│  │       └── Media State Machine (XState / ROAP)                 │
│  ├── SDKConnector [singleton] → Webex SDK / Mercury              │
│  ├── MetricManager [singleton]                                   │
│  └── Logger                                                      │
└──────────────────────────────────────────────────────────────────┘
                                │
┌──────────────────────────────────────────────────────────────────┐
│  @webex/internal-media-core (WebRTC, ROAP)                       │
│  Mobius API (REST + WebSocket via Mercury)                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Client Modules

| Client | Factory | Interface | Purpose |
|--------|---------|-----------|---------|
| `CallingClient` | `createClient()` | `ICallingClient` | Line registration, call management |
| `CallHistory` | `createCallHistoryClient()` | `ICallHistory` | Call records |
| `CallSettings` | `createCallSettingsClient()` | `ICallSettings` | DND, forwarding, voicemail settings |
| `ContactsClient` | `createContactsClient()` | `IContacts` | Contact management |
| `Voicemail` | `createVoicemailClient()` | `IVoicemail` | Voicemail operations |

---

## Singleton Pattern

### SDKConnector

Frozen singleton that wraps the Webex SDK instance. Set once, used everywhere.

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

Module-level singleton obtained via `getCallManager()`.

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

Same pattern as CallManager.

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

### Creating Clients

```typescript
// CallingClient factory
export const createClient = (
  webex: WebexSDK,
  config?: CallingClientConfig
): ICallingClient => new CallingClient(webex, config);

// Call factory (internal)
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

## CallingClient Initialization

```typescript
export class CallingClient extends Eventing<CallingClientEventTypes> implements ICallingClient {
  constructor(webex: WebexSDK, config?: CallingClientConfig) {
    super();
    this.sdkConnector = SDKConnector;

    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
      log.setWebexLogger(webex.logger);
    }

    this.mutex = new Mutex();
    this.webex = this.sdkConnector.getWebex();
    this.sdkConfig = config;

    const serviceData = this.sdkConfig?.serviceData?.indicator
      ? this.sdkConfig.serviceData
      : {indicator: ServiceIndicator.CALLING, domain: ''};

    validateServiceData(serviceData);

    this.callManager = getCallManager(this.webex, serviceData.indicator);
    this.metricManager = getMetricManager(this.webex, serviceData.indicator);
    this.mediaEngine = Media;

    this.registerSessionsListener();
    this.registerCallsClearedListener();
  }

  public async init() {
    // 1. Retrieve Mobius servers
    // 2. Create a Line
    // 3. Set up network change detection
  }
}
```

---

## Backend Connector Pattern

Different calling backends share the same interface but have platform-specific implementations.

```
CallSettings
├── WxCallBackendConnector    (Webex Calling)
├── UcmBackendConnector       (UCM)
└── BroadworksBackendConnector (Broadworks)

Voicemail
├── WxCallBackendConnector
├── UcmBackendConnector
└── BroadworksBackendConnector
```

The appropriate connector is selected based on `ServiceIndicator` / `CALLING_BACKEND`:

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

---

## Call Lifecycle

```
Application                CallingClient              Line                  CallManager            Call
    │                          │                       │                       │                    │
    ├── createClient() ───────>│                       │                       │                    │
    ├── client.init() ────────>│                       │                       │                    │
    │                          ├── getMobiusServers()   │                       │                    │
    │                          ├── createLine() ──────>│                       │                    │
    │                          │                       ├── register()          │                    │
    │                          │                       │                       │                    │
    ├── line.makeCall(dest) ──>│                       │                       │                    │
    │                          │                       ├── callManager         │                    │
    │                          │                       │   .createCall() ─────>├── new Call() ────>│
    │                          │                       │                       │                    │
    │<── CALL_EVENT: ALERTING ─┤<──────────────────────┤<──────────────────────┤<── emit() ────────│
    │<── CALL_EVENT: CONNECT ──┤<──────────────────────┤<──────────────────────┤<── emit() ────────│
    │                          │                       │                       │                    │
    ├── call.end() ───────────────────────────────────────────────────────────────────────────────>│
    │<── CALL_EVENT: DISCONNECT┤<──────────────────────┤<──────────────────────┤<── emit() ────────│
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
- [State Machine Patterns](./state-machine-patterns.md)
- [Error Handling Patterns](./error-handling-patterns.md)
- [TypeScript Patterns](./typescript-patterns.md)
