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

### Error Logging — `error` vs `warn`

| Level | When to Use | Stack Trace Included? |
|---|---|---|
| `LoggerProxy.error()` | Operation failures, API errors, exceptions in catch blocks | **Yes** — full stack trace is appended automatically |
| `LoggerProxy.warn()` | Non-critical issues that don't break flow (e.g., deprecation notices, fallback behavior) | **No** — only the message is logged |

> **Current codebase convention**: `LoggerProxy.error()` is used extensively across the SDK. `LoggerProxy.warn()` is not currently used in any source file. Default to `error` for catch blocks and failure paths.

```typescript
// ✅ Error — in catch blocks and failure paths (includes stack trace)
LoggerProxy.error(`${methodName} failed with reason: ${reason}`, {
  module: moduleName,
  method: methodName,
  trackingId: failure?.trackingId,
});

// ✅ Error — via getErrorDetails (logs error + uploads logs automatically)
// Most methods use this pattern instead of calling LoggerProxy.error() directly
const {error: detailedError} = getErrorDetails(error, METHODS.METHOD_NAME, CC_FILE);

// ⚠️ Warn — for non-critical issues only (no stack trace)
LoggerProxy.warn('Falling back to default configuration', {
  module: CC_FILE,
  method: METHODS.METHOD_NAME,
});
```

> **Note**: `getErrorDetails()` (in `src/services/core/Utils.ts`) already calls `LoggerProxy.error()` internally and uploads logs via `WebexRequest.uploadLogs()`. Do not double-log errors when using `getErrorDetails`.

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
# Lint
yarn workspace @webex/contact-center test:styles

# Test unit tests
yarn workspace @webex/contact-center test:unit

# Build
yarn workspace @webex/contact-center build:src
```

All should pass without errors.

---

## Complete!

Method addition is complete when all checkboxes are checked.
