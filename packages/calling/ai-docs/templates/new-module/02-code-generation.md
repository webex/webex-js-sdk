# Code Generation

Generate the module files based on the specification gathered in `01-pre-questions.md`. Follow the file structure for the chosen placement type, then proceed through each step in order.

> This file intentionally restates a subset of pattern rules as implementation-time guardrails so code generation can be executed without context switching between files.

---

## File Structure by Placement Type

### Top-Level Module (`src/ModuleName/`)

```
src/ModuleName/
  ModuleName.ts             # Main service class + factory function
  types.ts                  # IModuleName interface, response types, LoggerInterface
  constants.ts              # MODULE_NAME_FILE, METHODS, module-specific constants
  ModuleName.test.ts        # Co-located unit tests
  moduleNameFixtures.ts     # Test fixture data
```

### Sub-Module of CallingClient (`src/CallingClient/moduleName/`)

```
src/CallingClient/moduleName/
  index.ts                  # Main class
  types.ts                  # Interface and types
  constants.ts              # Constants
  moduleName.test.ts        # Co-located tests
  moduleNameFixtures.ts     # Test fixtures
```

### Multi-Backend Module (`src/ModuleName/`)

```
src/ModuleName/
  ModuleName.ts                        # Facade class (delegates to connectors)
  types.ts                             # IModuleName, IWxCallBackendConnector, etc.
  constants.ts                         # Shared constants
  WxCallBackendConnector.ts            # WXC backend implementation
  BroadworksBackendConnector.ts        # Broadworks backend implementation
  UcmBackendConnector.ts               # UCM backend implementation
  ModuleName.test.ts                   # Facade tests
  WxCallBackendConnector.test.ts       # WXC connector tests
  BroadworksBackendConnector.test.ts   # Broadworks connector tests
  UcmBackendConnector.test.ts          # UCM connector tests
  moduleNameFixture.ts                 # Shared test fixtures
```

---

## Step 1: Types (`types.ts`)

### STOP -- Validation Before Creating Types

Before defining any new types, check if they already exist:

1. **Check `src/common/types.ts`** for shared types: `CALLING_BACKEND`, `HTTP_METHODS`, `WebexRequestPayload`, `SORT`, `SORT_BY`, `ALLOWED_SERVICES`, `DisplayInformation`
2. **Check `src/Events/types.ts`** for existing event enums and payload types: `COMMON_EVENT_KEYS`, `MOBIUS_EVENT_KEYS`, `CallSessionEvent`, `UserSession`, etc.
3. **Check `src/Errors/types.ts`** for error types: `ERROR_TYPE`, `ERROR_LAYER`, `ErrorContext`, `ErrorMessage`
4. **Check `src/SDKConnector/types.ts`** for `WebexSDK`, `ISDKConnector`
5. **Check `src/Logger/types.ts`** for `LOGGER` enum
6. **Check `src/Metrics/types.ts`** for `IMetricManager`, `METRIC_EVENT`, `METRIC_TYPE`

Only create new types that do not already exist in these shared locations. This complements pattern docs and prevents duplicate types during generation.

### Types Template

```typescript
// src/ModuleName/types.ts

import {Eventing} from '../Events/impl';
import {ModuleNameEventTypes} from '../Events/types';  // Only if module emits events
import {LOGGER} from '../Logger/types';

// ---------- Logger Interface ----------
// Every module re-exports this for its constructor signature.
export interface LoggerInterface {
  level: LOGGER;
}

// ---------- Response Types ----------
// Follow the standard response shape: { statusCode, data, message }
export type ModuleNameResponseEvent = {
  statusCode: number;
  data: {
    // Module-specific data fields
    items?: SomeItemType[];
    error?: string;
  };
  message: string | null;
};

// Define additional response types as needed, one per distinct API response shape.
// Example:
// export type UpdateRecordResponse = {
//   statusCode: number;
//   data: {
//     updateMessage?: string;
//     error?: string;
//   };
//   message: string | null;
// };

// ---------- Data Types ----------
// Define types for the domain objects this module manages.
// Example:
// export type RecordingItem = {
//   id: string;
//   duration: number;
//   createdAt: string;
// };

// ---------- Module Interface ----------
// The public contract for this module. Extends Eventing<T> if events are used.
export interface IModuleName extends Eventing<ModuleNameEventTypes> {
  /**
   * Description of the method.
   *
   * @param paramName - Parameter description.
   * @returns Promise resolving to the response type.
   *
   * @example
   * ```javascript
   * const response = await moduleName.methodName(param);
   * ```
   */
  methodName(paramName: ParamType): Promise<ModuleNameResponseEvent>;

  // Add all public methods defined in the API contract.
}

// ---------- Backend Connector Interfaces (Multi-Backend Only) ----------
// If multi-backend, define per-connector interfaces that extend the main interface
// or define a subset of methods.
//
// export interface IWxCallBackendConnector extends IModuleName {}
// export interface IBroadworksBackendConnector extends IModuleName {}
// export interface IUcmBackendConnector extends IModuleName {}
```

### Types -- Validation Checklist

- [ ] `LoggerInterface` is defined with `level: LOGGER`
- [ ] Response types follow `{ statusCode: number; data: {...}; message: string | null }` shape
- [ ] Interface `IModuleName` extends `Eventing<ModuleNameEventTypes>` (if events are used)
- [ ] All public methods from the API contract are declared in the interface
- [ ] JSDoc with `@param`, `@returns`, and `@example` on every interface method
- [ ] No duplicate types -- checked shared type locations first

---

## Step 2: Constants (`constants.ts`)

### Constants Hierarchy

Before adding a constant, determine the correct location using this priority table:

| Priority | Location | What Goes Here | Examples |
|----------|----------|---------------|----------|
| 1 | `src/CallingClient/constants.ts` | CallingClient-specific constants | `REPO_NAME`, `VERSION`, `METRIC_FILE` |
| 2 | `src/common/constants.ts` | Constants shared across 2+ modules | `SUCCESS_MESSAGE`, `FAILURE_MESSAGE`, `METHOD_START_MESSAGE`, `STATUS_CODE`, `USER_SESSIONS` |
| 3 | `src/Events/types.ts` | Event key enums shared across modules | `COMMON_EVENT_KEYS`, `MOBIUS_EVENT_KEYS`, `CALL_EVENT_KEYS` |
| 4 | `src/Metrics/types.ts` | Metric event names and action enums | `METRIC_EVENT`, `VOICEMAIL_ACTION` |
| 5 | `src/ModuleName/constants.ts` | Module-specific constants | File name, endpoint paths, default values, METHODS |

### Validation Steps

1. **Check `src/common/constants.ts`** -- Do not re-declare: `SUCCESS_MESSAGE`, `FAILURE_MESSAGE`, `METHOD_START_MESSAGE`, `STATUS_CODE`, `USER_SESSIONS`
2. **Check `src/Events/types.ts`** -- Do not re-declare event enums that already exist
3. **Check `src/Metrics/types.ts`** -- If adding metric actions, extend the existing enums there

### Constants Template

```typescript
// src/ModuleName/constants.ts

// ---------- Module Identity ----------
// Used as the `file` field in logger context objects.
export const MODULE_NAME_FILE = 'ModuleName';

// ---------- API Endpoints ----------
// URL path segments and query parameter keys.
// Example:
// export const RECORDINGS = 'recordings';
// export const FROM_DATE = '?from';
// export const LIMIT = 50;
// export const NUMBER_OF_DAYS = 10;

// ---------- Response Constants ----------
// Module-specific success/error messages (only if different from common ones).
// Example:
// export const NO_RECORDINGS_MSG = 'No recordings available';
// export const NO_RECORDINGS_STATUS_CODE = 204;

// ---------- Method Names ----------
// Used for logger context. Every public and significant private method
// should have an entry here.
export const METHODS = {
  GET_DATA: 'getData',
  UPDATE_RECORD: 'updateRecord',
  DELETE_RECORD: 'deleteRecord',
  // Add one entry per method in the service class.
  // Multi-backend modules also include:
  // INIT: 'init',
  // INITIALIZE_BACKEND_CONNECTOR: 'initializeBackendConnector',
};
```

### Constants -- Validation Checklist

- [ ] `MODULE_NAME_FILE` is defined as a string matching the module directory name
- [ ] `METHODS` object has an entry for every public and significant private method
- [ ] No constants duplicate values already in `src/common/constants.ts`
- [ ] Endpoint path segments are individual constants (not concatenated inline)

---

## Step 3: Service Class (`ModuleName.ts`)

### Base Template (Top-Level, Event-Emitting Module)

This template is based on the `CallHistory` pattern -- the most common module shape.

```typescript
// src/ModuleName/ModuleName.ts

import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {CALLING_BACKEND, HTTP_METHODS, WebexRequestPayload} from '../common/types';
import {IModuleName, ModuleNameResponseEvent, LoggerInterface} from './types';
import log from '../Logger';
import {serviceErrorCodeHandler, uploadLogs} from '../common/Utils';
import {MODULE_NAME_FILE, METHODS} from './constants';
import {METHOD_START_MESSAGE, SUCCESS_MESSAGE} from '../common/constants';
import {ModuleNameEventTypes} from '../Events/types';
import {Eventing} from '../Events/impl';

/**
 * `ModuleName` module provides {one-sentence purpose}.
 *
 * This code snippet demonstrates how to create an instance of `ModuleName`:
 *
 * @example
 * ```javascript
 * const moduleNameClient = createModuleNameClient(webex, logger);
 * ```
 */
export class ModuleName extends Eventing<ModuleNameEventTypes> implements IModuleName {
  private sdkConnector: ISDKConnector;

  private webex: WebexSDK;

  private loggerContext = {
    file: MODULE_NAME_FILE,
    method: METHODS.GET_DATA,
  };

  /**
   * @ignore
   */
  constructor(webex: WebexSDK, logger: LoggerInterface) {
    super();
    this.sdkConnector = SDKConnector;
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = this.sdkConnector.getWebex();

    // Register Mercury event listeners (if applicable)
    // this.registerListeners();

    log.setLogger(logger.level, MODULE_NAME_FILE);
  }

  /**
   * {Method description from API contract.}
   *
   * @param paramName - {description}
   * @returns Promise resolving to {@link ModuleNameResponseEvent}.
   */
  public async getData(paramName: ParamType): Promise<ModuleNameResponseEvent> {
    const loggerContext = {
      file: MODULE_NAME_FILE,
      method: METHODS.GET_DATA,
    };

    log.info(
      `${METHOD_START_MESSAGE} with paramName=${paramName}`,
      loggerContext
    );

    try {
      const response = <WebexRequestPayload>await this.webex.request({
        uri: `${this.baseUrl}/endpoint`,
        method: HTTP_METHODS.GET,
        // service: ALLOWED_SERVICES.JANUS,  // if using service discovery
      });

      log.log(
        `Response trackingId: ${response?.headers?.trackingid}`,
        loggerContext
      );

      const responseDetails: ModuleNameResponseEvent = {
        statusCode: Number(response.statusCode),
        data: {
          // Map response body to typed data
        },
        message: SUCCESS_MESSAGE,
      };

      log.log(
        `Successfully retrieved data`,
        loggerContext
      );

      return responseDetails;
    } catch (err: unknown) {
      log.error(
        `Failed to get data: ${JSON.stringify(err)}`,
        loggerContext
      );
      await uploadLogs();

      const errorInfo = err as WebexRequestPayload;
      const errorStatus = serviceErrorCodeHandler(errorInfo, loggerContext);

      return errorStatus;
    }
  }

  // ---------- Event Handlers (if applicable) ----------

  // private registerListeners() {
  //   this.sdkConnector.registerListener<EventPayloadType>(
  //     MOBIUS_EVENT_KEYS.SOME_EVENT,
  //     this.handleSomeEvent
  //   );
  // }
  //
  // handleSomeEvent = async (event?: EventPayloadType) => {
  //   if (event && event.data) {
  //     this.emit(COMMON_EVENT_KEYS.MODULE_EVENT_KEY, event);
  //   }
  // };
}

/**
 * Creates a `ModuleName` client instance.
 *
 * @param webex - Webex SDK instance.
 * @param logger - Logger interface with level property.
 * @returns {IModuleName} An instance of the ModuleName client.
 */
export const createModuleNameClient = (
  webex: WebexSDK,
  logger: LoggerInterface
): IModuleName => new ModuleName(webex, logger);
```

---

### Customization: Module WITHOUT Events

If the module does not emit events, do not extend `Eventing<T>`:

```typescript
// Change the class declaration:
export class ModuleName implements IModuleName {
  // ... (remove super() call from constructor)

// Change the interface in types.ts:
export interface IModuleName {
  // ... (do not extend Eventing<T>)
```

---

### Customization: Multi-Backend Module

If the module needs different behavior per calling backend, use the Voicemail pattern:

```typescript
// In the main class (ModuleName.ts):
import {getCallingBackEnd} from '../common/Utils';
import {WxCallBackendConnector} from './WxCallBackendConnector';
import {BroadworksBackendConnector} from './BroadworksBackendConnector';
import {UcmBackendConnector} from './UcmBackendConnector';
import {IMetricManager, METRIC_EVENT, METRIC_TYPE} from '../Metrics/types';
import {getMetricManager} from '../Metrics';

export class ModuleName extends Eventing<ModuleNameEventTypes> implements IModuleName {
  private sdkConnector: ISDKConnector;
  private webex: WebexSDK;
  private callingBackend: CALLING_BACKEND;
  private backendConnector!: IModuleName;
  private metricManager: IMetricManager;

  constructor(webex: WebexSDK, public logger: LoggerInterface) {
    super();
    this.sdkConnector = SDKConnector;
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = this.sdkConnector.getWebex();
    this.metricManager = getMetricManager(this.webex, undefined);
    this.callingBackend = getCallingBackEnd(this.webex);
    this.initializeBackendConnector();
    log.setLogger(logger.level, MODULE_NAME_FILE);
  }

  /**
   * Setup and initialize the backend connector based on calling backend.
   */
  private initializeBackendConnector() {
    log.info(METHOD_START_MESSAGE, {
      file: MODULE_NAME_FILE,
      method: METHODS.INITIALIZE_BACKEND_CONNECTOR,
    });

    switch (this.callingBackend) {
      case CALLING_BACKEND.WXC: {
        this.backendConnector = new WxCallBackendConnector(this.webex, this.logger);
        break;
      }
      case CALLING_BACKEND.BWRKS: {
        this.backendConnector = new BroadworksBackendConnector(this.webex, this.logger);
        break;
      }
      case CALLING_BACKEND.UCM: {
        this.backendConnector = new UcmBackendConnector(this.webex, this.logger);
        break;
      }
      default: {
        throw new Error('Calling backend is not identified, exiting....');
      }
    }
  }

  /**
   * Delegate to the backend connector.
   */
  public async getData(param: ParamType): Promise<ModuleNameResponseEvent> {
    const loggerContext = {
      file: MODULE_NAME_FILE,
      method: METHODS.GET_DATA,
    };

    try {
      log.info(`${METHOD_START_MESSAGE} with param=${param}`, loggerContext);
      const response = await this.backendConnector.getData(param);
      log.log(`Successfully retrieved data: statusCode=${response.statusCode}`, loggerContext);
      return response;
    } catch (err: unknown) {
      log.error(`Failed to get data: ${JSON.stringify(err)}`, loggerContext);
      await uploadLogs();
      throw err;
    }
  }
}
```

Each backend connector file follows this pattern (based on `WxCallBackendConnector`):

```typescript
// src/ModuleName/WxCallBackendConnector.ts

import SDKConnector from '../SDKConnector';
import {ISDKConnector, WebexSDK} from '../SDKConnector/types';
import {HTTP_METHODS, WebexRequestPayload} from '../common/types';
import {IModuleName, LoggerInterface, ModuleNameResponseEvent} from './types';
import log from '../Logger';
import {serviceErrorCodeHandler, uploadLogs} from '../common/Utils';
import {METHOD_START_MESSAGE, SUCCESS_MESSAGE} from '../common/constants';
import {MODULE_NAME_FILE, METHODS} from './constants';
import {WEBEX_CALLING_CONNECTOR_FILE} from '../common/constants';

export class WxCallBackendConnector implements IModuleName {
  private sdkConnector: ISDKConnector;
  private webex: WebexSDK;

  constructor(webex: WebexSDK, logger: LoggerInterface) {
    this.sdkConnector = SDKConnector;
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = this.sdkConnector.getWebex();
    log.setLogger(logger.level, WEBEX_CALLING_CONNECTOR_FILE);
  }

  public async getData(param: ParamType): Promise<ModuleNameResponseEvent> {
    const loggerContext = {
      file: WEBEX_CALLING_CONNECTOR_FILE,
      method: METHODS.GET_DATA,
    };

    log.info(`${METHOD_START_MESSAGE} with param: ${param}`, loggerContext);

    try {
      const response = <WebexRequestPayload>await this.webex.request({
        uri: `${this.endpointUrl}/path`,
        method: HTTP_METHODS.GET,
      });

      log.log(`Response trackingId: ${response?.headers?.trackingid}`, loggerContext);

      const responseDetails: ModuleNameResponseEvent = {
        statusCode: Number(response.statusCode),
        data: {
          // Map response body
        },
        message: SUCCESS_MESSAGE,
      };

      log.log('Successfully retrieved data', loggerContext);
      return responseDetails;
    } catch (err: unknown) {
      log.error(`Failed to get data: ${JSON.stringify(err)}`, loggerContext);
      await uploadLogs();
      const errorStatus = serviceErrorCodeHandler(err as WebexRequestPayload, loggerContext);
      return errorStatus;
    }
  }

  // Implement remaining IModuleName methods...
}
```

---

### Customization: Singleton Module

If only one instance should exist (rare -- most modules are not singletons):

```typescript
let instance: IModuleName | null = null;

export const createModuleNameClient = (
  webex: WebexSDK,
  logger: LoggerInterface
): IModuleName => {
  if (!instance) {
    instance = new ModuleName(webex, logger);
  }
  return instance;
};
```

---

## Code Generation -- Validation Checklist

- [ ] `types.ts` is created with `LoggerInterface`, response types, and `IModuleName` interface
- [ ] `constants.ts` is created with file name constant and `METHODS` object
- [ ] Service class extends `Eventing<T>` (if events) and implements `IModuleName`
- [ ] Constructor follows the pattern: SDKConnector setup, webex assignment, logger initialization
- [ ] Every method has a `loggerContext` with `file` and `method` fields
- [ ] Every method starts with `log.info(METHOD_START_MESSAGE, ...)` or similar
- [ ] Success paths log with `log.log(...)` including tracking ID
- [ ] Error paths use `log.error(...)`, call `uploadLogs()`, and return `serviceErrorCodeHandler` result
- [ ] Factory function is exported: `createModuleNameClient(webex, logger)`
- [ ] Multi-backend connectors (if applicable) follow the `WxCallBackendConnector` / `BroadworksBackendConnector` / `UcmBackendConnector` pattern

---

**Next Step:** [03-integration.md](./03-integration.md) -- Wire the new module into the package.
