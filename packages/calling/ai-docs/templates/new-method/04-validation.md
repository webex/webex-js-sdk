# New Method -- Validation Checklist

> **Prerequisites**: Complete [`02-implementation.md`](02-implementation.md) and [`03-tests.md`](03-tests.md) before running validation.

---

## Code Quality Checklist

### Method Implementation

- [ ] Method has JSDoc comment with `@param` and `@returns` tags
- [ ] Method name is camelCase
- [ ] Method is added to the class interface in `types.ts` (if public)
- [ ] Logger called with `{ file: FILE_CONSTANT, method: METHODS.METHOD_NAME }` context
- [ ] Logger uses `log.info` for method entry (with `METHOD_START_MESSAGE`)
- [ ] Logger uses `log.error` for caught errors
- [ ] MetricManager submits success metric on happy path
- [ ] MetricManager submits failure metric on error path
- [ ] Error created using `createCallError` / `createLineError` (not `new Error()`)
- [ ] Error event emitted to consumer on failure
- [ ] No `console.log` statements
- [ ] No `any` types (use proper typing or `unknown` + type assertion)
- [ ] Async methods return `Promise<T>` (not callbacks)

### Constants

- [ ] Method name added to `METHODS` object in `src/CallingClient/constants.ts`
- [ ] Handler method name added to `METHODS` (if using Pattern 2 with state machine)
- [ ] File constant used (e.g., `CALL_FILE`, `LINE_FILE`, `CALLING_CLIENT_FILE`)
- [ ] Supplementary service added to `SUPPLEMENTARY_SERVICES` enum (if applicable)

### Types

- [ ] Parameter types defined in module's `types.ts`
- [ ] Return type defined in module's `types.ts` (if custom type)
- [ ] Method added to public interface (e.g., `ICall`, `ILine`, `ICallingClient`)
- [ ] Event handler type added to `CallEventTypes` / `LineEventTypes` (if new events)
- [ ] Types exported from `src/api.ts` (if consumer-facing)

### Tests

- [ ] Test file is co-located (`.test.ts` next to source)
- [ ] Success path tested (complete operation, verify API call)
- [ ] Success metric submission verified
- [ ] Success logging verified
- [ ] Error path tested (API failure handled)
- [ ] Failure metric submission verified
- [ ] Error event emission verified
- [ ] Error logging verified
- [ ] Input validation tested (optional params, precondition failures)
- [ ] Timeout handling tested (if using supplementary services timer)

---

## Pattern Verification

### Logging

**Correct** -- Logger with file and method context:

```typescript
log.info(`${METHOD_START_MESSAGE} with: ${this.getCorrelationId()}`, {
  file: CALL_FILE,
  method: METHODS.HANDLE_CALL_HOLD,
});
```

**Incorrect** -- Missing context, wrong logger, or string literals:

```typescript
// WRONG: No context object
log.info('Starting hold operation');

// WRONG: String literals instead of constants
log.info('Starting hold operation', {file: 'call', method: 'handleCallHold'});

// WRONG: Using console instead of Logger module
console.log('Starting hold operation');

// WRONG: Using LoggerProxy (that is the contact-center SDK pattern, not calling)
LoggerProxy.logger.info('Starting hold operation');
```

### Error Logging Level Guide

Use the correct log level for each situation (summary below; canonical guidance lives in `../../patterns/typescript-patterns.md`):

| Level | Usage | Example |
|---|---|---|
| `log.error` | Caught exceptions, API failures, unrecoverable errors | `log.error('Failed to park call: ...', logContext)` |
| `log.warn` | Recoverable issues, timeouts, degraded behavior | `log.warn('Park response timed out', logContext)` |
| `log.info` | Method entry/exit, significant state changes | `log.info('${METHOD_START_MESSAGE} with: ...', logContext)` |
| `log.log` | Diagnostic details (response codes, intermediate states) | `log.log('Response code: ${response.statusCode}', logContext)` |
| `log.trace` | Verbose debugging (payloads, full objects) | `log.trace('Full response: ${JSON.stringify(body)}', logContext)` |

### Metrics

**Correct** -- Using the `submitCallMetric` helper with proper enum values:

```typescript
// Success metric
const actionName = METHODS.HANDLE_CALL_HOLD;
this.metricManager.submitCallMetric(
  METRIC_EVENT.CALL,
  actionName,                    // action constant/variable
  METRIC_TYPE.BEHAVIORAL,
  this.getCallId(),
  this.getCorrelationId(),
  undefined                      // no error
);

// Error metric (via the private helper)
this.submitCallErrorMetric(callError);
```

**Incorrect** -- Wrong metric method, missing parameters, or string literals:

```typescript
// WRONG: Using getMetricManager() inside Call class (it has this.metricManager)
getMetricManager().submitCallMetric(...);

// WRONG: Using method constant where METRIC_EVENT enum is expected
this.metricManager.submitCallMetric(METRIC_EVENT.CALL, METHODS.HANDLE_CALL_HOLD, METRIC_TYPE.BEHAVIORAL, ...);

// WRONG: Hardcoded action string and missing callId/correlationId
this.metricManager.submitCallMetric(METRIC_EVENT.CALL, 'doHoldResume', METRIC_TYPE.BEHAVIORAL);
```

> **Note**: `getMetricManager()` is used in utility functions (e.g., `src/common/Utils.ts`) that do not have a class instance. Inside class methods that have `this.metricManager`, always use the instance property.

### Error Handling

**Correct** -- Full error handling chain: create error -> log -> metric -> emit -> throw/recover:

```typescript
catch (e) {
  // 1. Log the error
  log.error(`Failed to park call: ${JSON.stringify(e)}`, {
    file: CALL_FILE,
    method: METHODS.HANDLE_CALL_HOLD,
  });

  // 2. Create typed error
  const errData = e as MobiusCallResponse;
  const callError = createCallError(
    'An error occurred while parking the call. Wait a moment and try again.',
    {file: CALL_FILE, method: METHODS.HANDLE_CALL_HOLD} as ErrorContext,
    ERROR_TYPE.CALL_ERROR,
    this.getCorrelationId(),
    ERROR_LAYER.CALL_CONTROL
  );

  // 3. Submit failure metric
  this.submitCallErrorMetric(callError);

  // 4. Emit error event to consumer
  this.emit(CALL_EVENT_KEYS.HOLD_ERROR, callError);

  // 5. Recover state machine (if applicable)
  this.sendCallStateMachineEvt({type: 'E_CALL_ESTABLISHED', data: errData});
}
```

**Common mistakes**:

```typescript
// WRONG: Swallowing the error
catch (e) {
  console.error(e);
}

// WRONG: Throwing raw error instead of typed CallError
catch (e) {
  throw e;
}

// WRONG: Missing metric submission
catch (e) {
  const callError = createCallError(...);
  this.emit(CALL_EVENT_KEYS.HOLD_ERROR, callError);
  // Forgot: this.submitCallErrorMetric(callError);
}

// WRONG: Missing event emission
catch (e) {
  const callError = createCallError(...);
  this.submitCallErrorMetric(callError);
  // Forgot: this.emit(CALL_EVENT_KEYS.HOLD_ERROR, callError);
}
```

### Using handleCallErrors Utility

For methods that need to map HTTP status codes to specific error types, use the `handleCallErrors` utility from `src/common/Utils.ts`:

**Correct**:

```typescript
catch (e) {
  log.error(`Failed to park call: ${JSON.stringify(e)}`, {
    file: CALL_FILE,
    method: METHODS.HANDLE_CALL_HOLD,
  });
  const errData = e as MobiusCallResponse;

  handleCallErrors(
    (error: CallError) => {
      this.emit(CALL_EVENT_KEYS.HOLD_ERROR, error);
      this.submitCallErrorMetric(error);
      this.sendCallStateMachineEvt({type: 'E_CALL_ESTABLISHED', data: errData});
    },
    ERROR_LAYER.CALL_CONTROL,
    // For docs/examples, prefer explicit callback over test-coverage pragmas.
    (interval: number) => undefined,
    this.getCorrelationId(),
    errData,
    METHODS.HANDLE_CALL_HOLD,
    CALL_FILE
  );
}
```

---

## Build & Test Verification

Run all three commands from the `packages/calling` directory. All must pass before the method is considered complete.

### Build

```bash
cd packages/calling
yarn build
```

Verifies: TypeScript compilation succeeds, no type errors, all imports resolve.

### Unit Tests

```bash
cd packages/calling
yarn test:unit
```

Verifies: All existing tests still pass (no regressions), all new tests pass.

### Lint / Style

```bash
cd packages/calling
yarn test:style
```

Verifies: ESLint rules pass, no formatting issues, JSDoc present on public methods.

---

## Final Summary

Once all checklist items pass and all three build commands succeed, the new method implementation is complete. Provide a summary to the developer:

```
## Implementation Complete

**Method**: `<methodName>` on `<ClassName>`
**File**: `<source file path>`
**Test file**: `<test file path>`

### Files modified:
1. `<source file>` -- Added method implementation
2. `<types file>` -- Added types and interface declaration
3. `<constants file>` -- Added METHODS constant
4. `<Events/types.ts>` -- Added event keys and handler types (if applicable)
5. `<Metrics/types.ts>` -- Added metric event (if applicable)
6. `<test file>` -- Added unit tests

### Verification:
- yarn build: PASS
- yarn test:unit: PASS
- yarn test:style: PASS
```
