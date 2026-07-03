# New Method - Tests

> **Purpose**: Create unit tests for the new method.

---

## Test Location

Add tests to the existing test file that corresponds to the source file:
- For `cc.ts` methods: `test/unit/spec/cc.ts`
- For service methods: `test/unit/spec/services/[service]/index.ts`
- For non-service files: `test/unit/spec/[filename].ts`

> **Convention**: The test file path mirrors the source file path under `test/unit/spec/`. For example:
> - `src/cc.ts` → `test/unit/spec/cc.ts`
> - `src/logger-proxy.ts` → `test/unit/spec/logger-proxy.ts`
> - `src/metrics/MetricsManager.ts` → `test/unit/spec/metrics/MetricsManager.ts`
> - `src/services/agent/index.ts` → `test/unit/spec/services/agent/index.ts`
> - `src/services/task/Task.ts` → `test/unit/spec/services/task/Task.ts`
> - `src/services/WebCallingService.ts` → `test/unit/spec/services/WebCallingService.ts`

---

## Test Template

```typescript
describe('cc.methodName', () => {
  // Mock data
  const mockParams = {
    requiredField: 'test-value',
  };
  
  const mockSuccessResponse = {
    data: {
      field: 'value',
    },
    trackingId: 'track-123',
  };
  
  const mockError = new Error('Operation failed');
  mockError.details = {
    type: 'OperationFailed',
    data: { reason: 'INVALID_INPUT' },
    trackingId: 'track-456',
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mock behavior
    mockServicesInstance.someService.method.mockResolvedValue(mockSuccessResponse);
  });

  describe('success scenarios', () => {
    it('should complete operation successfully', async () => {
      // Act
      const result = await webex.cc.methodName(mockParams);

      // Assert
      expect(result).toEqual(mockSuccessResponse);
      expect(mockServicesInstance.someService.method).toHaveBeenCalledWith({
        data: {
          requiredField: 'test-value',
          agentId: 'mock-agent-id',
        },
      });
    });

    it('should track success metrics', async () => {
      // Act
      await webex.cc.methodName(mockParams);

      // Assert
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        METRIC_EVENT_NAMES.OPERATION_SUCCESS,
        METRIC_EVENT_NAMES.OPERATION_FAILED,
      ]);
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.OPERATION_SUCCESS,
        {
          ...mockCommonTrackingFields,
          customField: 'test-value',
        },
        ['behavioral', 'operational']
      );
    });

    it('should log operation start and completion', async () => {
      // Act
      await webex.cc.methodName(mockParams);

      // Assert
      expect(LoggerProxy.info).toHaveBeenCalledWith(
        'Starting operation',
        {
          module: CC_FILE,
          method: METHODS.METHOD_NAME,
        }
      );
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        'Operation completed successfully',
        {
          module: CC_FILE,
          method: METHODS.METHOD_NAME,
          trackingId: 'track-123',
        }
      );
    });
  });

  describe('error scenarios', () => {
    it('should throw error on service failure', async () => {
      // Arrange
      mockServicesInstance.someService.method.mockRejectedValue(mockError);

      // Act & Assert
      await expect(webex.cc.methodName(mockParams)).rejects.toThrow();
    });

    it('should track failure metrics on error', async () => {
      // Arrange
      mockServicesInstance.someService.method.mockRejectedValue(mockError);

      // Act
      await expect(webex.cc.methodName(mockParams)).rejects.toThrow();

      // Assert
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        METRIC_EVENT_NAMES.OPERATION_FAILED,
        {
          ...mockCommonFailedTrackingFields,
          customField: 'test-value',
        },
        ['behavioral', 'operational']
      );
    });

    it('should call getErrorDetails on failure', async () => {
      // Arrange
      mockServicesInstance.someService.method.mockRejectedValue(mockError);

      // Act
      await expect(webex.cc.methodName(mockParams)).rejects.toThrow();

      // Assert
      expect(getErrorDetailsSpy).toHaveBeenCalledWith(
        mockError,
        METHODS.METHOD_NAME,
        CC_FILE
      );
    });
  });

  describe('input validation', () => {
    it('should handle optional parameters', async () => {
      // Arrange
      const paramsWithOptional = {
        ...mockParams,
        optionalField: 42,
      };

      // Act
      await webex.cc.methodName(paramsWithOptional);

      // Assert
      expect(mockServicesInstance.someService.method).toHaveBeenCalledWith({
        data: {
          requiredField: 'test-value',
          optionalField: 42,
          agentId: 'mock-agent-id',
        },
      });
    });
  });
});
```

---

## Test Assertion Guidelines

> **Team standard: Use exact matches, not partial matchers.** Always use `expect(result).toEqual(expectedValue)` with the full expected object. Avoid `expect.objectContaining()` or `expect.arrayContaining()` unless there is a specific reason (e.g., dynamic fields like timestamps). Exact assertions catch unintended payload changes early.

---

## Running Tests

```bash
# Run specific test file
yarn workspace @webex/contact-center test:unit -- <path_to_specific_file>

# Run with coverage
yarn workspace @webex/contact-center test:unit --coverage
```

---

## Next Step

Proceed to: [`04-validation.md`](04-validation.md)
