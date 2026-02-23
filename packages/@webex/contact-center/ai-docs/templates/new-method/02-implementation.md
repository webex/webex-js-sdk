# New Method - Implementation

> **Purpose**: Implement the new method following SDK patterns.

---

## Method Template (for cc.ts)

```typescript
/**
 * Brief description of what this method does.
 *
 * @description
 * Detailed description including:
 * - What the method accomplishes
 * - When to use it
 * - Prerequisites (e.g., must be logged in)
 *
 * @param {ParamType} data - Description of parameters
 * @param {string} data.requiredField - Description
 * @param {number} [data.optionalField] - Optional field description
 *
 * @returns {Promise<ReturnType>} Description including:
 *   - field1: What this field contains
 *   - field2: What this field contains
 *
 * @throws {Error} When operation fails with reason in error.message
 *
 * @public
 *
 * @example
 * ```typescript
 * const cc = webex.cc;
 * await cc.register();
 * await cc.stationLogin({ teamId: 'team123', loginOption: 'BROWSER' });
 *
 * // Basic usage
 * const result = await cc.methodName({
 *   requiredField: 'value',
 * });
 *
 * // With optional params
 * const result = await cc.methodName({
 *   requiredField: 'value',
 *   optionalField: 42,
 * });
 * ```
 */
public async methodName(data: ParamType): Promise<ReturnType> {
  // 1. Log start of operation
  LoggerProxy.info('Starting operation', {
    module: CC_FILE,
    method: METHODS.METHOD_NAME,
  });
  
  try {
    // 2. Start timing for metrics
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.OPERATION_SUCCESS,
      METRIC_EVENT_NAMES.OPERATION_FAILED,
    ]);
    
    // 3. Validate input if needed
    if (!data.requiredField) {
      throw new Error('requiredField is required');
    }
    
    // 4. Call service method
    const result = await this.services.someService.method({
      data: {
        ...data,
        // Add any additional fields from agentConfig if needed
        agentId: this.agentConfig.agentId,
      },
    });
    
    // 5. Track success metrics
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.OPERATION_SUCCESS,
      {
        ...MetricsManager.getCommonTrackingFieldForAQMResponse(result),
        // Add operation-specific fields
        customField: data.requiredField,
      },
      ['behavioral', 'operational']  // Adjust metric types as needed
    );
    
    // 6. Log success
    LoggerProxy.log('Operation completed successfully', {
      module: CC_FILE,
      method: METHODS.METHOD_NAME,
      trackingId: result.trackingId,
    });
    
    // 7. Return result (transform if needed)
    return result;
    
  } catch (error) {
    // 8. Cast error details
    const failure = error.details as Failure;
    
    // 9. Track failure metrics
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.OPERATION_FAILED,
      {
        ...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure),
        customField: data.requiredField,
      },
      ['behavioral', 'operational']
    );
    
    // 10. Get detailed error (this logs and uploads logs automatically)
    const {error: detailedError} = getErrorDetails(
      error,
      METHODS.METHOD_NAME,
      CC_FILE
    );
    
    // 11. Throw augmented error
    throw detailedError;
  }
}
```

---

## Adding Method Constants

In `src/constants.ts`, add method name:

```typescript
export const METHODS = {
  // ... existing
  METHOD_NAME: 'methodName',
} as const;
```

---

## Adding Metric Constants

In `src/metrics/constants.ts`:

```typescript
export const METRIC_EVENT_NAMES = {
  // ... existing
  OPERATION_SUCCESS: 'operation success',
  OPERATION_FAILED: 'operation failed',
} as const;
```

---

## Adding Types

In `src/types.ts` or appropriate service types file:

```typescript
/**
 * Parameters for methodName operation
 * @public
 */
export type ParamType = {
  /** Description of required field */
  requiredField: string;
  /** Description of optional field */
  optionalField?: number;
};

/**
 * Response from methodName operation
 * @public
 */
export type ReturnType = {
  /** Description of data */
  data: {
    /** Field description */
    field: string;
  };
  /** Request tracking ID */
  trackingId: string;
};
```

---

## Next Step

Proceed to: [`03-tests.md`](03-tests.md)
