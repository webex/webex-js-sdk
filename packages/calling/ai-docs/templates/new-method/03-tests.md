# New Method - Test Template

> **Purpose**: Generate unit tests for a new method following calling package conventions.

---

## Prerequisites

- Method implemented from [`02-implementation.md`](02-implementation.md)
- Testing patterns loaded from [`../../patterns/testing-patterns.md`](../../patterns/testing-patterns.md)

---

## Test File Location

Tests are co-located with source. Add tests to the existing test file:

```
src/ModuleName/ModuleName.test.ts      # For top-level module methods
src/CallingClient/calling/call.test.ts  # For Call methods
src/CallingClient/line/line.test.ts     # For Line methods
```

---

## Test Template

```typescript
import { getTestUtilsWebex } from '../common/testUtil';
import log from '../Logger';
import { WebexSDK } from '../SDKConnector/types';
import { CALL_EVENT_KEYS, CALLING_CLIENT_EVENT_KEYS } from '../Events/types';
import { METRIC_EVENT, METRIC_TYPE } from '../Metrics/types';

// Mock Logger (if not already mocked in the test file)
jest.mock('../Logger', () => ({
  default: {
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    trace: jest.fn(),
    setLogger: jest.fn(),
    getLogLevel: jest.fn(),
    setWebexLogger: jest.fn(),
  },
  __esModule: true,
}));

describe('ModuleName', () => {
  let webex: WebexSDK;
  // ... module setup

  beforeEach(() => {
    webex = getTestUtilsWebex();
    jest.clearAllMocks();
    // ... module initialization
  });

  // ============================================
  // NEW METHOD TESTS
  // ============================================
  describe('newMethod()', () => {

    // --- Success Cases ---

    it('should [expected behavior] when [normal conditions]', async () => {
      // Arrange
      const expectedResponse = { /* mock response */ };
      webex.request = jest.fn().mockResolvedValue({
        statusCode: 200,
        body: expectedResponse,
      });

      // Act
      const result = await module.newMethod(param1, param2);

      // Assert
      expect(result).toEqual(expectedResponse);
      expect(webex.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          uri: expect.stringContaining('expectedEndpoint'),
        })
      );
    });

    it('should log success with correct context', async () => {
      // Arrange
      webex.request = jest.fn().mockResolvedValue({ statusCode: 200, body: {} });

      // Act
      await module.newMethod(param1);

      // Assert
      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('newMethod'),
        expect.objectContaining({
          file: expect.any(String),
          method: expect.any(String),
        })
      );
    });

    it('should submit success metric', async () => {
      // Arrange
      webex.request = jest.fn().mockResolvedValue({ statusCode: 200, body: {} });
      const metricSpy = jest.spyOn(metricManager, 'submitCallMetric');

      // Act
      await module.newMethod(param1);

      // Assert
      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT.CALL,
        'newMethod',
        METRIC_TYPE.BEHAVIORAL,
        expect.any(String), // callId
        expect.any(String)  // correlationId
      );
    });

    // --- Error Cases ---

    it('should handle API failure', async () => {
      // Arrange
      webex.request = jest.fn().mockRejectedValue(new Error('Service unavailable'));

      // Act & Assert
      await expect(module.newMethod(param1)).rejects.toThrow();
    });

    it('should log error with context on failure', async () => {
      // Arrange
      webex.request = jest.fn().mockRejectedValue(new Error('failure'));

      // Act
      try {
        await module.newMethod(param1);
      } catch (e) {
        // Expected
      }

      // Assert
      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('newMethod failed'),
        expect.objectContaining({
          file: expect.any(String),
          method: expect.any(String),
        })
      );
    });

    it('should submit error metric on failure', async () => {
      // Arrange
      webex.request = jest.fn().mockRejectedValue(new Error('failure'));
      const metricSpy = jest.spyOn(metricManager, 'submitCallMetric');

      // Act
      try {
        await module.newMethod(param1);
      } catch (e) {
        // Expected
      }

      // Assert
      expect(metricSpy).toHaveBeenCalledWith(
        METRIC_EVENT.CALL_ERROR,
        'newMethod',
        METRIC_TYPE.BEHAVIORAL,
        expect.any(String),
        expect.any(String),
        expect.any(Object)  // CallError
      );
    });

    it('should emit error event on failure', async () => {
      // Arrange
      webex.request = jest.fn().mockRejectedValue(new Error('failure'));
      const emitSpy = jest.spyOn(module, 'emit');

      // Act
      try {
        await module.newMethod(param1);
      } catch (e) {
        // Expected
      }

      // Assert
      expect(emitSpy).toHaveBeenCalledWith(
        CALL_EVENT_KEYS.CALL_ERROR,
        expect.any(Object)
      );
    });

    // --- Edge Cases ---

    it('should handle optional parameters', async () => {
      // Arrange
      webex.request = jest.fn().mockResolvedValue({ statusCode: 200, body: {} });

      // Act - call without optional param
      const result = await module.newMethod(param1);

      // Assert
      expect(result).toBeDefined();
    });

    // Add more edge cases based on requirements:
    // - Invalid input handling
    // - Precondition failures (e.g., not registered)
    // - Concurrent call handling
    // - Timeout scenarios
  });
});
```

---

## Event Emission Test Pattern

If the method emits events:

```typescript
it('should emit [EVENT_NAME] when [condition]', async () => {
  // Arrange
  const callback = jest.fn();
  module.on(CALL_EVENT_KEYS.NEW_EVENT, callback);
  webex.request = jest.fn().mockResolvedValue({ statusCode: 200, body: mockData });

  // Act
  await module.newMethod(param1);

  // Assert
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback).toHaveBeenCalledWith(
    expect.objectContaining({ /* expected payload */ })
  );

  // Cleanup
  module.off(CALL_EVENT_KEYS.NEW_EVENT, callback);
});
```

---

## Test Checklist

- [ ] Success case tested
- [ ] API call verified (endpoint, method, body)
- [ ] Logger calls verified (info for success, error for failure)
- [ ] Success metric submission verified
- [ ] Error metric submission verified
- [ ] Error event emission verified (if applicable)
- [ ] Optional parameter handling tested
- [ ] Edge cases covered
- [ ] All tests pass with `yarn test:unit`
