# Testing Patterns

> Quick reference for LLMs working with tests in the `@webex/calling` package.

---

## Rules

- **MUST** use Jest as the test runner with `jsdom` environment
- **MUST** co-locate test files next to source files as `*.test.ts`
- **MUST** use `jest.fn()` and `jest.spyOn()` for mocking (not Sinon — though Sinon is a dev dependency, Jest mocks are the primary pattern)
- **MUST** use `getTestUtilsWebex()` to create mock Webex SDK instances
- **MUST** use fixtures from `*Fixtures.ts` and `testUtil.ts` for test data
- **MUST** mock `@webex/internal-media-core` at the top of call-related test files
- **MUST** maintain ≥85% line/function/statement coverage and ≥80% branch coverage
- **MUST** clean up mocks in `beforeEach`/`afterEach` with `jest.clearAllMocks()`
- **NEVER** test implementation details — test observable behavior and event emissions
- **NEVER** leave unmocked external dependencies in unit tests

---

## Test File Structure

Tests are co-located next to the source files they test.

```
packages/calling/src/
├── CallingClient/
│   ├── CallingClient.ts
│   ├── CallingClient.test.ts          # Tests for CallingClient
│   ├── calling/
│   │   ├── call.ts
│   │   ├── call.test.ts              # Tests for Call
│   │   ├── callManager.ts
│   │   ├── callManager.test.ts       # Tests for CallManager
│   │   └── CallerId/
│   │       └── index.test.ts
│   ├── line/
│   │   └── line.test.ts
│   └── registration/
│       ├── register.test.ts
│       └── webWorker.test.ts
├── CallHistory/
│   └── CallHistory.test.ts
├── CallSettings/
│   ├── CallSettings.test.ts
│   ├── WxCallBackendConnector.test.ts
│   └── UcmBackendConnector.test.ts
├── Contacts/
│   └── ContactsClient.test.ts
├── Voicemail/
│   ├── Voicemail.test.ts
│   ├── WxCallBackendConnector.test.ts
│   ├── UcmBackendConnector.test.ts
│   └── BroadworksBackendConnector.test.ts
├── common/
│   └── Utils.test.ts
├── SDKConnector/
│   ├── index.test.ts
│   └── utils.test.ts
├── Metrics/
│   └── index.test.ts
└── Logger/
    └── index.test.ts
```

---

## Mock Webex SDK Pattern

The `getTestUtilsWebex()` function creates a fresh mock Webex object per test file.

```typescript
import {getTestUtilsWebex} from '../../common/testUtil';

const webex = getTestUtilsWebex();

// The mock provides:
// webex.request          → jest.fn()
// webex.internal.mercury.on/off → jest.fn()
// webex.internal.device  → mock device info
// webex.internal.services._serviceUrls → mock service URLs
// webex.internal.services.getMobiusClusters → jest.fn()
// webex.logger           → mock logger with all levels
// webex.people.list      → jest.fn()
```

### Configuring Mock Responses

```typescript
// Single response
webex.request.mockReturnValueOnce({
  statusCode: 200,
  body: {
    device: {
      deviceId: '8a67806f-fc4d-446b-a131-31e71ea5b010',
      correlationId: '8a67806f-fc4d-446b-a131-31e71ea5b011',
    },
    callId: '8a67806f-fc4d-446b-a131-31e71ea5b020',
    callData: {callState: MobiusCallState.PROCEEDING},
  },
});

// Persistent response
webex.request.mockReturnValue({statusCode: 200, body: {}});

// Rejection
webex.request.mockRejectedValueOnce({statusCode: 503, body: {}});
```

---

## Test Setup Pattern

### Basic Test File Structure

```typescript
import {getTestUtilsWebex} from '../../common/testUtil';
import {ServiceIndicator} from '../../common/types';

const webex = getTestUtilsWebex();
const defaultServiceIndicator = ServiceIndicator.CALLING;

describe('ModuleName Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    webex.request = jest.fn();
  });

  it('should do something', () => {
    // test
  });
});
```

### Call Test Setup

```typescript
import * as InternalMediaCoreModule from '@webex/internal-media-core';
import {getTestUtilsWebex, mediaConnection} from '../../common/testUtil';
import {getCallManager} from './callManager';

jest.mock('@webex/internal-media-core');

const webex = getTestUtilsWebex();
const mockInternalMediaCoreModule = InternalMediaCoreModule as jest.Mocked<typeof InternalMediaCoreModule>;

describe('Call Tests', () => {
  const deviceId = '55dfb53f-bed2-36da-8e85-cee7f02aa68e';
  const dest = {type: CallType.URI, address: 'tel:5003'};
  let callManager: ICallManager;

  beforeEach(() => {
    callManager = getCallManager(webex, defaultServiceIndicator);
  });

  afterEach(() => {
    webex.request = jest.fn();
  });

  it('create call object', () => {
    webex.request.mockReturnValueOnce({
      statusCode: 200,
      body: { /* mock response */ },
    });
    // ...
  });
});
```

---

## Mocking Patterns

### Mocking Module-Level Dependencies

```typescript
jest.mock('@webex/internal-media-core');
```

### Spying on Utility Functions

```typescript
import * as Utils from '../../common/Utils';

const uploadLogsSpy = jest.spyOn(Utils, 'uploadLogs').mockResolvedValue(undefined);
const parseStatsSpy = jest.spyOn(Utils, 'parseMediaQualityStatistics').mockReturnValue(mockStats);
```

### Mock Media Connection

```typescript
import {mediaConnection} from '../../common/testUtil';

// mediaConnection is a pre-built mock from MediaSDKMock.RoapMediaConnection
// It provides mock implementations for all media connection methods
```

### Mock Track

```typescript
const mockTrack = {
  enabled: false,
} as MediaStreamTrack;
```

---

## Fixture Patterns

### Test Fixture Files

Each module can have a dedicated fixtures file for reusable test data.

```
src/CallingClient/callingClientFixtures.ts
src/CallingClient/callRecordFixtures.ts
src/CallingClient/registration/registerFixtures.ts
src/CallHistory/callHistoryFixtures.ts
src/CallSettings/testFixtures.ts
src/Contacts/contactFixtures.ts
```

### Common Test Utilities

```typescript
// src/common/testUtil.ts

// Mock Webex SDK
export function getTestUtilsWebex() { /* returns mock webex */ }

// Pre-built mock media connection
export const mediaConnection = new MediaSDKMock.RoapMediaConnection(/* ... */);

// Promise flushing for async tests
export const flushPromises = async (count: number): Promise<void> => {
  await Promise.all([...Array(count)].map(() => Promise.resolve()));
};

// Mock CallingClient
export const mockCallingClient = {
  emit: jest.fn(),
  register: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

// Mock request template
export const getMockRequestTemplate = () => ({
  headers: {
    'cisco-device-url': 'https://wdm-intb.ciscospark.com/...',
    'spark-user-agent': 'webex-calling/beta',
  },
  service: 'mobius',
});

// Mock Mobius discovery response
export const getMobiusDiscoveryResponse = () => ({
  primary: {region: 'US-EAST', uris: ['https://mobius-dfw.webex.com/api/v1']},
  backup: {region: 'US-WEST', uris: ['https://mobius-sjc.webex.com/api/v1']},
});

// Mock device info
export const getMockDeviceInfo = () => ({
  device: {
    deviceId: 'beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
    uri: 'https://mobius.../devices/beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
    status: 'active',
    lastSeen: '2022-04-05T05:08:46Z',
    addresses: ['sip:user@domain.com'],
    clientDeviceUri: 'https://clientDeviceUrl',
  },
});
```

---

## Event Testing Pattern

### Testing Event Emissions

```typescript
it('should emit ALERTING event on incoming call', () => {
  const alertingSpy = jest.fn();

  call.on(CALL_EVENT_KEYS.ALERTING, alertingSpy);

  // Trigger the action that causes the event
  callManager.dequeueWsEvents(incomingCallEvent);

  expect(alertingSpy).toHaveBeenCalledWith(expect.any(String));
});
```

### Testing Error Events

```typescript
it('should emit CALL_ERROR on failure', async () => {
  const errorSpy = jest.fn();
  call.on(CALL_EVENT_KEYS.CALL_ERROR, errorSpy);

  webex.request.mockRejectedValueOnce({statusCode: 503});

  await call.dial(mockAudioStream);

  expect(errorSpy).toHaveBeenCalledWith(
    expect.objectContaining({
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
    })
  );
});
```

---

## Async Testing Pattern

### Using flushPromises

```typescript
it('should handle async operations', async () => {
  webex.request.mockResolvedValueOnce({statusCode: 200, body: {}});

  call.dial(mockAudioStream);

  await flushPromises(2);

  expect(webex.request).toHaveBeenCalled();
});
```

### Using waitForMsecs

```typescript
import {waitForMsecs} from '../../common/Utils';

it('should wait for timer', async () => {
  jest.useFakeTimers();

  call.startKeepalive();

  jest.advanceTimersByTime(30000);
  await flushPromises(1);

  expect(webex.request).toHaveBeenCalled();

  jest.useRealTimers();
});
```

---

## Custom Matchers

### toBeCalledOnceWith

Defined in `jest.expectExtensions.js` for verifying single-call assertions.

```typescript
expect(mockFn).toBeCalledOnceWith(expectedArg1, expectedArg2);
```

---

## Jest Configuration

### jest.config.js

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  // Uses @webex/jest-config-legacy as base
  // Coverage thresholds:
  //   Global: 85% lines/functions/statements, 80% branches
  //   Lower thresholds for some modules (Voicemail, SDKConnector, etc.)
};
```

### jest-preload.js

Pre-test setup that mocks browser APIs.

```javascript
// Mocks: console, Worker, URL.createObjectURL, URL.revokeObjectURL, Blob, crypto.randomUUID
```

---

## Test Commands

```bash
# Run all unit tests
yarn test:unit

# Run style/lint tests
yarn test:style

# Run specific file
yarn jest src/CallingClient/calling/call.test.ts

# Run with coverage
yarn test:unit --coverage

# Fix lint issues
yarn fix:lint
yarn fix:prettier
```

---

## Coverage Expectations

| Scope | Lines | Functions | Statements | Branches |
|-------|-------|-----------|------------|----------|
| Global | 85% | 85% | 85% | 80% |
| Some modules (Voicemail, SDKConnector, CallHistory) have lower thresholds configured per module |

---

## Related

- [TypeScript Patterns](./typescript-patterns.md)
- [Event Patterns](./event-patterns.md)
- [Error Handling Patterns](./error-handling-patterns.md)
- [Architecture Patterns](./architecture-patterns.md)
