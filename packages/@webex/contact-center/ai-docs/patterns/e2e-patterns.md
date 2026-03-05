# E2E Test Patterns

## Purpose

Reusable patterns for Playwright E2E tests in `@webex/contact-center`. These patterns are adapted from the established ccWidgets Playwright framework for SDK-level testing.

---

## Pattern 1: Test Factory

**What**: Every test file exports a default function (factory) that returns a closure. Suites compose tests by calling these factories inside `test.describe`.

**Why**: Decouples test logic from suite registration. A single test file can be included in multiple suites without duplication.

```typescript
// playwright/tests/station-login-test.spec.ts
import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';

export default function createStationLoginTests() {
  let tm: TestManager;

  test.beforeAll(async ({browser}, testInfo) => {
    tm = new TestManager(testInfo.project.name);
    await tm.setup(browser, {needsAgent1: true});
  });

  test.afterAll(async () => {
    await tm.cleanup();
  });

  test('agent can login via desktop mode', async () => {
    // Test logic here
  });
}
```

```typescript
// playwright/suites/basic-tests.spec.ts
import {test} from '@playwright/test';
import createStationLoginTests from '../tests/station-login-test.spec';

test.describe('Basic Tests', () => {
  test.describe('Station Login', createStationLoginTests);
});
```

**Rules**:
- Test files MUST export a `default function` (not a named export, not inline tests)
- Suite files MUST use `test.describe('Name', createXTests)` — pass the factory, don't call it with `()`
- `testInfo.project.name` provides the SET name for env var prefix lookup

---

## Pattern 2: Console Log Verification

**What**: Capture browser console output and assert that expected SDK events were logged.

**Why**: SDK E2E tests don't have UI widgets to inspect. The sample app logs SDK events to console, making console output the primary verification channel.

```typescript
// Setup: capture console messages
test.beforeAll(async ({browser}, testInfo) => {
  tm = new TestManager(testInfo.project.name);
  await tm.setup(browser, {enableConsoleLogging: true});
});

// Verify: check for expected console output
test('state change emits success event', async () => {
  // Action
  await tm.agent1Page.click('#setAgentStatus');

  // Verify SDK event was logged
  await expect.poll(() =>
    tm.consoleMessages.some(msg =>
      msg.includes(CONSOLE_PATTERNS.SDK_STATE_CHANGE_SUCCESS)
    ),
    {timeout: AWAIT_TIMEOUT}
  ).toBeTruthy();
});
```

**Rules**:
- Always use `expect.poll()` — console messages arrive asynchronously
- Use `CONSOLE_PATTERNS` constants, never hardcode pattern strings
- Clear `tm.consoleMessages` between independent assertions if needed
- Use exact string matching (`includes` for substring, regex for structured data)

---

## Pattern 3: Multi-Agent Coordination

**What**: Tests that require two agents (e.g., consult transfer, conference) provision both via `SetupConfig`.

**Why**: Some SDK operations require interaction between two agents. TestManager handles parallel setup.

```typescript
export default function createConsultTransferTests() {
  let tm: TestManager;

  test.beforeAll(async ({browser}, testInfo) => {
    tm = new TestManager(testInfo.project.name);
    await tm.setup(browser, {
      needsAgent1: true,
      needsAgent2: true,
      needsCaller: true,
      enableConsoleLogging: true,
    });
  });

  test('agent1 can consult transfer to agent2', async () => {
    // Use tm.agent1Page for agent 1 actions
    // Use tm.agent2Page for agent 2 actions
    // Use tm.callerPage to initiate the incoming call
  });
}
```

**Rules**:
- Each agent gets its own `BrowserContext` (isolated cookies/storage)
- Env vars use SET-prefixed names: `${projectName}_AGENT1_ACCESS_TOKEN`, `${projectName}_AGENT2_ACCESS_TOKEN`
- Never share pages between agents — use the correct `tm.agentXPage`

---

## Pattern 4: Setup and Cleanup Lifecycle

**What**: TestManager setup in `beforeAll`, cleanup in `afterAll`, with stray task handling.

**Why**: Browser contexts are expensive. Create once per test file, not per test case.

```typescript
test.beforeAll(async ({browser}, testInfo) => {
  tm = new TestManager(testInfo.project.name);
  await tm.setup(browser, config);
});

test.afterAll(async () => {
  await tm.cleanup();
});
```

**Rules**:
- `beforeAll` / `afterAll`, not `beforeEach` / `afterEach` — context creation is too slow per test
- Always call `cleanup()` — leaked browser processes cause CI failures
- Use `handleStrayTasks()` before test execution if previous tests may have left orphaned tasks

---

## Pattern 5: Timeout Selection

**What**: Choose timeouts from the constant hierarchy based on what you're waiting for.

**Why**: Arbitrary timeout values cause flaky tests (too short) or slow suites (too long).

| Waiting For | Use This Timeout |
|-------------|-----------------|
| Dropdown animation | `DROPDOWN_SETTLE_TIMEOUT` (200ms) |
| UI element to appear | `UI_SETTLE_TIMEOUT` (2000ms) |
| Default operation | `DEFAULT_TIMEOUT` (5000ms) |
| Async SDK response | `AWAIT_TIMEOUT` (10000ms) |
| Wrapup completion | `WRAPUP_TIMEOUT` (15000ms) |
| Form population from API | `FORM_FIELD_TIMEOUT` (20000ms) |
| Long SDK operation | `OPERATION_TIMEOUT` (30000ms) |
| Extension registration | `EXTENSION_REGISTRATION_TIMEOUT` (40000ms) |
| Widget initialization | `WIDGET_INIT_TIMEOUT` (50000ms) |
| Incoming task acceptance | `ACCEPT_TASK_TIMEOUT` (60000ms) |

**Rules**:
- Never use `page.waitForTimeout(N)` with a magic number — always reference a named constant
- Pick the smallest timeout that fits the operation
- If you need a new timeout value, add it to `constants.ts` at the correct hierarchy level and document it in `ARCHITECTURE.md`

---

## Pattern 6: State Verification

**What**: Verify agent state transitions through console log patterns.

**Why**: Agent state changes are the most common assertion in contact center E2E tests.

```typescript
test('agent transitions to Available after login', async () => {
  // Trigger state change
  await tm.agent1Page.selectOption('#idleCodesDropdown', 'Available');
  await tm.agent1Page.click('#setAgentStatus');

  // Verify via console output
  await expect.poll(() =>
    tm.consoleMessages.some(msg => {
      const match = msg.match(CONSOLE_PATTERNS.ON_STATE_CHANGE_REGEX);
      return match && match[1] === 'Available';
    }),
    {timeout: AWAIT_TIMEOUT}
  ).toBeTruthy();
});
```

---

## Pattern 7: Network Resilience

**What**: Use retry wrappers for operations that depend on network calls.

**Why**: SDK operations make HTTP/WebSocket calls that may fail transiently in CI.

```typescript
// TestManager has built-in retry with exponential backoff
await tm.retryOperation(
  () => someNetworkOperation(),
  'network operation name',
  3  // max retries
);
```

**Rules**:
- Use `retryOperation()` for setup operations, not for test assertions
- Test assertions should use `expect.poll()` with appropriate timeouts
- If a test needs more than 3 retries to pass, investigate the root cause

---

## Pattern 8: RONA Handling

**What**: Handle RONA (Redirection on No Answer) state when an agent doesn't answer in time.

**Why**: RONA is a common state in contact center tests that must be handled explicitly.

```typescript
test('agent recovers from RONA to Available', async () => {
  // After RONA, agent must explicitly set state
  const ronaMsg = await expect.poll(() =>
    tm.consoleMessages.find(msg =>
      msg.includes('RONA')
    ),
    {timeout: ACCEPT_TASK_TIMEOUT}
  );

  // Select recovery option
  await tm.agent1Page.selectOption('#agentStateSelect', RONA_OPTIONS.AVAILABLE);
  await tm.agent1Page.click('#setAgentState');
});
```

---

## Anti-Patterns

### Do NOT use arbitrary waits
```typescript
// BAD
await page.waitForTimeout(5000);

// GOOD
await expect.poll(() => condition, {timeout: AWAIT_TIMEOUT}).toBeTruthy();
```

### Do NOT hardcode console patterns
```typescript
// BAD
const found = messages.some(m => m.includes('WXCC_SDK_AGENT_STATE_CHANGE_SUCCESS'));

// GOOD
const found = messages.some(m => m.includes(CONSOLE_PATTERNS.SDK_STATE_CHANGE_SUCCESS));
```

### Do NOT share mutable state between test files
```typescript
// BAD — global variable shared across tests
let sharedAgent: Page;

// GOOD — TestManager scoped to factory function
export default function createTests() {
  let tm: TestManager;
  // tm is local to this factory
}
```

### Do NOT use anonymous callbacks for event listeners
```typescript
// BAD — can't unsubscribe
page.on('console', (msg) => messages.push(msg.text()));

// GOOD — named function can be unsubscribed
const handleConsole = (msg: ConsoleMessage) => messages.push(msg.text());
page.on('console', handleConsole);
// Later: page.off('console', handleConsole);
```

### Do NOT skip documentation updates
```typescript
// BAD — add test file but don't update ARCHITECTURE.md
// "I'll update docs later" → docs never get updated

// GOOD — every PR includes both code AND doc updates
// Follow 03-framework-and-doc-updates.md checklist
```
