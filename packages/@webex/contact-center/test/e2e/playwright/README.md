# Playwright E2E Testing Framework

E2E testing framework for CC Widgets with **dynamic** parallel test execution. Test sets are automatically configured based on `test-data.ts`.

## 📁 Structure

```
playwright/
├── suites/                                    # Test suite orchestration files
│   ├── digital-incoming-task-tests.spec.ts   # Digital incoming task orchestration
│   ├── task-list-multi-session-tests.spec.ts # Task list and multi-session orchestration
│   ├── station-login-user-state-tests.spec.ts # Station login and user state orchestration
│   ├── basic-advanced-task-controls-tests.spec.ts # Basic and advanced task controls orchestration
│   └── advanced-task-controls-tests.spec.ts  # Advanced task controls orchestration
├── tests/                                     # Individual test implementations
├── Utils/                                     # Utility functions
├── test-data.ts                              # **CENTRAL CONFIG** - Test data & suite mapping
├── test-manager.ts                           # Core test management
└── constants.ts                              # Shared constants
```

## 🎯 Dynamic Test Configuration

**All test configuration is now centralized in `test-data.ts`**. The framework automatically:

- ✅ Generates test projects from `USER_SETS`
- ✅ Sets worker count to match number of test sets
- ✅ Assigns unique debug ports (9221+)
- ✅ Positions browser windows automatically
- ✅ Maps test suites to user sets

| Set       | Focus                             | Port | Suite File                                   |
| --------- | --------------------------------- | ---- | -------------------------------------------- |
| **SET_1** | Digital incoming tasks & controls | 9221 | `digital-incoming-task-tests.spec.ts`        |
| **SET_2** | Task lists & multi-session        | 9222 | `task-list-multi-session-tests.spec.ts`      |
| **SET_3** | Authentication & user management  | 9223 | `station-login-user-state-tests.spec.ts`     |
| **SET_4** | Task controls & combinations      | 9224 | `basic-advanced-task-controls-tests.spec.ts` |
| **SET_5** | Advanced task operations          | 9225 | `advanced-task-controls-tests.spec.ts`       |

### Where to Add New Tests?

| Test Type                    | Use Set | Why                         |
| ---------------------------- | ------- | --------------------------- |
| Digital channels tasks       | SET_1   | Digital channels configured |
| Task list operations         | SET_2   | Task list focus             |
| Authentication/User states   | SET_3   | User management             |
| Basic/Advanced task controls | SET_4   | Task control operations     |
| Complex advanced scenarios   | SET_5   | Advanced operations         |

## 🧪 Adding New Tests

### 1. Create Test File (in `tests/` folder)

```typescript
// tests/my-feature-test.spec.ts
import {test, Page} from '@playwright/test';
import {TestManager} from '../test-manager';

export default function createMyTests() {
  return () => {
    let testManager: TestManager;
    let page: Page;

    test.beforeEach(async ({browser}) => {
      testManager = new TestManager(browser);
      const setup = await testManager.setupTest({
        needsAgent1: true,
        enableConsoleLogging: true,
      });
      page = setup.page;
    });

    test.afterEach(async () => {
      await testManager.cleanup();
    });

    test('should test my feature @myfeature', async () => {
      // Your test code
    });
  };
}
```

### 2. Add to Test Set

```typescript
// suites/advanced-task-controls-tests.spec.ts (choose appropriate set)
import createMyTests from '../tests/my-feature-test.spec';

test.describe('My Feature Tests', createMyTests());
```

## ➕ Adding New Test Set (Fully Automated)

### 1. Add to `test-data.ts`

```typescript
// test-data.ts - Just add your new set here!
export const USER_SETS = {
  // ... existing sets
  SET_6: {
    AGENTS: {
      AGENT1: {username: 'user27', extension: '1027', agentName: 'User27 Agent27'},
      AGENT2: {username: 'user28', extension: '1028', agentName: 'User28 Agent28'},
    },
    QUEUE_NAME: 'Queue e2e 6',
    CHAT_URL: `${env.PW_CHAT_URL}-e2e-6.html`,
    EMAIL_ENTRY_POINT: `${env.PW_SANDBOX}.e2e6@gmail.com`,
    ENTRY_POINT: env.PW_ENTRY_POINT6,
    TEST_SUITE: 'my-new-feature-tests.spec.ts', // 🎯 Key: maps to your test file
  },
};
```

### 2. Create Test Suite File

```typescript
// suites/my-new-feature-tests.spec.ts
import {test} from '@playwright/test';
import createMyTests from '../tests/my-feature-test.spec';

test.describe('My New Feature Tests', createMyTests());
```

**That's it!** The framework will automatically:

- ✅ Add `SET_6` as a new project
- ✅ Assign debug port `9226`
- ✅ Position browser at `6500,0`
- ✅ Set workers to `6`
- ✅ Map to `my-new-feature-tests.spec.ts`

### 3. ~~Manual Project Config~~ ❌ **NO LONGER NEEDED!**

~~The old manual approach of editing `playwright.config.ts` is eliminated.~~

## 🔧 Key Utilities

| Module              | Key Functions                                               |
| ------------------- | ----------------------------------------------------------- |
| `incomingTaskUtils` | `createChatTask()`, `acceptIncomingTask()`, `endChatTask()` |
| `taskControlUtils`  | `holdTask()`, `resumeTask()`, `endTask()`                   |
| `userStateUtils`    | `changeUserState()`, `verifyCurrentState()`                 |
| `stationLoginUtils` | `telephonyLogin()`, `stationLogout()`                       |

### Common Usage

```typescript
// Task management
await createChatTask(page, 'Customer message');
await acceptIncomingTask(page);
await endTask(page);

// State management
await changeUserState(page, USER_STATES.AVAILABLE);
await verifyCurrentState(page, USER_STATES.AVAILABLE);
```

## 📊 Environment Setup

Create `.env` file in project root:

```env
PW_CHAT_URL=https://your-chat-url
PW_SANDBOX=your-sandbox-name
PW_ENTRY_POINT1=entry-point-1
PW_ENTRY_POINT2=entry-point-2
# ... PW_ENTRY_POINT3, 4, 5
```

Test data is automatically handled by TestManager based on the running test set.

## 🚀 Running Tests

```bash
# Run all tests (workers automatically set to USER_SETS.length)
yarn test:e2e

# Run specific test suites
yarn test:e2e suites/digital-incoming-task-tests.spec.ts
yarn test:e2e suites/task-list-multi-session-tests.spec.ts
yarn test:e2e suites/station-login-user-state-tests.spec.ts
yarn test:e2e suites/basic-advanced-task-controls-tests.spec.ts
yarn test:e2e suites/advanced-task-controls-tests.spec.ts

# Run specific test sets (projects) - names match USER_SETS keys
yarn test:e2e --project=SET_1         # Digital incoming tasks
yarn test:e2e --project=SET_2         # Task list & multi-session
yarn test:e2e --project=SET_3         # Station login & user state
yarn test:e2e --project=SET_4         # Basic & advanced task controls
yarn test:e2e --project=SET_5         # Advanced task controls
# yarn test:e2e --project=SET_6       # Your new set (auto-available)

# Development & debugging
yarn test:e2e --ui                    # UI mode
yarn test:e2e --debug                 # Debug mode
yarn test:e2e --headed                # Run with browser visible
```

## 🏗️ Architecture Benefits

### Before (Manual)

- ❌ Manual project configuration in `playwright.config.ts`
- ❌ Hard-coded worker count
- ❌ Manual port/position assignment
- ❌ Separate mapping files
- ❌ Error-prone when adding new sets

### After (Dynamic)

- ✅ **Single source of truth**: `test-data.ts`
- ✅ **Auto-scaling workers**: `Object.keys(USER_SETS).length`
- ✅ **Auto port assignment**: `9221 + index`
- ✅ **Auto positioning**: `index * 1300, 0`
- ✅ **Zero manual config**: Just add to `USER_SETS`
- ✅ **Type-safe**: Full TypeScript support

## 🔍 Troubleshooting

**Common Issues:**

- Browser launch fails → Check Chrome and ports 9221+ (auto-assigned)
- Auth errors → Verify OAuth in `global.setup.ts`
- Widget timeouts → Increase `WIDGET_INIT_TIMEOUT`
- Test conflicts → Ports/positions are auto-managed per `USER_SETS`
- New set not appearing → Check `TEST_SUITE` property in `test-data.ts`

**Debug logging:**

```typescript
// Add to test setup
capturedLogs = [];
page.on('console', (msg) => capturedLogs.push(msg.text()));
```

## 🎛️ Configuration Reference

### Current Dynamic Setup

```typescript
// playwright.config.ts - Auto-generated projects
workers: Object.keys(USER_SETS).length, // Scales automatically

// Auto-generated per USER_SETS entry:
projects: [
  // ... OAuth setup
  ...Object.entries(USER_SETS).map(([setName, setData], index) => ({
    name: setName,                              // SET_1, SET_2, etc.
    testMatch: [`**/suites/${setData.TEST_SUITE}`], // From test-data.ts
    debugPort: 9221 + index,                    // 9221, 9222, 9223...
    windowPosition: `${index * 1300},0`,        // 0,0  1300,0  2600,0...
  }))
]
```

### test-data.ts Structure

```typescript
export const USER_SETS = {
  SET_X: {
    // Agent configuration
    AGENTS: { AGENT1: {...}, AGENT2: {...} },

    // Environment configuration
    QUEUE_NAME: 'Queue e2e X',
    CHAT_URL: '...',
    EMAIL_ENTRY_POINT: '...',
    ENTRY_POINT: '...',

    // 🎯 NEW: Test suite mapping
    TEST_SUITE: 'your-test-file.spec.ts', // Links to suite file
  }
};
```
