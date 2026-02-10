# Feature Enhancement Template

> **Purpose**: Workflow for adding new features to existing services.

---

## Pre-Enhancement Questions

### 1. Feature Definition

**Feature Name**: (Brief name)

**Description**: What does this feature do?

**Use Case**: When would a developer use this?

### 2. Scope

**Affected Files**:
- [ ] cc.ts (main plugin)
- [ ] services/[name]/index.ts
- [ ] types.ts
- [ ] Other: ___

**Breaking Changes?**: Yes/No
- If yes, what's the migration path?

### 3. Dependencies

**Requires New API Endpoints?**: Yes/No
- Endpoint: ___

**Requires New Events?**: Yes/No
- Event names: ___

**Requires New Types?**: Yes/No
- Type names: ___

---

## Step 1: Design the Feature

### API Design

Define the public interface:

```typescript
/**
 * What the feature does
 * @param params - Description
 * @returns Description
 */
async featureName(params: FeatureParams): Promise<FeatureResponse>
```

### Data Flow

```
User calls cc.featureName(params)
    │
    ▼
Validate input
    │
    ▼
Call service/API
    │
    ▼
Process response
    │
    ▼
Return/emit result
```

---

## Step 2: Update Types

### Add New Types

In appropriate types file:

```typescript
/**
 * Parameters for feature operation
 * @public
 */
export type FeatureParams = {
  /** Description */
  field: string;
};

/**
 * Response from feature operation
 * @public
 */
export type FeatureResponse = {
  /** Description */
  data: FeatureData;
};
```

### Export Types

In `src/types.ts`:

```typescript
export type {FeatureParams, FeatureResponse} from './services/[location]';
```

---

## Step 3: Implement Feature

### Service Layer (if needed)

Add method to existing service:

```typescript
// In services/[name]/index.ts
featureMethod: routing.req((p: {data: FeatureParams}) => ({
  url: '/v1/feature',
  host: WCC_API_GATEWAY,
  data: p.data,
  err: createErrDetailsObject,
  method: HTTP_METHODS.POST,
  notifSuccess: {
    bind: {type: CC_EVENTS.FEATURE_SUCCESS, data: {type: CC_EVENTS.FEATURE_SUCCESS}},
    msg: {} as FeatureResponse,
  },
  notifFail: {
    bind: {type: CC_EVENTS.FEATURE_FAILED, data: {type: CC_EVENTS.FEATURE_FAILED}},
    errId: 'Service.aqm.feature.failed',
  },
})),
```

### Plugin Layer (cc.ts)

Add public method:

```typescript
/**
 * Feature description.
 *
 * @param {FeatureParams} params - Parameters
 * @returns {Promise<FeatureResponse>} Result
 * @throws {Error} If operation fails
 *
 * @public
 *
 * @example
 * ```typescript
 * const result = await cc.featureName({
 *   field: 'value',
 * });
 * ```
 */
public async featureName(params: FeatureParams): Promise<FeatureResponse> {
  LoggerProxy.info('Starting feature operation', {
    module: CC_FILE,
    method: METHODS.FEATURE_NAME,
  });
  
  try {
    this.metricsManager.timeEvent([
      METRIC_EVENT_NAMES.FEATURE_SUCCESS,
      METRIC_EVENT_NAMES.FEATURE_FAILED,
    ]);
    
    const result = await this.services.someService.featureMethod({
      data: params,
    });
    
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.FEATURE_SUCCESS,
      {...MetricsManager.getCommonTrackingFieldForAQMResponse(result)},
      ['behavioral', 'operational']
    );
    
    LoggerProxy.log('Feature operation completed successfully', {
      module: CC_FILE,
      method: METHODS.FEATURE_NAME,
      trackingId: result.trackingId,
    });
    
    return result;
  } catch (error) {
    const failure = error.details as Failure;
    this.metricsManager.trackEvent(
      METRIC_EVENT_NAMES.FEATURE_FAILED,
      {...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure)},
      ['behavioral', 'operational']
    );
    const {error: detailedError} = getErrorDetails(error, METHODS.FEATURE_NAME, CC_FILE);
    throw detailedError;
  }
}
```

---

## Step 4: Add Constants

### Method Constants

```typescript
// src/constants.ts
export const METHODS = {
  // ... existing
  FEATURE_NAME: 'featureName',
} as const;
```

### Metric Constants

```typescript
// src/metrics/constants.ts
export const METRIC_EVENT_NAMES = {
  // ... existing
  FEATURE_SUCCESS: 'feature success',
  FEATURE_FAILED: 'feature failed',
} as const;
```

### Event Constants (if needed)

```typescript
// services/config/types.ts
export const CC_FEATURE_EVENTS = {
  FEATURE_SUCCESS: 'FeatureSuccess',
  FEATURE_FAILED: 'FeatureFailed',
} as const;
```

---

## Step 5: Update Tests

### Add Feature Tests

```typescript
describe('cc.featureName', () => {
  const mockParams = {
    field: 'value',
  };
  
  const mockResponse = {
    data: { /* ... */ },
    trackingId: 'track-123',
  };

  it('should complete feature operation successfully', async () => {
    mockServicesInstance.someService.featureMethod.mockResolvedValue(mockResponse);
    
    const result = await webex.cc.featureName(mockParams);
    
    expect(result).toEqual(mockResponse);
  });

  it('should handle errors correctly', async () => {
    mockServicesInstance.someService.featureMethod.mockRejectedValue(mockError);
    
    await expect(webex.cc.featureName(mockParams)).rejects.toThrow();
  });
});
```

---

## Step 6: Update Documentation

### Update Service AGENTS.md

If service has ai-docs, update:
- Add new method to API reference
- Add usage example

### Update Main AGENTS.md

If feature is significant:
- Add to relevant section
- Update examples if needed

---

## Validation Checklist

- [ ] Types defined with JSDoc
- [ ] Types exported from `src/types.ts`
- [ ] Method implemented following patterns
- [ ] LoggerProxy used throughout
- [ ] MetricsManager tracking added
- [ ] Error handling follows pattern
- [ ] Constants added (methods, metrics, events)
- [ ] Unit tests added
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Documentation updated

```bash
yarn workspace @webex/contact-center typecheck
yarn workspace @webex/contact-center lint
yarn workspace @webex/contact-center test
yarn workspace @webex/contact-center build
```

---

## Complete!

Feature enhancement is complete when all checkboxes are checked.
