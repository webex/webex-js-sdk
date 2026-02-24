# New Service - Code Generation

> **Purpose**: Generate the service class file, types, and constants following existing codebase patterns.

---

## File Structure

Based on the placement decision from pre-questions (Q3), follow the pattern that matches existing services:

### Folder-based service (complex services like `agent/`, `config/`, `task/`)
```
src/services/ServiceName/
├── index.ts          # Service class (main entry point)
├── types.ts          # Type definitions for this service
└── constants.ts      # Constants and enums (optional — only if needed)
```

**When to use**: The service has multiple files, sub-modules, or significant type/constant definitions. Examples: `agent/` (index.ts + types.ts), `config/` (index.ts + types.ts + constants.ts + Util.ts), `task/` (TaskManager.ts + Task.ts + types.ts + constants.ts + sub-folders).

### Single-file service (lightweight services like `AddressBook.ts`, `EntryPoint.ts`, `Queue.ts`)
```
src/services/ServiceName.ts    # Service class in a single file
```

- Types go in the **root** `src/types.ts` (where `AddressBookEntry`, `EntryPointRecord`, etc. are defined)
- Shared constants go in `src/services/constants.ts`
- Service-specific METHODS can go in `src/constants.ts` or inline

**When to use**: The service is a straightforward API wrapper (REST calls, pagination, caching) without sub-modules or complex event handling.

### Sub-module under existing service (like `task/Voice.ts`, `task/Digital.ts`)
```
src/services/{ParentService}/ServiceName.ts    # Single file within parent folder
```

- Types go in the parent service's `types.ts` (e.g., `task/types.ts`)
- Constants go in the parent service's `constants.ts` (e.g., `task/constants.ts`)

---

## Step 1: Type Definitions

Based on placement:

### For folder-based services → create `types.ts` in the service folder

```typescript
// src/services/ServiceName/types.ts

/**
 * [Description — from pre-questions Q4 response structure]
 * @public
 */
export type ServiceResponse = {
  /** [field description] */
  fieldName: string;
  // Define fields to match the exact API response from pre-questions Q4
};

/**
 * [Description — from pre-questions Q4 request payload]
 * @public
 */
export type ServiceRequest = {
  /** [required field — from Q4] */
  requiredField: string;
  /** [optional field — from Q4] */
  optionalField?: number;
};

// Add event payload types from Q5 if applicable
// Add one type per API endpoint's request and response (from Q4)
// Use Pick, Partial, Omit for derived types (see typescript-patterns.md)
```

### For single-file services → add types to `src/types.ts`

Follow the existing pattern — `AddressBookEntry`, `EntryPointRecord`, `ContactServiceQueue` are all defined in `src/types.ts`:

```typescript
// src/types.ts (add alongside existing types)

/**
 * [Description]
 * @public
 */
export interface ServiceItem {
  /** [field description] */
  id: string;
  name: string;
}

export type ServiceListResponse = PaginatedResponse<ServiceItem>;

export interface ServiceSearchParams extends BaseSearchParams {
  // Add service-specific search fields
}
```

### For sub-modules → add types to parent's `types.ts`

Add types to the parent service's types file (e.g., `task/types.ts`).

---

## Step 2: Constants (if needed)

### For folder-based services → create `constants.ts` in the service folder

```typescript
// src/services/ServiceName/constants.ts

/**
 * Module identifier for logging
 * @private
 */
export const SERVICE_FILE = 'ServiceName';

/**
 * Method names for consistent logging
 * @private
 */
export const METHODS = {
  METHOD_ONE: 'methodOne',
  METHOD_TWO: 'methodTwo',
  // One entry per method from pre-questions Q8
} as const;

// Add event constants if applicable (from Q5):
// export const SERVICE_NAME_EVENTS = {
//   SOME_EVENT: 'SomeEvent',
// } as const;
```

> **Note**: Not all folder-based services have `constants.ts` — `agent/` has only `index.ts` + `types.ts`. Only create it if there are constants to define.

### For single-file services → use existing shared constants files

- Shared API constants: `src/services/constants.ts` (where `WCC_API_GATEWAY`, `SUBSCRIBE_API`, etc. live)
- METHODS constants: `src/constants.ts` (where `METHODS` for `WebCallingService` etc. live)
- Metric event names: `src/metrics/constants.ts`
- Endpoint maps: `src/services/config/constants.ts` (where `endPointMap` lives)

### For sub-modules → add to parent's `constants.ts`

---

## Step 3: Service Class

### For folder-based services → `index.ts`

```typescript
// src/services/ServiceName/index.ts

import {WebexSDK} from '../../types';
import LoggerProxy from '../../logger-proxy';
import {getErrorDetails} from '../core/Utils';
import {Failure} from '../core/GlobalTypes';
import MetricsManager from '../../metrics/MetricsManager';
import {METRIC_EVENT_NAMES} from '../../metrics/constants';
import {SERVICE_FILE, METHODS} from './constants';  // or define inline if no constants.ts
import {ServiceResponse, ServiceRequest} from './types';

/**
 * [Service purpose — from pre-questions Q2].
 *
 * @description
 * This service handles:
 * - [capability 1 — from Q8]
 * - [capability 2]
 *
 * @example
 * ```typescript
 * // Adapt based on exposure decision (Q7)
 * const result = await cc.serviceName.methodOne(params);
 * ```
 *
 * @public
 */
export default class ServiceName {
  private webex: WebexSDK;
  private metricsManager: MetricsManager;

  constructor(webex: WebexSDK) {
    this.webex = webex;
    this.metricsManager = MetricsManager.getInstance();
    // Add constructor params based on dependencies (Q6)
  }

  /**
   * [Method description — from Q8].
   *
   * @param {ServiceRequest} data - [from Q4]
   * @returns {Promise<ServiceResponse>} [from Q4]
   * @throws {Error} If the request fails
   * @public
   */
  public async methodOne(data: ServiceRequest): Promise<ServiceResponse> {
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.METHOD_ONE_SUCCESS,
      METRIC_EVENT_NAMES.METHOD_ONE_FAILED,
    ]);

    LoggerProxy.info('Starting methodOne', {
      module: SERVICE_FILE,
      method: METHODS.METHOD_ONE,
    });

    try {
      // === Implement based on Q4 API contract ===
      // For REST services: use webex.request or WebexRequest
      // For AQM services: use routing.req pattern (see agent/index.ts)

      const result = {} as ServiceResponse; // Replace with actual implementation

      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.METHOD_ONE_SUCCESS,
        { /* tracking fields */ },
        ['behavioral', 'operational']
      );

      return result;
    } catch (error) {
      const failure = error.details as Failure;
      this.metricsManager.trackEvent(
        METRIC_EVENT_NAMES.METHOD_ONE_FAILED,
        MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
        ['operational']
      );

      const {error: detailedError} = getErrorDetails(
        error,
        METHODS.METHOD_ONE,
        SERVICE_FILE
      );

      throw detailedError;
    }
  }
}
```

### For single-file services → follow existing `AddressBook.ts` / `EntryPoint.ts` pattern

```typescript
// src/services/ServiceName.ts

import {HTTP_METHODS, WebexSDK} from '../types';
import type {ServiceItem, ServiceListResponse, ServiceSearchParams} from '../types';
import LoggerProxy from '../logger-proxy';
import WebexRequest from './core/WebexRequest';
import MetricsManager from '../metrics/MetricsManager';
import {WCC_API_GATEWAY} from './constants';
import {endPointMap} from './config/constants';
import {METRIC_EVENT_NAMES} from '../metrics/constants';

// Follow the exact same class structure as AddressBook.ts or EntryPoint.ts
// Key patterns from existing single-file services:
// - Use WebexRequest for HTTP calls (not raw webex.request)
// - Import types from src/types.ts
// - Import shared constants from services/constants.ts and config/constants.ts
// - Use MetricsManager for tracking
// - Use PageCache if paginated (import from ../utils/PageCache)
```

### For sub-modules → single file in parent folder

```typescript
// src/services/{ParentService}/ServiceName.ts

// Import from parent-relative paths
import {WebexSDK} from '../../types';
import LoggerProxy from '../../logger-proxy';
// Types and constants from parent's files
import {ServiceType} from './types';
import {SOME_CONSTANT} from './constants';
```

---

## Customization Based on Service Type

### AQM-based service (like `agent/index.ts`)
Uses the factory function + `routing.req` pattern. See `services/agent/index.ts` for the complete pattern.

### REST API service (like `AddressBook.ts`, `EntryPoint.ts`)
Uses `WebexRequest` for HTTP calls, `PageCache` for pagination. Study the existing implementations directly.

### Event-driven service
If the service processes WebSocket events (from Q5), follow the event patterns in `event-driven-patterns.md`.

---

## Next Step

Proceed to: [`03-integration.md`](03-integration.md)
