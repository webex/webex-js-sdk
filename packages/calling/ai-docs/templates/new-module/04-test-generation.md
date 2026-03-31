# Test Generation

Write co-located Jest tests for the new module. Tests must live alongside the source files they test, following the established convention in this package.

---

## Test Location Convention

Tests are always co-located with the source file:

| Source File | Test File |
|------------|-----------|
| `src/ModuleName/ModuleName.ts` | `src/ModuleName/ModuleName.test.ts` |
| `src/ModuleName/WxCallBackendConnector.ts` | `src/ModuleName/WxCallBackendConnector.test.ts` |
| `src/ModuleName/BroadworksBackendConnector.ts` | `src/ModuleName/BroadworksBackendConnector.test.ts` |
| `src/ModuleName/UcmBackendConnector.ts` | `src/ModuleName/UcmBackendConnector.test.ts` |

Fixture files are also co-located:

| Fixture File | Purpose |
|-------------|---------|
| `src/ModuleName/moduleNameFixtures.ts` | Mock response data, mock events, test constants |

---

## Full Test Template

### Main Service Class Test (`ModuleName.test.ts`)

```typescript
// src/ModuleName/ModuleName.test.ts

import {LOGGER} from '../Logger/types';
import {getTestUtilsWebex} from '../common/testUtil';
import {
  CALLING_BACKEND,
  HTTP_METHODS,
  WebexRequestPayload,
} from '../common/types';
import {ModuleName, createModuleNameClient} from './ModuleName';
import {IModuleName} from './types';
import {MODULE_NAME_FILE, METHODS} from './constants';
import {METHOD_START_MESSAGE} from '../common/constants';
import log from '../Logger';
import * as utils from '../common/Utils';
// Import fixtures:
import {
  MOCK_SUCCESS_RESPONSE_BODY,
  MOCK_ERROR_RESPONSE_400,
  MOCK_ERROR_RESPONSE_401,
  // MOCK_EVENT_PAYLOAD,           // If module handles events
  // MOCK_EVENT_PAYLOAD_LEGACY,    // If module handles multiple event formats
} from './moduleNameFixtures';
// If module emits events:
// import {COMMON_EVENT_KEYS, MOBIUS_EVENT_KEYS} from '../Events/types';

const webex = getTestUtilsWebex();
let uploadLogsSpy: jest.SpyInstance;

describe('ModuleName tests', () => {
  let moduleName: IModuleName;
  const infoSpy = jest.spyOn(log, 'info').mockImplementation();
  const logSpy = jest.spyOn(log, 'log').mockImplementation();
  const errorSpy = jest.spyOn(log, 'error').mockImplementation();
  const warnSpy = jest.spyOn(log, 'warn').mockImplementation();

  beforeAll(() => {
    moduleName = new ModuleName(webex, {level: LOGGER.INFO});
    uploadLogsSpy = jest.spyOn(utils, 'uploadLogs').mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // Initialization Tests
  // ==========================================

  describe('initialization', () => {
    it('should create an instance via factory function', () => {
      const client = createModuleNameClient(webex, {level: LOGGER.INFO});

      expect(client).toBeTruthy();
      expect(client).toBeInstanceOf(ModuleName);
    });

    it('should initialize SDKConnector with webex', () => {
      const client = createModuleNameClient(webex, {level: LOGGER.INFO});

      // SDKConnector should have webex set
      expect(client).toBeTruthy();
    });
  });

  // ==========================================
  // Method Tests: getData (success cases)
  // ==========================================

  describe('getData', () => {
    it('should return success response on valid request', async () => {
      const mockPayload = MOCK_SUCCESS_RESPONSE_BODY as unknown as WebexRequestPayload;
      webex.request.mockResolvedValue(mockPayload);

      const response = await moduleName.getData(/* params */);

      expect(response.statusCode).toBe(200);
      expect(response.message).toBe('SUCCESS');
      // Verify data shape:
      // expect(response.data.items).toBeDefined();
      // expect(response.data.items.length).toBeGreaterThan(0);

      // Verify logging:
      expect(infoSpy).toHaveBeenCalledWith(
        expect.stringContaining(METHOD_START_MESSAGE),
        {file: MODULE_NAME_FILE, method: METHODS.GET_DATA}
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully'),
        {file: MODULE_NAME_FILE, method: METHODS.GET_DATA}
      );
      expect(errorSpy).not.toHaveBeenCalled();
      expect(uploadLogsSpy).not.toHaveBeenCalled();
    });

    // Add parameterized tests for different valid inputs:
    // it('should handle default parameters', async () => { ... });
    // it('should handle custom sort order', async () => { ... });
  });

  // ==========================================
  // Method Tests: getData (error cases)
  // ==========================================

  describe('getData error handling', () => {
    it('should handle 400 Bad Request', async () => {
      const failurePayload = {statusCode: 400};
      webex.request.mockRejectedValue(failurePayload);

      const response = await moduleName.getData(/* params */);

      expect(response.statusCode).toBe(400);
      expect(response.message).toBe('FAILURE');

      // Verify error logging:
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get data'),
        {file: MODULE_NAME_FILE, method: METHODS.GET_DATA}
      );
      expect(uploadLogsSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle 401 Unauthorized', async () => {
      const failurePayload = {statusCode: 401};
      webex.request.mockRejectedValue(failurePayload);

      const response = await moduleName.getData(/* params */);

      expect(response.statusCode).toBe(401);
      expect(response.message).toBe('FAILURE');
      expect(uploadLogsSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle 404 Not Found', async () => {
      const failurePayload = {statusCode: 404};
      webex.request.mockRejectedValue(failurePayload);

      const response = await moduleName.getData(/* params */);

      expect(response.statusCode).toBe(404);
      expect(response.message).toBe('FAILURE');
    });

    it('should handle 500 Internal Server Error', async () => {
      const failurePayload = {statusCode: 500};
      webex.request.mockRejectedValue(failurePayload);

      const response = await moduleName.getData(/* params */);

      expect(response.statusCode).toBe(500);
      expect(response.message).toBe('FAILURE');
    });
  });

  // ==========================================
  // Method Tests: Additional methods
  // ==========================================

  // Repeat the success/error pattern for each public method:
  // describe('updateRecord', () => { ... });
  // describe('deleteRecord', () => { ... });

  // ==========================================
  // Edge Cases
  // ==========================================

  describe('edge cases', () => {
    it('should handle empty response body gracefully', async () => {
      const emptyPayload = {
        statusCode: 200,
        body: {},
        headers: {trackingid: 'test-tracking-id'},
      } as unknown as WebexRequestPayload;
      webex.request.mockResolvedValue(emptyPayload);

      const response = await moduleName.getData(/* params */);

      expect(response.statusCode).toBe(200);
      // Verify graceful handling of empty/missing data
    });

    // it('should handle malformed input', async () => { ... });
    // it('should handle network timeout', async () => { ... });
  });

  // ==========================================
  // Event Tests (if module emits events)
  // ==========================================

  // describe('event handling', () => {
  //   it('should emit event when Mercury session data is received', () => {
  //     const emitSpy = jest.spyOn(moduleName, 'emit');
  //
  //     // Directly invoke the handler (simulating Mercury event):
  //     moduleName['handleSomeEvent'](MOCK_EVENT_PAYLOAD);
  //
  //     expect(emitSpy).toHaveBeenCalledWith(
  //       COMMON_EVENT_KEYS.MODULE_EVENT_KEY,
  //       MOCK_EVENT_PAYLOAD
  //     );
  //   });
  //
  //   it('should not emit event when payload is undefined', () => {
  //     const emitSpy = jest.spyOn(moduleName, 'emit');
  //
  //     moduleName['handleSomeEvent'](undefined);
  //
  //     expect(emitSpy).not.toHaveBeenCalled();
  //   });
  //
  //   it('should not emit event when payload data is missing', () => {
  //     const emitSpy = jest.spyOn(moduleName, 'emit');
  //
  //     moduleName['handleSomeEvent']({data: {}});
  //
  //     expect(emitSpy).not.toHaveBeenCalled();
  //   });
  // });
});
```

---

### Backend Connector Tests (Multi-Backend Only)

For each backend connector (`WxCallBackendConnector.test.ts`, `BroadworksBackendConnector.test.ts`, `UcmBackendConnector.test.ts`), write tests that directly instantiate the connector and test its methods:

```typescript
// src/ModuleName/WxCallBackendConnector.test.ts

import {LOGGER} from '../Logger/types';
import {getTestUtilsWebex} from '../common/testUtil';
import {HTTP_METHODS, WebexRequestPayload} from '../common/types';
import {WxCallBackendConnector} from './WxCallBackendConnector';
import {METHODS} from './constants';
import {WEBEX_CALLING_CONNECTOR_FILE} from '../common/constants';
import log from '../Logger';
import * as utils from '../common/Utils';
import {
  MOCK_WXC_SUCCESS_RESPONSE,
  MOCK_WXC_ERROR_RESPONSE,
} from './moduleNameFixtures';

const webex = getTestUtilsWebex();

describe('WxCallBackendConnector tests', () => {
  let connector: WxCallBackendConnector;
  const infoSpy = jest.spyOn(log, 'info').mockImplementation();
  const logSpy = jest.spyOn(log, 'log').mockImplementation();
  const errorSpy = jest.spyOn(log, 'error').mockImplementation();
  let uploadLogsSpy: jest.SpyInstance;

  beforeAll(() => {
    connector = new WxCallBackendConnector(webex, {level: LOGGER.INFO});
    uploadLogsSpy = jest.spyOn(utils, 'uploadLogs').mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize successfully', async () => {
      // Mock any setup API calls
      const response = await connector.init();
      expect(response).toBeTruthy();
    });
  });

  describe('getData', () => {
    it('should fetch data successfully', async () => {
      webex.request.mockResolvedValue(MOCK_WXC_SUCCESS_RESPONSE);

      const response = await connector.getData(/* params */);

      expect(response.statusCode).toBe(200);
      expect(response.message).toBe('SUCCESS');
    });

    it('should handle errors', async () => {
      webex.request.mockRejectedValue(MOCK_WXC_ERROR_RESPONSE);

      const response = await connector.getData(/* params */);

      expect(response.statusCode).toBe(400);
      expect(response.message).toBe('FAILURE');
      expect(uploadLogsSpy).toHaveBeenCalledTimes(1);
    });
  });

  // Repeat for each method...
});
```

For the Voicemail facade test pattern (testing backend connector delegation), see the existing `src/Voicemail/Voicemail.test.ts`:

```typescript
// Test that the correct backend connector is instantiated based on callingBehavior:
describe('createModuleNameClient tests', () => {
  const testData = [
    {
      name: 'WXC backend',
      callingBehavior: 'NATIVE_WEBEX_TEAMS_CALLING',
      entitlement: 'bc-sp-standard',
      valid: true,
    },
    {
      name: 'UCM backend',
      callingBehavior: 'NATIVE_SIP_CALL_TO_UCM',
      entitlement: 'none',
      valid: true,
    },
    {
      name: 'invalid backend',
      callingBehavior: 'INVALID',
      entitlement: 'bc-sp-basic',
      valid: false,
    },
  ];

  it.each(testData)('$name', async (data) => {
    webex.internal.device.callingBehavior = data.callingBehavior;
    webex.internal.device.features.entitlement.models = [{_values: {key: data.entitlement}}];

    if (data.valid) {
      const client = createModuleNameClient(webex, {level: LOGGER.INFO});
      expect(client).toBeTruthy();
    } else {
      expect(() => createModuleNameClient(webex, {level: LOGGER.INFO})).toThrow(
        'Calling backend is not identified'
      );
    }
  });
});
```

---

## Fixture File Template

```typescript
// src/ModuleName/moduleNameFixtures.ts

// ---------- Success Response Mocks ----------
export const MOCK_SUCCESS_RESPONSE_BODY = {
  statusCode: 200,
  body: {
    statusCode: 200,
    items: [
      {
        id: 'item-001',
        name: 'Test Item',
        createdAt: '2024-01-15T10:30:00Z',
      },
    ],
  },
  headers: {
    trackingid: 'ROUTER_test-tracking-id',
  },
};

// ---------- Error Response Mocks ----------
export const MOCK_ERROR_RESPONSE_400 = {
  statusCode: 400,
  body: {
    message: 'Bad Request',
  },
};

export const MOCK_ERROR_RESPONSE_401 = {
  statusCode: 401,
  body: {
    message: 'Unauthorized',
  },
};

// ---------- Event Mocks (if module handles events) ----------
// export const MOCK_EVENT_PAYLOAD = {
//   id: 'event-001',
//   data: {
//     userSessions: {
//       userSessions: [
//         {
//           id: 'session-001',
//           sessionId: 'sess-abc-123',
//           disposition: 'Answered',
//           startTime: '2024-01-15T10:00:00Z',
//           endTime: '2024-01-15T10:05:00Z',
//         },
//       ],
//       statusCode: 200,
//     },
//   },
//   timestamp: 1705312200000,
//   trackingId: 'tracking-001',
// };

// ---------- Backend-Specific Mocks (if multi-backend) ----------
// export const MOCK_WXC_SUCCESS_RESPONSE = { ... };
// export const MOCK_BWRKS_SUCCESS_RESPONSE = { ... };
// export const MOCK_UCM_SUCCESS_RESPONSE = { ... };

// ---------- URL Mocks ----------
// export const MOCK_BASE_URL = 'https://janus-intb.ciscospark.com/janus/api/v1';
// export const MOCK_ENDPOINT_URL = `${MOCK_BASE_URL}/endpoint/path`;
```

---

## Running Tests

### Run module tests only

```bash
# From the calling package root:
cd packages/calling

# Run all tests for the module:
npx jest src/ModuleName/ModuleName.test.ts

# Run a specific test file:
npx jest src/ModuleName/WxCallBackendConnector.test.ts

# Run with coverage:
npx jest src/ModuleName/ --coverage

# Run in watch mode during development:
npx jest src/ModuleName/ --watch
```

### Run all calling package tests

```bash
yarn test:unit
```

---

## Test Generation -- Validation Checklist

- [ ] Test file is co-located with source file (same directory)
- [ ] Uses `getTestUtilsWebex()` from `../common/testUtil` for mock webex object
- [ ] Logger is spied on: `jest.spyOn(log, 'info')`, `jest.spyOn(log, 'log')`, `jest.spyOn(log, 'error')`
- [ ] `uploadLogs` is spied and mocked: `jest.spyOn(utils, 'uploadLogs').mockResolvedValue()`
- [ ] Initialization tests verify factory function and class instantiation
- [ ] Every public method has at least one success test and one error test
- [ ] Error tests cover at minimum: 400, 401, 404 status codes
- [ ] Error tests verify `log.error` was called with the correct logger context
- [ ] Error tests verify `uploadLogs` was called
- [ ] Event tests (if applicable) verify `emit` is called with correct event key and payload
- [ ] Event tests verify `emit` is NOT called for undefined or malformed payloads
- [ ] Backend connector tests (if multi-backend) test each connector independently
- [ ] Backend delegation tests verify correct connector is instantiated per `callingBehavior`
- [ ] Fixture file contains mock data for all response types and events
- [ ] All tests pass: `npx jest src/ModuleName/`

---

**Next Step:** [05-validation.md](./05-validation.md) -- Run the final quality checklist.
