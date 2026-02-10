# New Method - Validation Checklist

> **Purpose**: Final quality check before completing method addition.

---

## Code Quality Checklist

### Method Implementation
- [ ] Method added with correct signature
- [ ] JSDoc with `@param`, `@returns`, `@throws`, `@example`
- [ ] `@public` tag for public API methods
- [ ] LoggerProxy.info at method start
- [ ] LoggerProxy.log on success
- [ ] LoggerProxy.error on failure (via getErrorDetails)
- [ ] MetricsManager.timeEvent at start
- [ ] MetricsManager.trackEvent on success
- [ ] MetricsManager.trackEvent on failure
- [ ] Error handling uses `getErrorDetails` pattern
- [ ] Failure cast: `const failure = error.details as Failure`

### Constants
- [ ] Method name added to `METHODS` constant
- [ ] Metric events added to `METRIC_EVENT_NAMES`

### Types
- [ ] Parameter type defined with JSDoc
- [ ] Return type defined with JSDoc
- [ ] Types exported from `src/types.ts`

### Tests
- [ ] Success case tested
- [ ] Error case tested
- [ ] Metrics tracking verified
- [ ] Logging verified
- [ ] Optional parameters tested

---

## Pattern Verification

### Correct Logging Pattern
```typescript
// ✅ At start
LoggerProxy.info('Starting operation', {
  module: CC_FILE,
  method: METHODS.METHOD_NAME,
});

// ✅ On success
LoggerProxy.log('Operation completed successfully', {
  module: CC_FILE,
  method: METHODS.METHOD_NAME,
  trackingId: result.trackingId,
});
```

### Correct Metrics Pattern
```typescript
// ✅ Start timing
this.metricsManager.timeEvent([
  METRIC_EVENT_NAMES.SUCCESS,
  METRIC_EVENT_NAMES.FAILED,
]);

// ✅ Track success
this.metricsManager.trackEvent(
  METRIC_EVENT_NAMES.SUCCESS,
  {...MetricsManager.getCommonTrackingFieldForAQMResponse(result)},
  ['behavioral', 'operational']
);

// ✅ Track failure
this.metricsManager.trackEvent(
  METRIC_EVENT_NAMES.FAILED,
  {...MetricsManager.getCommonTrackingFieldForAQMResponseFailed(failure)},
  ['behavioral', 'operational']
);
```

### Correct Error Pattern
```typescript
// ✅ 
const failure = error.details as Failure;
this.metricsManager.trackEvent(FAILED_EVENT, {...}, [...]);
const {error: detailedError} = getErrorDetails(error, METHOD, MODULE);
throw detailedError;
```

---

## Build & Test Verification

```bash
# Type check
yarn workspace @webex/contact-center typecheck

# Lint
yarn workspace @webex/contact-center lint

# Test
yarn workspace @webex/contact-center test

# Build
yarn workspace @webex/contact-center build
```

All should pass without errors.

---

## Complete!

Method addition is complete when all checkboxes are checked.
