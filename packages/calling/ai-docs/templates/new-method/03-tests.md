# New Method -- Tests

> **Prerequisites**: Complete [`02-implementation.md`](02-implementation.md) before writing tests.

---

## Test Location Convention

Tests in the calling SDK are **co-located** with their source files. The test file lives next to the source file with a `.test.ts` extension.

| Source File | Test File |
|---|---|
| `src/CallingClient/calling/call.ts` | `src/CallingClient/calling/call.test.ts` |
| `src/CallingClient/CallingClient.ts` | `src/CallingClient/CallingClient.test.ts` |
| `src/CallingClient/line/index.ts` | `src/CallingClient/line/line.test.ts` |
| `src/CallingClient/registration/register.ts` | `src/CallingClient/registration/register.test.ts` |
| `src/CallingClient/calling/callManager.ts` | `src/CallingClient/calling/callManager.test.ts` |
| `src/CallHistory/CallHistory.ts` | `src/CallHistory/CallHistory.test.ts` |
| `src/Voicemail/Voicemail.ts` | `src/Voicemail/Voicemail.test.ts` |
| `src/common/Utils.ts` | `src/common/Utils.test.ts` |
| `src/Metrics/index.ts` | `src/Metrics/index.test.ts` |

---

## Test Setup Pattern

Every test file in the calling SDK follows this setup pattern:

```typescript
import {ERROR_TYPE, ERROR_LAYER} from '../../Errors/types';
import * as Utils from '../../common/Utils';
import {CALL_EVENT_KEYS, CallEvent} from '../../Events/types';
import {METRIC_EVENT, METRIC_TYPE} from '../../Metrics/types';
import {Call, createCall} from './call';
import {getTestUtilsWebex, flushPromises} from '../../common/testUtil';
import log from '../../Logger';
import {CallError} from '../../Errors';

const webex = getTestUtilsWebex();
```

Key points:
- Use `getTestUtilsWebex()` from `src/common/testUtil.ts` to create a mock Webex instance
- Use `flushPromises()` from the same file to flush async operations in tests
- Import `log` from `../../Logger` for log spy assertions
- Use `jest.spyOn()` to spy on utility functions, Logger methods, and metric submissions
- Use `jest.fn()` for mock callbacks

---

## Test Template

Add your test block within the existing `describe` block of the test file (do not create a new top-level describe). The structure should be:

```typescript
describe('<MethodName> tests', () => {
  // --- Setup specific to this method ---
  let call: Call;
  const logInfoSpy = jest.spyOn(log, 'info');
  const logErrorSpy = jest.spyOn(log, 'error');
  const logWarnSpy = jest.spyOn(log, 'warn');

  beforeEach(() => {
    // Reset mocks, create fresh call instance
    jest.clearAllMocks();

    // Create a call instance (adapt parameters to your test context)
    call = createCall(
      activeUrl,
      webex,
      CallDirection.OUTBOUND,
      deviceId,
      mockLineId,
      deleteCallFromCollection,
      defaultServiceIndicator,
      dest
    );

    // Set up call state as needed for the method under test
    call['connected'] = true;
    call['callId'] = 'test-call-id';
  });

  afterEach(() => {
    call.removeAllListeners();
  });

  // --- Success Tests ---
  describe('Success', () => {
    it('should complete the operation successfully', async () => {
      // Arrange
      const mockResponse = {
        statusCode: 200,
        body: {/* expected response body */},
      };
      webex.request.mockResolvedValueOnce(mockResponse);

      // Act
      call.methodName(param1);
      await flushPromises();

      // Assert — verify the API was called
      expect(webex.request).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: expect.stringContaining('/expected/endpoint'),
          method: 'POST',
        })
      );
    });

    it('should submit success metric', async () => {
      // Arrange
      const mockResponse = {statusCode: 200, body: {}};
      webex.request.mockResolvedValueOnce(mockResponse);
      const metricSpy = jest.spyOn(call['metricManager'], 'submitCallMetric');

      // Act
      call.methodName(param1);
      await flushPromises();

      // Assert
      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT.CALL,
        expect.any(String),
        METRIC_TYPE.BEHAVIORAL,
        expect.any(String),  // callId
        expect.any(String),  // correlationId
        undefined
      );
    });

    it('should log method invocation', async () => {
      // Arrange
      const mockResponse = {statusCode: 200, body: {}};
      webex.request.mockResolvedValueOnce(mockResponse);

      // Act
      call.methodName(param1);
      await flushPromises();

      // Assert
      expect(logInfoSpy).toHaveBeenCalledWith(
        expect.stringContaining('invoking'),
        expect.objectContaining({
          file: 'call',
          method: 'methodName',
        })
      );
    });
  });

  // --- Error Tests ---
  describe('Error handling', () => {
    it('should handle API failure', async () => {
      // Arrange
      const mockError = {
        statusCode: 500,
        body: {message: 'Internal Server Error'},
      };
      webex.request.mockRejectedValueOnce(mockError);

      // Act
      call.methodName(param1);
      await flushPromises();

      // Assert
      expect(logErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed'),
        expect.objectContaining({
          file: 'call',
          method: 'methodName',
        })
      );
    });

    it('should submit failure metric on error', async () => {
      // Arrange
      const mockError = {statusCode: 500, body: {}};
      webex.request.mockRejectedValueOnce(mockError);
      const errorMetricSpy = jest.spyOn(call as any, 'submitCallErrorMetric');

      // Act
      call.methodName(param1);
      await flushPromises();

      // Assert
      expect(errorMetricSpy).toHaveBeenCalledWith(
        expect.any(CallError)
      );
    });

    it('should emit error event on failure', async () => {
      // Arrange
      const mockError = {statusCode: 500, body: {}};
      webex.request.mockRejectedValueOnce(mockError);
      const errorHandler = jest.fn();
      call.on(CALL_EVENT_KEYS.METHOD_ERROR, errorHandler);

      // Act
      call.methodName(param1);
      await flushPromises();

      // Assert
      expect(errorHandler).toHaveBeenCalledWith(
        expect.any(CallError)
      );
    });

    it('should log error on API failure', async () => {
      // Arrange
      const mockError = {statusCode: 404, body: {message: 'Call not found'}};
      webex.request.mockRejectedValueOnce(mockError);

      // Act
      call.methodName(param1);
      await flushPromises();

      // Assert
      expect(logErrorSpy).toHaveBeenCalled();
    });
  });

  // --- Input Validation Tests ---
  describe('Input validation', () => {
    it('should handle optional parameters being undefined', async () => {
      // Arrange
      const mockResponse = {statusCode: 200, body: {}};
      webex.request.mockResolvedValueOnce(mockResponse);

      // Act — call without optional parameter
      call.methodName(param1);
      await flushPromises();

      // Assert — should succeed without error
      expect(logErrorSpy).not.toHaveBeenCalled();
    });

    it('should handle precondition failure (e.g., call not connected)', () => {
      // Arrange
      call['connected'] = false;

      // Act
      call.methodName(param1);

      // Assert — should warn and return early
      expect(logWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot'),
        expect.objectContaining({
          file: 'call',
          method: 'methodName',
        })
      );
      expect(webex.request).not.toHaveBeenCalled();
    });
  });

  // --- Supplementary Services Timeout Tests (if applicable) ---
  describe('Timeout handling', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should emit error event on supplementary services timeout', async () => {
      // Arrange
      const mockResponse = {statusCode: 200, body: {}};
      webex.request.mockResolvedValueOnce(mockResponse);
      const errorHandler = jest.fn();
      call.on(CALL_EVENT_KEYS.METHOD_ERROR, errorHandler);

      // Act
      call.methodName(param1);
      await flushPromises();

      // Advance time past SUPPLEMENTARY_SERVICES_TIMEOUT (10000ms)
      jest.advanceTimersByTime(10000);
      await flushPromises();

      // Assert
      expect(errorHandler).toHaveBeenCalledWith(
        expect.any(CallError)
      );
    });
  });
});
```

---

## Testing with handleCallErrors Utility

Many methods in the calling SDK delegate error handling to the `handleCallErrors` utility from `src/common/Utils.ts`. To test this pattern:

```typescript
import * as Utils from '../../common/Utils';

const handleErrorSpy = jest.spyOn(Utils, 'handleCallErrors');

it('should invoke handleCallErrors on API failure', async () => {
  // Arrange
  const mockError = {statusCode: 500, body: {}};
  webex.request.mockRejectedValueOnce(mockError);

  // Act
  call.methodName(param1);
  await flushPromises();

  // Assert
  expect(handleErrorSpy).toHaveBeenCalledWith(
    expect.any(Function),        // error callback
    ERROR_LAYER.CALL_CONTROL,    // error layer
    expect.any(Function),        // retry callback
    expect.any(String),          // correlationId
    expect.objectContaining({    // error data
      statusCode: 500,
    }),
    'methodName',                // method name (METHODS constant value)
    'call'                       // file name (FILE constant value)
  );
});
```

---

## Testing Event Emission

```typescript
it('should emit success event when WebSocket state change arrives', async () => {
  // Arrange
  const mockResponse = {statusCode: 200, body: {}};
  webex.request.mockResolvedValueOnce(mockResponse);
  const successHandler = jest.fn();
  call.on(CALL_EVENT_KEYS.HELD, successHandler);

  // Act — trigger the method
  call.doHoldResume();
  await flushPromises();

  // Simulate the Mercury WebSocket event arriving
  const midCallEvent = {
    eventType: 'callState',
    eventData: {
      callState: 'HELD',
    },
  };
  call['handleMidCallEvent'](midCallEvent as unknown as CallEvent);
  await flushPromises();

  // Assert
  expect(successHandler).toHaveBeenCalledWith(call.getCorrelationId());
});
```

---

## Running Tests

### Run all tests for the calling package

```bash
cd packages/calling
yarn test:unit
```

### Run a specific test file

```bash
cd packages/calling
yarn jest src/CallingClient/calling/call.test.ts
```

### Run tests matching a pattern

```bash
cd packages/calling
yarn jest --testPathPattern="call.test" --verbose
```

### Run a specific describe block

```bash
cd packages/calling
yarn jest src/CallingClient/calling/call.test.ts -t "doHoldResume tests"
```

### Run lint check

```bash
cd packages/calling
yarn test:style
```

---

## Next Step

Once all tests pass, proceed to **[04-validation.md](04-validation.md)** for the final quality checklist.
