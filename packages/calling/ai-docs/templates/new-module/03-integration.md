# Integration

Wire the newly created module into the `@webex/calling` package so it is accessible to consumers. Follow the path that matches your module's placement type.

---

## Path A: Top-Level Module (`src/ModuleName/`)

This is the most common path. Used by CallHistory, CallSettings, Contacts, and Voicemail.

Use the exposure and event decisions already captured in `01-pre-questions.md` as source-of-truth while performing this step.

### A0. Confirm exposure decision (from `01-pre-questions.md`)

Treat `01-pre-questions.md` as the authority for export behavior:

- If pre-questions say the module must be **public**, complete **A1** (and entrypoint export updates where required).
- If pre-questions say the module is **internal-only**, skip **A1** and avoid adding package-level exports.
- If pre-questions classify this as a **sub-module**, follow the sub-module path and do not add top-level exports.

### A1. Export from `src/api.ts`

If `01-pre-questions.md` marked this module as public, add the module's exports to `src/api.ts` following the existing grouped pattern:

```typescript
// src/api.ts

// Add import block (grouped with other module imports):
import {ModuleName, createModuleNameClient} from './ModuleName/ModuleName';
import {IModuleName, SomeResponseType} from './ModuleName/types';

// Add to Interfaces section:
export {ILine, ICall, ICallHistory, ICallSettings, ICallingClient, IContacts, IVoicemail, IModuleName};

// Add to Classes section:
export {CallHistory, CallSettings, CallingClient, ContactsClient, Voicemail, ModuleName};

// Add to Types section (if applicable):
export {
  ContactGroup,
  Contact,
  CallForwardSetting,
  CallForwardAlwaysSetting,
  VoicemailSetting,
  VoicemailResponseEvent,
  SomeResponseType,  // Add module-specific exported types
};

// Add to Methods section:
export {
  createCallHistoryClient,
  createCallSettingsClient,
  createClient,
  createContactsClient,
  createVoicemailClient,
  createModuleNameClient,  // Add new factory function
};
```

### A2. Add Event Keys (if module emits events)

Add new event key enums to `src/Events/types.ts`:

```typescript
// src/Events/types.ts

// Add new event keys (inside the appropriate enum or create a new one):
export enum MODULE_NAME_EVENT_KEYS {
  DATA_UPDATED = 'moduleName:data_updated',
  DATA_DELETED = 'moduleName:data_deleted',
}

// Or add to existing COMMON_EVENT_KEYS if the event is shared:
export enum COMMON_EVENT_KEYS {
  // ... existing keys ...
  MODULE_NAME_DATA_UPDATE = 'moduleName:data_update',
}

// Add the event type map (near the other EventTypes definitions):
export type ModuleNameEventTypes = {
  [MODULE_NAME_EVENT_KEYS.DATA_UPDATED]: (event: SomeEventPayload) => void;
  [MODULE_NAME_EVENT_KEYS.DATA_DELETED]: (event: SomeDeletePayload) => void;
};
```

### A3. Add Mercury Listener Keys (if module listens to WebSocket events)

Add Mercury event keys to the `MOBIUS_EVENT_KEYS` enum in `src/Events/types.ts`:

```typescript
// src/Events/types.ts

export enum MOBIUS_EVENT_KEYS {
  // ... existing keys ...
  MODULE_NAME_EVENT = 'event:janus.module_name_event',
  MODULE_NAME_MOBIUS_EVENT = 'event:mobius.module_name_event',
}
```

Then register the listener in the module's constructor (already shown in `02-code-generation.md`):

```typescript
// In ModuleName.ts constructor:
this.sdkConnector.registerListener<EventPayloadType>(
  MOBIUS_EVENT_KEYS.MODULE_NAME_EVENT,
  this.handleModuleEvent
);
```

### A4. Add Metric Events (if module submits metrics)

Add new metric event names and action enums to `src/Metrics/types.ts`:

```typescript
// src/Metrics/types.ts

// Add to METRIC_EVENT enum:
export enum METRIC_EVENT {
  // ... existing events ...
  MODULE_NAME = 'web-calling-sdk-module-name',
  MODULE_NAME_ERROR = 'web-calling-sdk-module-name-error',
}

// Add action enum (if module has distinct metric actions):
export enum MODULE_NAME_ACTION {
  GET_DATA = 'get_data',
  UPDATE_DATA = 'update_data',
  DELETE_DATA = 'delete_data',
}
```

If the module needs a new metric submission method on `IMetricManager`, add it to the interface in `src/Metrics/types.ts` and implement it in `src/Metrics/index.ts`. Prefer reusing an existing domain-appropriate method (`submitCallMetric`, `submitRegistrationMetric`, `submitConnectionMetrics`, `submitVoicemailMetric`) only when its signature and semantics match your module.

---

## Path B: Sub-Module of CallingClient (`src/CallingClient/moduleName/`)

Used for modules tightly coupled to CallingClient lifecycle (Line, Call, Registration).

### B1. Import in CallingClient Class

Add the sub-module to `src/CallingClient/CallingClient.ts`:

```typescript
// src/CallingClient/CallingClient.ts

import {ModuleName} from './moduleName';
import {IModuleName} from './moduleName/types';

export class CallingClient extends Eventing<CallingClientEventTypes> implements ICallingClient {
  // Add as a property:
  private moduleName: IModuleName;

  constructor(webex: WebexSDK, config: CallingClientConfig) {
    // ... existing constructor code ...
    this.moduleName = new ModuleName(this.webex, config);
  }
}
```

### B2. Expose Through CallingClient Interface

Add methods to `src/CallingClient/types.ts`:

```typescript
// src/CallingClient/types.ts

export interface ICallingClient extends Eventing<CallingClientEventTypes> {
  // ... existing methods ...

  // Add accessor or delegate methods:
  getModuleName(): IModuleName;
  // or expose individual methods:
  moduleMethod(param: ParamType): Promise<ResponseType>;
}
```

### B3. Do NOT Export from `src/api.ts`

Sub-modules are accessed through the CallingClient instance, not directly. The CallingClient interface is the public contract. Only export sub-module types if consumers need them for type annotations:

```typescript
// src/api.ts -- only add types if needed by consumers:
import {IModuleName} from './CallingClient/moduleName/types';
export {IModuleName};
```

---

## Path C: Multi-Backend Module

Extends Path A with backend connector wiring. The facade class is already set up in `02-code-generation.md`.

### C1. Follow Path A Steps

Complete steps A1 through A4 as described above for the facade class.

### C2. Verify Backend Connector Registration

Ensure the `initializeBackendConnector` method in the facade class covers all three backends:

```typescript
private initializeBackendConnector() {
  switch (this.callingBackend) {
    case CALLING_BACKEND.WXC:
      this.backendConnector = new WxCallBackendConnector(this.webex, this.logger);
      break;
    case CALLING_BACKEND.BWRKS:
      this.backendConnector = new BroadworksBackendConnector(this.webex, this.logger);
      break;
    case CALLING_BACKEND.UCM:
      this.backendConnector = new UcmBackendConnector(this.webex, this.logger);
      break;
    default:
      throw new Error('Calling backend is not identified, exiting....');
  }
}
```

### C3. Delegate Through Facade

Every public method on the facade should delegate to `this.backendConnector`:

```typescript
public async getData(param: ParamType): Promise<ModuleNameResponseEvent> {
  const loggerContext = { file: MODULE_NAME_FILE, method: METHODS.GET_DATA };
  try {
    log.info(`${METHOD_START_MESSAGE} with param=${param}`, loggerContext);
    const response = await this.backendConnector.getData(param);
    // Optionally submit metrics here (facade level)
    this.submitMetric(response, MODULE_NAME_ACTION.GET_DATA);
    log.log(`Successfully retrieved data: statusCode=${response.statusCode}`, loggerContext);
    return response;
  } catch (err: unknown) {
    log.error(`Failed to get data: ${JSON.stringify(err)}`, loggerContext);
    await uploadLogs();
    throw err;
  }
}
```

---

## Add Metric Events

If the module should submit metrics (recommended for all user-facing modules):

### Option 1: Reuse an Existing Domain-Appropriate Metric Method

If the metric payload matches an existing method signature, reuse that method. Use voicemail-specific methods only for voicemail domains.

```typescript
private submitMetric(response: ModuleNameResponseEvent, metricAction: string) {
  const { statusCode, data: { error: errorMessage } } = response;

  if (statusCode >= 200 && statusCode < 300) {
    this.metricManager.submitCallMetric(
      METRIC_EVENT.MODULE_NAME,
      metricAction,
      METRIC_TYPE.BEHAVIORAL
    );
  } else {
    this.metricManager.submitCallMetric(
      METRIC_EVENT.MODULE_NAME_ERROR,
      metricAction,
      METRIC_TYPE.BEHAVIORAL,
      undefined,
      errorMessage,
      statusCode
    );
  }
}
```

### Option 2: Add a New Metric Method

If the module needs a unique metric payload, add a new method to `IMetricManager` in `src/Metrics/types.ts` and implement it in `src/Metrics/index.ts`.

---

## Verification

After completing integration, verify:

- [ ] `src/api.ts` compiles without errors (no missing imports)
- [ ] The module can be imported from the package entry point:
  ```typescript
  import {ModuleName, createModuleNameClient, IModuleName} from '@webex/calling';
  ```
- [ ] Event keys (if any) are accessible from `src/Events/types.ts`
- [ ] Mercury listeners (if any) are registered in the constructor
- [ ] Metric events (if any) are defined in `src/Metrics/types.ts`
- [ ] For multi-backend modules, all three backend connectors are wired in the switch statement
- [ ] No circular imports (module does not import from a file that imports from it)

---

**Next Step:** [04-test-generation.md](./04-test-generation.md) -- Write tests for the new module.
