# New Module - Test Generation Guide

> **Purpose**: Generate comprehensive unit tests for a new module.

---

## Prerequisites

- Module code generated from [`02-code-generation.md`](02-code-generation.md)
- Testing patterns loaded from [`../../patterns/testing-patterns.md`](../../patterns/testing-patterns.md)

---

## Step 1: Create Test Fixtures

```typescript
// src/ModuleName/fixtures.ts (or moduleNameFixtures.ts)

export const mockResponse = {
  statusCode: 200,
  body: {
    // Mock response data matching actual API structure
  },
};

export const mockErrorResponse = {
  statusCode: 500,
  body: {
    message: 'Internal Server Error',
  },
};

export const mockConfig = {
  // Mock configuration matching ModuleNameConfig
};

// Add more fixtures for each API endpoint or scenario
export const mockListResponse = {
  statusCode: 200,
  body: {
    items: [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' },
    ],
  },
};
```

---

## Step 2: Create Test File

```typescript
// src/ModuleName/ModuleName.test.ts

import { ModuleName, createModuleNameClient } from './ModuleName';
import { IModuleName } from './types';
import { getTestUtilsWebex } from '../common/testUtil';
import { WebexSDK } from '../SDKConnector/types';
import log from '../Logger';
import { mockResponse, mockErrorResponse, mockConfig } from './fixtures';

// Mock Logger
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
  let client: IModuleName;

  beforeEach(() => {
    webex = getTestUtilsWebex();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ============================================
  // INITIALIZATION
  // ============================================
  describe('initialization', () => {
    it('should create an instance via factory function', () => {
      client = createModuleNameClient(webex, mockConfig);
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(ModuleName);
    });

    it('should create an instance without config', () => {
      client = createModuleNameClient(webex);
      expect(client).toBeDefined();
    });

    it('should initialize logger when config has logger level', () => {
      client = createModuleNameClient(webex, {
        logger: { level: 'info' },
      });
      expect(log.setLogger).toHaveBeenCalled();
    });

    it('should log initialization', () => {
      client = createModuleNameClient(webex);
      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('initialized'),
        expect.objectContaining({
          file: expect.any(String),
          method: 'constructor',
        })
      );
    });
  });

  // ============================================
  // PUBLIC METHODS
  // ============================================
  describe('methodName()', () => {

    beforeEach(() => {
      client = createModuleNameClient(webex);
    });

    // --- Success ---
    it('should return expected data on success', async () => {
      webex.request = jest.fn().mockResolvedValue(mockResponse);

      const result = await client.methodName(param);

      expect(result).toEqual(mockResponse.body);
    });

    it('should call correct API endpoint', async () => {
      webex.request = jest.fn().mockResolvedValue(mockResponse);

      await client.methodName(param);

      expect(webex.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          uri: expect.stringContaining('expectedEndpoint'),
          addAuthHeader: true,
        })
      );
    });

    it('should log method invocation', async () => {
      webex.request = jest.fn().mockResolvedValue(mockResponse);

      await client.methodName(param);

      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('methodName'),
        expect.objectContaining({ file: expect.any(String) })
      );
    });

    // --- Error ---
    it('should handle API failure gracefully', async () => {
      webex.request = jest.fn().mockRejectedValue(new Error('Network error'));

      await expect(client.methodName(param)).rejects.toThrow('Network error');
    });

    it('should log error on failure', async () => {
      webex.request = jest.fn().mockRejectedValue(new Error('failure'));

      try {
        await client.methodName(param);
      } catch (e) {
        // Expected
      }

      expect(log.error).toHaveBeenCalledWith(
        expect.stringContaining('methodName failed'),
        expect.any(Object)
      );
    });

    // --- Edge Cases ---
    it('should handle empty response', async () => {
      webex.request = jest.fn().mockResolvedValue({
        statusCode: 200,
        body: {},
      });

      const result = await client.methodName(param);
      expect(result).toEqual({});
    });
  });

  // ============================================
  // EVENTS (if module emits events)
  // ============================================
  describe('events', () => {
    beforeEach(() => {
      client = createModuleNameClient(webex);
    });

    it('should emit event when [condition]', async () => {
      const callback = jest.fn();
      client.on('event_key', callback);

      // Trigger event
      await client.someAction();

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(expect.any(Object));

      client.off('event_key', callback);
    });
  });

  // Repeat for each public method...
});
```

---

## Step 3: Backend Connector Tests (if multi-backend)

```typescript
// src/ModuleName/WxCallBackendConnector.test.ts

import { WxCallBackendConnector } from './WxCallBackendConnector';
import { getTestUtilsWebex } from '../common/testUtil';

jest.mock('../Logger', () => ({
  default: {
    log: jest.fn(), info: jest.fn(), warn: jest.fn(),
    error: jest.fn(), trace: jest.fn(), setLogger: jest.fn(),
    getLogLevel: jest.fn(), setWebexLogger: jest.fn(),
  },
  __esModule: true,
}));

describe('WxCallBackendConnector', () => {
  let webex;
  let connector;

  beforeEach(() => {
    webex = getTestUtilsWebex();
    connector = new WxCallBackendConnector(webex);
    jest.clearAllMocks();
  });

  describe('methodName()', () => {
    it('should call WXC-specific endpoint', async () => {
      webex.request = jest.fn().mockResolvedValue({ statusCode: 200, body: {} });
      await connector.methodName(param);
      expect(webex.request).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: expect.stringContaining('wxc-endpoint'),
        })
      );
    });
  });
});
```

---

## Test Coverage Requirements

For each public method, ensure:

| Test Type | Required | Description |
|---|---|---|
| Success case | Yes | Happy path with valid input |
| API call verification | Yes | Correct endpoint, method, headers, body |
| Logger verification | Yes | Logs at entry and on error |
| Error handling | Yes | API failure, network error |
| Empty response | Recommended | Module handles empty/null data |
| Invalid input | Recommended | Module validates parameters |
| Event emission | If applicable | Events emitted with correct payload |
| Metric submission | If applicable | Metrics submitted for success/failure |

---

## Test Generation Checklist

- [ ] Test file created and co-located: `src/ModuleName/ModuleName.test.ts`
- [ ] Fixture file created: `src/ModuleName/fixtures.ts`
- [ ] Logger mocked
- [ ] Webex mocked via `getTestUtilsWebex()`
- [ ] Initialization tests (factory function, config, logging)
- [ ] Success tests for each public method
- [ ] Error tests for each public method
- [ ] Edge case tests
- [ ] Event tests (if applicable)
- [ ] Backend connector tests (if multi-backend)
- [ ] All tests pass: `yarn test:unit`
