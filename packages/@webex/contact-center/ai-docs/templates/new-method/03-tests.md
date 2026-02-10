# New Method - Tests

> **Purpose**: Create unit tests for the new method.

---

## Test Location

Add tests to existing test file or create new one:
- For `cc.ts` methods: `test/unit/spec/cc.ts`
- For service methods: `test/unit/spec/services/[service]/index.ts`

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
        data: expect.objectContaining({
          requiredField: 'test-value',
        }),
      });
    });

    it('should track success metrics', async () => {
      // Act
      await webex.cc.methodName(mockParams);

      // Assert
      expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
        expect.stringContaining('SUCCESS'),
        expect.stringContaining('FAILED'),
      ]);
      expect(mockMetricsManager.trackEvent).toHaveBeenCalledWith(
        expect.stringContaining('SUCCESS'),
        expect.any(Object),
        expect.any(Array)
      );
    });

    it('should log operation start and completion', async () => {
      // Act
      await webex.cc.methodName(mockParams);

      // Assert
      expect(LoggerProxy.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          module: expect.any(String),
          method: expect.any(String),
        })
      );
      expect(LoggerProxy.log).toHaveBeenCalledWith(
        expect.stringContaining('successfully'),
        expect.any(Object)
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
        expect.stringContaining('FAILED'),
        expect.any(Object),
        expect.any(Array)
      );
    });

    it('should call getErrorDetails on failure', async () => {
      // Arrange
      mockServicesInstance.someService.method.mockRejectedValue(mockError);

      // Act
      await expect(webex.cc.methodName(mockParams)).rejects.toThrow();

      // Assert
      expect(getErrorDetailsSpy).toHaveBeenCalledWith(
        expect.any(Error),
        'methodName',
        expect.any(String)
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
        data: expect.objectContaining({
          optionalField: 42,
        }),
      });
    });
  });
});
```

---

## Running Tests

```bash
# Run specific test
yarn workspace @webex/contact-center test -- --testPathPattern=cc --testNamePattern="methodName"

# Run with coverage
yarn workspace @webex/contact-center test -- --coverage
```

---

## Next Step

Proceed to: [`04-validation.md`](04-validation.md)
