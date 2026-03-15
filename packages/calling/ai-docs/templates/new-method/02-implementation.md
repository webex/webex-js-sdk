# New Method - Implementation Guide

> **Purpose**: Code generation guide for implementing a new method in an existing module.

---

## Prerequisites

- Requirements gathered from [`01-requirements.md`](01-requirements.md)
- Patterns loaded from [`../../patterns/`](../../patterns/)
- Rules loaded from [`../../RULES.md`](../../RULES.md)

---

## Step 1: Define Types (if needed)

Add new types to the module's `types.ts`:

```typescript
// In src/[Module]/types.ts

// Request/response types for API calls
export type NewMethodRequest = {
  param1: string;
  param2: number;
};

export type NewMethodResponse = {
  result: string;
  status: number;
};

// Add to the module's interface if public
export interface IModuleName {
  // ... existing methods
  newMethod(param: ParamType): Promise<ReturnType>;
}
```

---

## Step 2: Add Constants (if needed)

Add new constants to the module's `constants.ts`:

```typescript
// In src/[Module]/constants.ts or src/CallingClient/constants.ts

// API endpoint
export const NEW_ENDPOINT = 'newEndpoint';

// Method name for logging
export const METHODS = {
  // ... existing methods
  NEW_METHOD: 'newMethod',
};
```

---

## Step 3: Implement the Method

### Method Template (with API call)

```typescript
/**
 * [Description of what the method does]
 *
 * @param param1 - [Description]
 * @param param2 - [Description]
 * @returns [Description of return value]
 * @example
 * ```typescript
 * const result = await module.newMethod(param1, param2);
 * ```
 */
public async newMethod(param1: ParamType, param2?: OptionalType): Promise<ReturnType> {
  const logContext = { file: MODULE_FILE, method: METHODS.NEW_METHOD };

  log.info(`Starting newMethod with param1: ${param1}`, logContext);

  try {
    const response = await this.webex.request<ResponseType>({
      method: HTTP_METHODS.POST,
      uri: `${this.mobiusUri}${URL_ENDPOINT}${NEW_ENDPOINT}`,
      addAuthHeader: true,
      headers: {
        [CISCO_DEVICE_URL]: this.deviceUrl,
      },
      body: {
        param1,
        param2,
      },
    });

    log.info('newMethod completed successfully', logContext);

    // Submit success metric
    this.metricManager.submitCallMetric(
      METRIC_EVENT.CALL,
      'newMethod',
      METRIC_TYPE.BEHAVIORAL,
      this.callId,
      this.correlationId
    );

    return response.body;
  } catch (error) {
    log.error(`newMethod failed: ${error}`, logContext);

    // Create typed error
    const callError = createCallError(
      `newMethod failed: ${(error as Error).message}`,
      logContext,
      ERROR_TYPE.CALL_ERROR,
      this.correlationId,
      ERROR_LAYER.CALL_CONTROL
    );

    // Submit failure metric
    this.metricManager.submitCallMetric(
      METRIC_EVENT.CALL_ERROR,
      'newMethod',
      METRIC_TYPE.BEHAVIORAL,
      this.callId,
      this.correlationId,
      callError
    );

    // Emit error event
    this.emit(CALL_EVENT_KEYS.CALL_ERROR, callError);

    throw callError;
  }
}
```

### Method Template (without API call)

```typescript
/**
 * [Description]
 *
 * @returns [Description]
 */
public newMethod(): ReturnType {
  const logContext = { file: MODULE_FILE, method: METHODS.NEW_METHOD };

  log.info('Executing newMethod', logContext);

  // Implementation
  const result = this.computeResult();

  log.info(`newMethod result: ${result}`, logContext);

  return result;
}
```

---

## Step 4: Add Event Key (if emitting new events)

```typescript
// In src/Events/types.ts

// 1. Add to the event key enum
export enum CALL_EVENT_KEYS {
  // ... existing keys
  NEW_EVENT = 'new_event',
}

// 2. Add to the event type map
export type CallEventTypes = {
  // ... existing entries
  [CALL_EVENT_KEYS.NEW_EVENT]: (data: NewEventPayload) => void;
};
```

---

## Step 5: Add Metric Event (if tracking new metrics)

```typescript
// In src/Metrics/types.ts
export enum METRIC_EVENT {
  // ... existing events
  NEW_METRIC = 'web-calling-sdk-new-metric',
  NEW_METRIC_ERROR = 'web-calling-sdk-new-metric-error',
}
```

---

## Step 6: Export Types (if public)

```typescript
// In src/api.ts - add new public types
export { NewType } from './ModuleName/types';
```

---

## Implementation Checklist

- [ ] Types added to `types.ts`
- [ ] Constants added to `constants.ts`
- [ ] Method implemented with Logger context
- [ ] Error handling with typed error class
- [ ] Metrics submitted for success and failure
- [ ] Events emitted where appropriate
- [ ] JSDoc documentation added
- [ ] Public types exported from `src/api.ts`
