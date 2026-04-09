# Playwright E2E Testing Framework

E2E testing framework for CC Sample App with dynamic parallel test execution. All configuration is centralized in `test-data.ts`.

## 📁 Structure

```
cc_playwright/
├── suites/          # Test suite orchestration (maps to test sets)
├── tests/           # Individual test implementations
├── Utils/           # Utility functions
├── test-data.ts     # Central config - test data & suite mapping
├── test-manager.ts  # Core test management
└── constants.ts     # Shared constants
```

## 🎯 Test Sets

| Set       | Focus                    | Port | Suite File                                   |
| --------- | ------------------------ | ---- | -------------------------------------------- |
| **SET_1** | Digital tasks            | 9221 | `digital-incoming-task-tests.spec.ts`        |
| **SET_2** | Task lists & multi-login | 9222 | `task-list-multi-session-tests.spec.ts`      |
| **SET_3** | Auth & user states       | 9223 | `station-login-user-state-tests.spec.ts`     |
| **SET_4** | Basic/advanced controls  | 9224 | `basic-advanced-task-controls-tests.spec.ts` |
| **SET_5** | Advanced operations      | 9225 | `advanced-task-controls-tests.spec.ts`       |
| **SET_6** | Dial number flows        | 9226 | `dial-number-tests.spec.ts`                  |
| **SET_7** | Multiparty (team 25-28)  | 9227 | `multiparty-conference-set-7-tests.spec.ts`  |
| **SET_8** | Multiparty (team 29-32)  | 9228 | `multiparty-conference-set-8-tests.spec.ts`  |
| **SET_9** | Multiparty (team 33-36)  | 9229 | `multiparty-conference-set-9-tests.spec.ts`  |

## 🧪 Adding Tests

### 1. Create Test in `tests/`

```typescript
import {test} from '@playwright/test';
import {TestManager} from '../test-manager';

export default function createMyTests() {
  return () => {
    let testManager: TestManager;

    test.beforeEach(async ({browser}) => {
      testManager = new TestManager(browser);
      await testManager.setupTest({needsAgent1: true});
    });

    test.afterEach(() => testManager.cleanup());

    test('my test', async () => {
      // Test code
    });
  };
}
```

### 2. Add to Suite in `suites/`

```typescript
import createMyTests from '../tests/my-feature-test.spec';
test.describe('My Tests', createMyTests());
```

## ➕ Adding Test Set

### 1. Add to `test-data.ts`

```typescript
export const USER_SETS = {
  SET_10: {
    AGENTS: {AGENT1: {...}, AGENT2: {...}},
    TEST_SUITE: 'my-tests.spec.ts',
    // ... other config
  },
};
```

### 2. Create suite file `suites/my-tests.spec.ts`

Framework auto-generates: project, port (9230), browser position, workers.

## 🔧 Key Utilities

```typescript
// Task management
await createChatTask(page, 'message');
await acceptIncomingTask(page);
await endTask(page);

// State management
await changeUserState(page, USER_STATES.AVAILABLE);
await verifyCurrentState(page, USER_STATES.AVAILABLE);
```

## 📊 Environment Setup

Create `.env`:

```env
PW_CHAT_URL=https://...
PW_SANDBOX=sandbox-name
PW_ENTRY_POINT1=...
# ... PW_ENTRY_POINT2-9
```

## 🚀 Running Tests

### Prerequisites

Build sample bundles first:

```bash
yarn samples:build  # Generates contact-center.min.js
```

### Commands

```bash
# All tests
yarn test:e2e

# Specific set
yarn test:e2e --project=SET_3

# Debug
yarn test:e2e --debug
yarn test:e2e --headed
```

## 🔍 Troubleshooting

- **Browser fails**: Check ports 9221-9229 availability
- **Auth errors**: Verify `.env` credentials and run OAuth setup
- **Missing bundle**: Run `yarn samples:build`
