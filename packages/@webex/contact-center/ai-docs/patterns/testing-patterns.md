# Testing Patterns - Contact Center SDK

> **Purpose**: Jest testing patterns and conventions for the Contact Center SDK.

---

## Test Structure

### File Location

```
packages/@webex/contact-center/
├── src/
│   ├── cc.ts
│   └── services/
│       ├── agent/
│       │   └── index.ts
│       ├── task/
│       │   └── TaskManager.ts
│       └── core/
│           └── Utils.ts
├── test/
│   └── unit/
│       └── spec/
│           ├── cc.ts                    # Tests for src/cc.ts
│           └── services/
│               ├── agent/
│               │   └── index.ts          # Tests for src/services/agent/index.ts
│               ├── task/
│               │   └── TaskManager.ts   # Tests for src/services/task/TaskManager.ts
│               └── core/
│                   └── Utils.ts         # Tests for src/services/core/Utils.ts
```

### Test File Rule

**Every new source file MUST have a corresponding test file.** The test file location mirrors the source file path:

- Source: `src/services/{service}/{FileName}.ts`
- Test: `test/unit/spec/services/{service}/{FileName}.ts`

When creating a new source file, always create the corresponding test file in the matching directory structure under `test/unit/spec/`.

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
    }) as unknown as WebexSDK; // MockWebex requires double-cast — do NOT use this pattern elsewhere
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
  getAllTasks: jest.fn(),
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
};

jest.spyOn(MetricsManager, 'getInstance').mockReturnValue(mockMetricsManager);
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

  // Assert — always use exact matches, avoid expect.objectContaining
  expect(result).toEqual({
    agentId: '123',
    status: 'LoggedIn',
    trackingId: 'track-123',
  });
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

Event listeners and their callbacks are tested by spying on the registration, extracting the callback via `mock.calls`, and invoking it directly.

### Testing Event Listener Registration

```typescript
it('should register event listeners on init', () => {
  // Verify the listener was registered
  expect(mockTaskManager.on).toHaveBeenCalledWith(
    'task:incoming',
    expect.any(Function)
  );
});
```

### Testing Event Callbacks via mock.calls

```typescript
it('should handle websocket message and emit event', () => {
  // Step 1: Find the registered callback via mock.calls
  const onCalls = mockServicesInstance.webSocketManager.on.mock.calls;
  const messageCall = onCalls.find(([event]) => event === 'message');
  const wsHandler = messageCall[1];

  // Step 2: Spy on the emit
  const emitSpy = jest.spyOn(webex.cc, 'emit');

  // Step 3: Invoke the callback directly with test data
  wsHandler(JSON.stringify({
    type: 'AgentStateChange',
    data: { type: 'AgentStateChangeSuccess', agentId: 'agent-123', state: 'Available' },
  }));

  // Step 4: Assert exact emit arguments
  expect(emitSpy).toHaveBeenCalledWith('agent:stateChange', {
    type: 'AgentStateChangeSuccess',
    agentId: 'agent-123',
    state: 'Available',
  });
});
```

### Testing TaskManager Event Callbacks

```typescript
it('should trigger task:incoming when TaskManager emits', () => {
  // Extract the registered callback
  const taskIncomingCall = mockTaskManager.on.mock.calls
    .find(([event]) => event === 'task:incoming');
  const taskHandler = taskIncomingCall[1];

  const triggerSpy = jest.spyOn(webex.cc, 'trigger');

  // Invoke the callback
  const mockTask = { interactionId: 'int-123', taskId: 'task-456' };
  taskHandler(mockTask);

  // Assert
  expect(triggerSpy).toHaveBeenCalledWith('task:incoming', mockTask);
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

**Prefer exact matches over `expect.objectContaining` in new tests.** Exact matches catch unexpected field changes and keep tests rigorous. Existing tests may use `expect.objectContaining` for complex objects — this is acceptable but not preferred for new code.

### Structure Assertions

```typescript
// Exact match on result — preferred
expect(result).toEqual({
  agentId: 'agent-123',
  status: 'LoggedIn',
  trackingId: 'track-456',
});

// Array exact match
expect(result.teams).toEqual([
  { teamId: 'team-1', teamName: 'Support' },
  { teamId: 'team-2', teamName: 'Sales' },
]);
```

### Call Assertions

```typescript
// Check mock was called with exact args
expect(mockServicesInstance.agent.stationLogin).toHaveBeenCalledWith({
  data: {
    teamId: 'team-1',
    deviceType: 'BROWSER',
  },
});

// Check call count
expect(mockMetricsManager.trackEvent).toHaveBeenCalledTimes(1);

// Check specific call with exact values
expect(mockMetricsManager.timeEvent).toHaveBeenCalledWith([
  'STATION_LOGIN_SUCCESS',
  'STATION_LOGIN_FAILED',
]);
```

---

## Test Coverage Goals

Target: **85% coverage**

```bash
# Run tests (coverage is collected automatically via jest.config.js)
yarn workspace @webex/contact-center test:unit

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
