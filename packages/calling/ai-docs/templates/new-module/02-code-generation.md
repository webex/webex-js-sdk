# New Module - Code Generation Guide

> **Purpose**: Step-by-step code generation for a new module.

---

## Prerequisites

- Module specification confirmed from [`01-pre-questions.md`](01-pre-questions.md)
- Patterns loaded from [`../../patterns/`](../../patterns/)
- Rules loaded from [`../../RULES.md`](../../RULES.md)

---

## Step 1: Create Module Directory

```
src/ModuleName/
├── ModuleName.ts          # Main class
├── types.ts               # Types and interfaces
├── constants.ts           # Module constants
├── ModuleName.test.ts     # Tests (created in step 3)
└── fixtures.ts            # Test fixtures (created in step 3)
```

---

## Step 2: Define Types (`types.ts`)

```typescript
// src/ModuleName/types.ts

import { Eventing } from '../Events/impl';

// Module-specific event types (if the module emits events)
export type ModuleNameEventTypes = {
  // Define typed callbacks for each event
  // [EVENT_KEY]: (payload: PayloadType) => void;
};

/**
 * Configuration for the ModuleName module.
 */
export interface ModuleNameConfig {
  // Configuration parameters
}

/**
 * An interface for the `ModuleName` module.
 * [Description of what this module does]
 *
 * @example
 * ```typescript
 * const client = createModuleNameClient(webex, config);
 * ```
 */
export interface IModuleName extends Eventing<ModuleNameEventTypes> {
  /**
   * [Method description]
   *
   * @param param - [Description]
   * @returns [Description]
   * @example
   * ```typescript
   * const result = await client.methodName(param);
   * ```
   */
  methodName(param: ParamType): Promise<ReturnType>;
}

// Additional types
export type ResponseType = {
  // Response structure
};
```

---

## Step 3: Define Constants (`constants.ts`)

```typescript
// src/ModuleName/constants.ts

// File name for logging context
export const MODULE_NAME_FILE = 'ModuleName';

// API endpoints
export const ENDPOINT_RESOURCE = 'resource';

// Timing constants (if needed)
export const DEFAULT_TIMEOUT = 30000;
```

---

## Step 4: Implement Main Class (`ModuleName.ts`)

### Simple Module (no events)

```typescript
// src/ModuleName/ModuleName.ts

import { WebexSDK } from '../SDKConnector/types';
import SDKConnector from '../SDKConnector';
import log from '../Logger';
import { getMetricManager } from '../Metrics';
import { IMetricManager, METRIC_EVENT, METRIC_TYPE } from '../Metrics/types';
import { HTTP_METHODS, ServiceIndicator } from '../common/types';
import { MODULE_NAME_FILE, ENDPOINT_RESOURCE } from './constants';
import { IModuleName, ModuleNameConfig } from './types';

/**
 * ModuleName module implementation.
 * [Description]
 */
export class ModuleName implements IModuleName {
  private sdkConnector: ISDKConnector;
  private webex: WebexSDK;
  private metricManager: IMetricManager;

  /**
   * @param webex - Webex SDK instance.
   * @param config - Optional configuration.
   */
  constructor(webex: WebexSDK, config?: ModuleNameConfig) {
    const logContext = { file: MODULE_NAME_FILE, method: 'constructor' };

    this.sdkConnector = SDKConnector;
    if (!this.sdkConnector.getWebex()) {
      SDKConnector.setWebex(webex);
    }
    this.webex = this.sdkConnector.getWebex();
    this.metricManager = getMetricManager(this.webex, ServiceIndicator.CALLING);

    if (config?.logger) {
      log.setLogger(config.logger.level, MODULE_NAME_FILE);
    }

    log.info('ModuleName initialized', logContext);
  }

  /**
   * [Method description]
   *
   * @param param - [Description]
   * @returns [Description]
   */
  public async methodName(param: ParamType): Promise<ReturnType> {
    const logContext = { file: MODULE_NAME_FILE, method: 'methodName' };
    log.info(`methodName called with: ${param}`, logContext);

    try {
      const response = await this.webex.request<ResponseType>({
        method: HTTP_METHODS.GET,
        uri: `${serviceUrl}/${ENDPOINT_RESOURCE}`,
        addAuthHeader: true,
      });

      log.info('methodName completed successfully', logContext);
      return response.body;
    } catch (error) {
      log.error(`methodName failed: ${error}`, logContext);
      throw error;
    }
  }
}

/**
 * Factory function to create a ModuleName instance.
 *
 * @param webex - Webex SDK instance.
 * @param config - Optional configuration.
 * @returns ModuleName instance.
 */
export const createModuleNameClient = (
  webex: WebexSDK,
  config?: ModuleNameConfig
): IModuleName => {
  return new ModuleName(webex, config);
};
```

### Event-Emitting Module

```typescript
// Add Eventing base class
import { Eventing } from '../Events/impl';
import { ModuleNameEventTypes } from './types';

export class ModuleName extends Eventing<ModuleNameEventTypes> implements IModuleName {
  // ... same pattern but extends Eventing

  constructor(webex: WebexSDK, config?: ModuleNameConfig) {
    super(); // Call Eventing constructor
    // ... rest of constructor
  }
}
```

### Multi-Backend Module

```typescript
// src/ModuleName/WxCallBackendConnector.ts
export class WxCallBackendConnector {
  constructor(private webex: WebexSDK) {}

  async methodName(param: ParamType): Promise<ReturnType> {
    // Webex Calling specific implementation
  }
}

// src/ModuleName/UcmBackendConnector.ts
export class UcmBackendConnector {
  constructor(private webex: WebexSDK) {}

  async methodName(param: ParamType): Promise<ReturnType> {
    // UCM specific implementation
  }
}

// Main class delegates to appropriate connector
export class ModuleName implements IModuleName {
  private connector: WxCallBackendConnector | UcmBackendConnector;

  constructor(webex: WebexSDK, backend: CALLING_BACKEND) {
    switch (backend) {
      case CALLING_BACKEND.WXC:
        this.connector = new WxCallBackendConnector(webex);
        break;
      case CALLING_BACKEND.UCM:
        this.connector = new UcmBackendConnector(webex);
        break;
    }
  }
}
```

---

## Step 5: Export from `src/api.ts`

```typescript
// Add to src/api.ts

// Import
import { ModuleName, createModuleNameClient } from './ModuleName/ModuleName';
import { IModuleName } from './ModuleName/types';

// Export interface
export { IModuleName };

// Export class
export { ModuleName };

// Export factory
export { createModuleNameClient };

// Export types (if public)
export { ResponseType } from './ModuleName/types';
```

---

## Step 6: Add Event Keys (if applicable)

```typescript
// In src/Events/types.ts

// Add new event key enum (or extend COMMON_EVENT_KEYS)
export enum MODULE_NAME_EVENT_KEYS {
  EVENT_ONE = 'moduleName:event_one',
  EVENT_TWO = 'moduleName:event_two',
}
```

---

## Step 7: Add Metric Events (if applicable)

```typescript
// In src/Metrics/types.ts
export enum METRIC_EVENT {
  // ... existing events
  MODULE_NAME = 'web-calling-sdk-modulename',
  MODULE_NAME_ERROR = 'web-calling-sdk-modulename-error',
}
```

---

## Code Generation Checklist

- [ ] Module directory created
- [ ] `types.ts` with interface (`IModuleName`), config, and types
- [ ] `constants.ts` with file name, endpoints, timing constants
- [ ] Main class implementing the interface
- [ ] Factory function exported
- [ ] Logger used in all methods
- [ ] Error handling with appropriate error class
- [ ] Metrics tracking (if applicable)
- [ ] Events defined and emitted (if applicable)
- [ ] Types exported from `src/api.ts`
- [ ] Backend connectors created (if multi-backend)
