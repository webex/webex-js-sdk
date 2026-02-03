# Testing Patterns - Contact Center SDK

> **Purpose**: Jest testing patterns and conventions for the Contact Center SDK.

---

## Test Structure

### File Location

```
packages/@webex/contact-center/
├── test/
│   └── unit/
│       └── spec/
│           ├── cc.ts                    # Main plugin tests
│           └── services/
│               ├── agent/
│               ├── task/
│               └── core/
```

### Test File Template

```typescript
import 'jsdom-global/register';
import MockWebex from '@webex/test-helper-mock-webex';
import ContactCenter from '../../../src/cc';
import {WebexSDK} from '../../../src/types';
import config from '../../../src/config';

// Mock dependencies
jest.mock('../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    trace: jest.fn(),
    initialize: jest.fn(),
  },
}));

describe('FeatureName', () => {
  let webex: WebexSDK;

  beforeEach(() => {
    webex = MockWebex({
      children: {
        cc: ContactCenter,
      },
      logger: {
        log: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
      },
      credentials: {
        getOrgId: jest.fn(() => 'mockOrgId'),
      },
      config: config,
    }) as unknown as WebexSDK;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('methodName', () => {
    it('should do something specific', async () => {
      // Arrange
      const input = { /* test data */ };

      // Act
      const result = await webex.cc.methodName(input);

      // Assert
      expect(result).toBeDefined();
    });
  });
});
```

---

## MockWebex Setup

### Basic Setup

```typescript
import MockWebex from '@webex/test-helper-mock-webex';
import ContactCenter from '../../../src/cc';
import Mercury from '@webex/internal-plugin-mercury';

beforeEach(() => {
  webex = MockWebex({
    children: {
      cc: ContactCenter,
      mercury: Mercury,
    },
    logger: {
      log: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    },
    credentials: {
      getOrgId: jest.fn(() => 'mockOrgId'),
    },
    config: config,
    once: jest.fn((event, callback) => callback()),
  }) as unknown as WebexSDK;
});
```

### With Internal Plugins

```typescript
webex = MockWebex({
  children: {
    cc: ContactCenter,
    mercury: Mercury,
  },
  internal: {
    mercury: {
      connected: false,
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn().mockResolvedValue(undefined),
      on: jest.fn(),
      off: jest.fn(),
    },
    device: {
      unregister: jest.fn().mockResolvedValue(undefined),
    },
  },
}) as unknown as WebexSDK;
```

---

## Mocking Singletons

### Services Singleton

```typescript
import Services from '../../../src/services';

const mockServicesInstance = {
  agent: {
    stationLogin: jest.fn(),
    logout: jest.fn(),
    reload: jest.fn(),
    stateChange: jest.fn(),
    buddyAgents: jest.fn(),
  },
  config: {
    getAgentConfig: jest.fn(),
    getOutdialAniEntries: jest.fn(),
  },
  webSocketManager: {
    initWebSocket: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    close: jest.fn(),
    isSocketClosed: false,
  },
  connectionService: {
    on: jest.fn(),
    off: jest.fn(),
  },
  contact: {
    accept: jest.fn(),
    hold: jest.fn(),
    transfer: jest.fn(),
  },
  dialer: {
    startOutdial: jest.fn(),
  },
};

jest.spyOn(Services, 'getInstance').mockReturnValue(mockServicesInstance as any);
```

### TaskManager Singleton

```typescript
import TaskManager from '../../../src/services/task/TaskManager';

const mockTaskManager = {
  taskCollection: {},
  setWrapupData: jest.fn(),
  setAgentId: jest.fn(),
  registerIncomingCallEvent: jest.fn(),
  registerTaskListeners: jest.fn(),
  getTask: jest.fn(),
  getActiveTasks: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  emit: jest.fn(),
  unregisterIncomingCallEvent: jest.fn(),
};

jest.spyOn(TaskManager, 'getTaskManager').mockReturnValue(mockTaskManager);
```

### MetricsManager Singleton

```typescript
import MetricsManager from '../../../src/metrics/MetricsManager';

const mockMetricsManager = {
  trackEvent: jest.fn(),
  timeEvent: jest.fn(),
  trackBehavioralEvent: jest.fn(),
  trackOperationalEvent: jest.fn(),
};

jest.spyOn(MetricsManager, 'getInstance').mockReturnValue(mockMetricsManager);
```

---

## Mocking LoggerProxy

```typescript
jest.mock('../../../src/logger-proxy', () => ({
  __esModule: true,
  default: {
    log: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    trace: jest.fn(),
    initialize: jest.fn(),
  },
}));

// In tests, verify logging
import LoggerProxy from '../../../src/logger-proxy';

it('should log on success', async () => {
  await webex.cc.someMethod();
  
  expect(LoggerProxy.log).toHaveBeenCalledWith(
    expect.stringContaining('success'),
    expect.objectContaining({
      module: expect.any(String),
      method: expect.any(String),
    })
  );
});
```

---

## Async Testing

### Promise Resolution

```typescript
it('should resolve with data on success', async () => {
  // Arrange
  mockServicesInstance.agent.stationLogin.mockResolvedValue({
    data: { agentId: '123', status: 'LoggedIn' },
    trackingId: 'track-123',
  });

  // Act
  const result = await webex.cc.stationLogin({
    teamId: 'team-1',
    loginOption: 'BROWSER',
  });

  // Assert
  expect(result).toEqual(expect.objectContaining({
    agentId: '123',
  }));
});
```

### Promise Rejection

```typescript
it('should throw error on failure', async () => {
  // Arrange
  const mockError = new Error('Login failed');
  mockError.details = {
    type: 'LoginFailed',
    data: { reason: 'INVALID_CREDENTIALS' },
  };
  mockServicesInstance.agent.stationLogin.mockRejectedValue(mockError);

  // Act & Assert
  await expect(
    webex.cc.stationLogin({ teamId: 'team-1', loginOption: 'BROWSER' })
  ).rejects.toThrow('INVALID_CREDENTIALS');
});
```

---

## Event Testing

### Event Emission

```typescript
it('should emit event on state change', async () => {
  // Arrange
  const eventSpy = jest.fn();
  webex.cc.on('agent:stateChange', eventSpy);

  // Act - simulate websocket message
  const wsHandler = mockServicesInstance.webSocketManager.on.mock.calls
    .find(([event]) => event === 'message')[1];
  
  wsHandler(JSON.stringify({
    type: 'AgentStateChange',
    data: { type: 'AgentStateChangeSuccess', state: 'Available' },
  }));

  // Assert
  expect(eventSpy).toHaveBeenCalledWith(
    expect.objectContaining({ state: 'Available' })
  );
});
```

### Event Listener Setup

```typescript
it('should register event listeners on init', () => {
  webex.cc = new ContactCenter({ parent: webex });

  expect(mockTaskManager.on).toHaveBeenCalledWith(
    'task:incoming',
    expect.any(Function)
  );
});
```

---

## Mocking External APIs

### Worker Mock

```typescript
// __mocks__/workerMock.ts
class Worker {
  onmessage: ((msg: any) => void) | null = null;
  
  postMessage(msg: any) {
    if (this.onmessage) {
      this.onmessage({ data: msg });
    }
  }
  
  terminate() {}
}

global.Worker = Worker as any;
```

### URL Mock

```typescript
global.URL.createObjectURL = jest.fn(() => 'blob:http://localhost:3000/12345');
```

### UUID Mock

```typescript
jest.mock('uuid', () => ({
  v4: () => 'mock-tracking-uuid',
}));
```

---

## Test Utilities

### Spy on Utility Functions

```typescript
import * as Utils from '../../../src/services/core/Utils';

let getErrorDetailsSpy: jest.SpyInstance;

beforeEach(() => {
  getErrorDetailsSpy = jest.spyOn(Utils, 'getErrorDetails');
});

it('should call getErrorDetails on failure', async () => {
  mockServicesInstance.agent.stationLogin.mockRejectedValue(mockError);

  await expect(webex.cc.stationLogin(data)).rejects.toThrow();

  expect(getErrorDetailsSpy).toHaveBeenCalledWith(
    expect.any(Error),
    'stationLogin',
    'ContactCenter'
  );
});
```

---

## Common Assertions

### Structure Assertions

```typescript
// Check object structure
expect(result).toEqual(expect.objectContaining({
  agentId: expect.any(String),
  status: 'LoggedIn',
}));

// Check array contains
expect(result.teams).toContainEqual(
  expect.objectContaining({ teamId: 'team-1' })
);
```

### Call Assertions

```typescript
// Check mock was called with specific args
expect(mockServicesInstance.agent.stationLogin).toHaveBeenCalledWith({
  data: expect.objectContaining({
    teamId: 'team-1',
    deviceType: 'BROWSER',
  }),
});

// Check call count
expect(mockMetricsManager.trackEvent).toHaveBeenCalledTimes(1);

// Check specific call
expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
  expect.stringContaining('SUCCESS'),
  expect.stringContaining('FAILED'),
]);
```

---

## Test Coverage Goals

Target: **85% coverage**

```bash
# Run tests with coverage
yarn workspace @webex/contact-center test --coverage

# Coverage thresholds (jest.config.js)
coverageThreshold: {
  global: {
    branches: 85,
    functions: 85,
    lines: 85,
    statements: 85,
  },
}
```
