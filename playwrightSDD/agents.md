# Agent Development Guide - Contact Center SDK E2E Testing

This document provides guidance for AI agents and developers working on the Contact Center SDK E2E Testing Framework. It outlines the project structure, technology stack, development conventions, and best practices to ensure consistent, high-quality implementations across the codebase.

---

## 1. Project Structure

### Playwright Directory Structure

```
playwright/
├── constants.ts                    # Shared constants and type definitions
├── global.setup.ts                 # OAuth and environment setup
├── test-data.ts                    # Central test configuration and user sets
├── test-manager.ts                 # Core test management and setup
├── suites/                         # Test suite orchestration files
│   ├── digital-incoming-task-tests.spec.ts
│   ├── task-list-multi-session-tests.spec.ts
│   ├── station-login-user-state-tests.spec.ts
│   ├── basic-advanced-task-controls-tests.spec.ts
│   └── advanced-task-controls-tests.spec.ts
├── tests/                          # Individual test implementations
│   ├── station-login-test.spec.ts
│   ├── user-state-test.spec.ts
│   ├── incoming-telephony-task-test.spec.ts
│   ├── digital-incoming-task-and-task-controls.spec.ts
│   ├── basic-task-controls-test.spec.ts
│   ├── advanced-task-controls-test.spec.ts
│   ├── advance-task-control-combinations-test.spec.ts
│   ├── incoming-task-and-controls-multi-session.spec.ts
│   └── tasklist-test.spec.ts
├── Utils/                          # Utility functions
│   ├── initUtils.ts, stationLoginUtils.ts, userStateUtils.ts
│   ├── taskControlUtils.ts, advancedTaskControlUtils.ts
│   ├── incomingTaskUtils.ts, wrapupUtils.ts, helperUtils.ts
└── wav/                            # Audio files for testing
```

### Related SDK Structure (webex-js-sdk)

```
webex-js-sdk/
├── packages/
│   └── @webex/
│       └── contact-center/                      # Contact Center SDK (formerly plugin-cc)
│           ├── src/
│           │   ├── cc.ts                        # Main ContactCenter class
│           │   ├── constants.ts                 # SDK constants
│           │   ├── config.ts                    # Configuration
│           │   ├── index.ts                     # Entry point
│           │   ├── logger-proxy.ts              # Logger proxy
│           │   ├── metrics/                     # Metrics and analytics
│           │   │   ├── MetricsManager.ts
│           │   │   ├── behavioral-events.ts
│           │   │   └── constants.ts
│           │   ├── services/                    # Service modules
│           │   │   ├── agent/                   # Agent service
│           │   │   ├── task/                    # Task management
│           │   │   ├── config/                  # Configuration service
│           │   │   ├── core/                    # Core services
│           │   │   ├── WebCallingService.ts     # WebRTC calling service
│           │   │   └── ...
│           │   ├── types.ts                     # Type definitions
│           │   ├── utils/                       # Utilities
│           │   │   └── PageCache.ts
│           │   └── webex-config.ts              # Webex config
│           └── test/                            # Unit tests
└── docs/samples/contact-center/                 # Kitchen Sink sample app
```

---

## 2. Technology Stack

Agents working on this testing framework should possess expertise in the following technologies and frameworks.

#### Core Framework & Languages
| Technology | Version | Purpose |
|------------|---------|--------|
| **TypeScript** | 4.9+ | Primary language for test implementation |
| **Playwright** | Latest | E2E testing framework for browser automation |
| **Node.js** | 20.x+ | Runtime environment |
| **pnpm/yarn** | Latest | Package management |

#### SDK Under Test
| Technology | Version | Purpose |
|------------|---------|--------|
| **@webex/contact-center** | Latest | Contact Center SDK plugin |
| **Webex JS SDK** | Latest | Core Webex SDK |
| **WebRTC** | Native | Browser-based calling |
| **WebSocket** | Native | Real-time communication |

#### Testing Infrastructure
| Technology | Version | Purpose |
|------------|---------|--------|
| **Playwright Test** | Latest | Test runner and assertions |
| **dotenv** | Latest | Environment variable management |
| **nodemailer** | Latest | Email task creation |

#### UI Components Under Test
| Component | Purpose |
|-----------|--------|
| **Station Login Widget** | Agent authentication and station management |
| **User State Widget** | Agent state management (Available, Meeting, etc.) |
| **Incoming Task Widget** | Task reception and acceptance |
| **Task List Widget** | Active task management |
| **Call Control Widget** | Call handling (hold, transfer, consult) |
| **Outdial Widget** | Outbound call initiation |

---

## 3. Contact Center Flows

### Agent Lifecycle

```
register → stationLogin → setAgentState (Available) → [Handle Tasks] → stationLogout → deregister
```

### Login Options

| Option | Description | Device ID |
|--------|-------------|-----------|
| `BROWSER` | WebRTC in browser | `WebRTC_{agentId}` |
| `EXTENSION` | External phone | Extension number |
| `AGENT_DN` | Direct dial | Phone number |

### Agent State Machine

```
Meeting → Available ↔ Idle (Lunch/Break)
    ↓         ↓
    └→ Available → [Task Incoming] → Engaged → Wrapup → Meeting/Available
                          ↓
                       RONA (timeout)
```

### Task Lifecycle

```
task:incoming → task:assigned → task:established → [Hold/Transfer/Consult] → task:end → task:wrapup → task:wrappedup
     ↓ (decline/RONA)
task:rejected
```

### Transfer vs Consult

| Type | Flow |
|------|------|
| **Blind Transfer** | Agent A → Transfer → Agent B receives task; Agent A → Wrapup |
| **Consult** | Agent A → Consult (customer on hold) → Agent B joins → Complete Transfer OR Cancel |

### Media Channels

| Channel | Utilities |
|---------|-----------|
| `telephony` | `createCallTask()`, `acceptExtensionCall()` |
| `chat` | `createChatTask()`, `acceptIncomingTask()` |
| `email` | `createEmailTask()` |

---

## 4. Test Architecture

### User Set Configuration

| Set | Focus | Port | Suite |
|-----|-------|------|-------|
| SET_1 | Digital incoming tasks | 9221 | `digital-incoming-task-tests.spec.ts` |
| SET_2 | Task lists & multi-session | 9222 | `task-list-multi-session-tests.spec.ts` |
| SET_3 | Auth & user management | 9223 | `station-login-user-state-tests.spec.ts` |
| SET_4 | Task controls | 9224 | `basic-advanced-task-controls-tests.spec.ts` |
| SET_5 | Advanced operations | 9225 | `advanced-task-controls-tests.spec.ts` |

### TestManager SetupConfig

| Property | Purpose |
|----------|---------|
| `needsAgent1`, `needsAgent2` | Agent page requirements |
| `needsCaller`, `needsExtension`, `needsChat` | Additional pages |
| `needsMultiSession`, `needDialNumberLogin` | Login modes |
| `enableConsoleLogging`, `enableAdvancedLogging` | Log capture |

### Key Properties

- `agent1Page`, `agent2Page` - Agent widget pages
- `callerPage` - Webex calling page
- `chatPage`, `dialNumberPage` - Additional pages
- `consoleMessages` - Captured console logs

---

## 5. Constants

```typescript
export const USER_STATES = {
  MEETING: 'Meeting', AVAILABLE: 'Available', LUNCH: 'Lunch Break',
  RONA: 'RONA', ENGAGED: 'Engaged', AGENT_DECLINED: 'Agent_Declined'
};

export const LOGIN_MODE = { DESKTOP: 'Desktop', EXTENSION: 'Extension', DIAL_NUMBER: 'Dial Number' };
export const TASK_TYPES = { CALL: 'Call', CHAT: 'Chat', EMAIL: 'Email', SOCIAL: 'Social' };

// Timeouts
export const AWAIT_TIMEOUT = 10000;
export const WIDGET_INIT_TIMEOUT = 50000;
export const OPERATION_TIMEOUT = 30000;
```

---

## 6. Utility Functions

### initUtils.ts
| Function | Purpose |
|----------|---------|
| `loginViaAccessToken(page, token)` | Login with token |
| `oauthLogin(page, username)` | OAuth login |
| `enableAllWidgets(page)` | Enable CC widgets |
| `initialiseWidgets(page)` | Init and wait for ready |

### stationLoginUtils.ts
| Function | Purpose |
|----------|---------|
| `desktopLogin(page)` | Browser mode login |
| `extensionLogin(page, ext)` | Extension login |
| `dialLogin(page, number)` | Dial number login |
| `stationLogout(page)` | Logout |

### userStateUtils.ts
| Function | Purpose |
|----------|---------|
| `changeUserState(page, state)` | Change state |
| `getCurrentState(page)` | Get current state |
| `verifyCurrentState(page, expected)` | Verify state |
| `checkCallbackSequence(page, state, logs)` | Verify callback order |

### taskControlUtils.ts
| Function | Purpose |
|----------|---------|
| `verifyTaskControls(page, type)` | Verify controls |
| `holdCallToggle(page)` | Toggle hold |
| `recordCallToggle(page)` | Toggle recording |
| `endTask(page)` | End task |

### advancedTaskControlUtils.ts
| Function | Purpose |
|----------|---------|
| `consultOrTransfer(page, type, action, value)` | Consult/transfer |
| `cancelConsult(page)` | Cancel consult |
| `verifyTransferSuccessLogs()` | Verify transfer logs |

### incomingTaskUtils.ts
| Function | Purpose |
|----------|---------|
| `createCallTask(page, number)` | Create call |
| `createChatTask(page, url)` | Create chat |
| `createEmailTask(recipient)` | Create email |
| `acceptIncomingTask(page, type)` | Accept task |
| `acceptExtensionCall(page)` | Accept on extension |

### wrapupUtils.ts
| Function | Purpose |
|----------|---------|
| `submitWrapup(page, reason)` | Submit wrapup |
| `verifyWrapupState(page)` | Verify wrapup |

---

## 7. Test Patterns

### Standard Test Structure

```typescript
export default function createMyTests() {
  let testManager: TestManager;

  test.beforeAll(async ({ browser }, testInfo) => {
    testManager = new TestManager(testInfo.project.name);
    await testManager.setup(browser, { needsAgent1: true, enableConsoleLogging: true });
  });

  test.afterAll(async () => { await testManager.cleanup(); });

  test('should perform action @tag', async () => { /* implementation */ });
}
```

### Suite Orchestration

```typescript
// suites/my-tests.spec.ts
import createMyTests from '../tests/my-test.spec';
test.describe('My Test Suite', createMyTests);
```

---

## 8. Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Test Files | `*-test.spec.ts` | `station-login-test.spec.ts` |
| Suite Files | `*-tests.spec.ts` | `station-login-user-state-tests.spec.ts` |
| Utility Files | `*Utils.ts` | `stationLoginUtils.ts` |
| Actions | `verbNoun` | `changeUserState`, `createCallTask` |
| Verification | `verify*` | `verifyCurrentState` |
| Getters | `get*` | `getCurrentState` |
| Test Names | `should <action> <condition>` | `'should login with Desktop mode'` |
| Pages | `*Page` | `agent1Page`, `callerPage` |
| TestIDs | `widget-name`, `action-button` | `station-login-widget`, `login-button` |

---

## 9. Common Pitfalls

### Playwright Pitfalls

1. **Missing Timeouts** - Always use explicit timeouts (`AWAIT_TIMEOUT`, `OPERATION_TIMEOUT`)
2. **Race Conditions** - Wait for elements before interacting; clear console logs before capturing
3. **Stale Elements** - Re-query after navigation/reload
4. **Iframe Handling** - Use `.contentFrame()`; wait for visibility first
5. **Network Simulation** - Use `page.context().setOffline()`; wait for disconnect/reconnect detection

### Test Design Pitfalls

6. **Test Interdependence** - Each test should be independent with proper setup/teardown
7. **Hardcoded Values** - Use environment variables and `testManager.projectName`
8. **Missing Error Handling** - Provide context in error messages
9. **Console Log Timing** - Clear before operation; wait 3+ seconds for async events
10. **Parallel Conflicts** - Each set uses different agents/queues; don't share state

### SDK-Specific Pitfalls

11. **Widget Init Failures** - Wait for visibility; retry on failure
12. **State Transition Timing** - Wait for callback confirmation before proceeding
13. **Multi-Session Sync** - Enable multi-login first; state/timer should sync
14. **Task Lifecycle** - Complete wrapup; wait for `task:wrappedup` before state change
15. **WebSocket Reconnection** - State persists; some timers may reset
16. **Call Control State** - Hold timer appears on hold; consult requires hold first

### Contact Center Flow Pitfalls

17. **RONA** - Agent must change state after RONA; timeout is 15-30 seconds
18. **Queue Routing** - Verify agent in correct queue; tasks may timeout if no agents
19. **Consult vs Transfer** - Blind=immediate handoff; Consult=3-way then transfer/cancel
20. **Extension Login** - Must be registered; calls require separate acceptance
21. **Wrapup Requirements** - Reason required; has configurable timeout
22. **Multi-Agent Coordination** - Agent2 unavailable for Agent1 tests; target must be available for transfer

---

## 10. Best Practices

### Test Organization
- Export factory functions for test definitions
- Use `beforeAll` for login/widget init; `afterAll` for cleanup
- Clear console before capturing; reset UI between tests
- Use specific TestIDs; verify both UI and console events

### Code Organization
- Single responsibility per utility function
- Return meaningful values or throw descriptive errors
- Use TypeScript types for parameters and returns

### Console Log Capture Pattern
```typescript
testManager.consoleMessages.length = 0;
await performOperation();
await page.waitForTimeout(3000);
const logs = testManager.consoleMessages.filter(msg => msg.includes('PATTERN'));
expect(logs.length).toBeGreaterThan(0);
```

---

## 11. Implementation Guardrails

### Requirements

| Category | Requirements |
|----------|-------------|
| **Setup** | Export factory function; use TestManager; verify widget init |
| **Cleanup** | Call `cleanup()` in afterAll; handle stray tasks; close contexts |
| **Assertions** | Use Playwright `expect`; include timeouts; verify UI and events |
| **Environment** | Credentials via env vars; never commit secrets |

### Timeout Guidelines

| Operation | Timeout |
|-----------|---------|
| Widget Initialization | 50s |
| Incoming Task Detection | 80s |
| Chat Launcher | 60s |
| Network Operations | 35s |
| Standard Operations | 30s |
| Transfer/Consult | 20s |
| Wrapup/Form Fields | 15-20s |
| UI Settle | 2s |

### Architectural Boundaries
- Each USER_SET operates independently with dedicated agents/queues
- Tests interact through UI, not SDK directly
- Verify SDK events through console logs
- Tests run against sandbox; never use production credentials

---

## 12. SDK Events

### Agent Events

| Event | Description |
|-------|-------------|
| `agent:stateChange` | State changed |
| `agent:stateChangeSuccess/Failed` | State change result |
| `agent:stationLoginSuccess/Failed` | Login result |
| `agent:logoutSuccess/Failed` | Logout result |

### Task Events

| Event | Console Pattern |
|-------|-----------------|
| `task:incoming` | `WXCC_SDK_TASK_INCOMING` |
| `task:assigned` | `WXCC_SDK_TASK_ASSIGNED` |
| `task:established` | `WXCC_SDK_TASK_ESTABLISHED` |
| `task:end` | `WXCC_SDK_TASK_END` |
| `task:wrapup` | `WXCC_SDK_TASK_WRAPUP` |
| `task:wrappedup` | `WXCC_SDK_TASK_WRAPPEDUP` |
| `task:rejected` | `WXCC_SDK_TASK_REJECTED` |
| `task:hold/unhold` | Hold state changed |

### Transfer/Consult Events

| Event | Console Pattern |
|-------|-----------------|
| Transfer Success | `WXCC_SDK_TASK_TRANSFER_SUCCESS` |
| Consult Start | `WXCC_SDK_TASK_CONSULT_START_SUCCESS` |
| Consult End | `WXCC_SDK_TASK_CONSULT_END_SUCCESS` |
| Consult Transferred | `AgentConsultTransferred` |

### Recording Events
- `task:recordingPaused/Resumed` - Recording state
- `task:recordingPauseFailed/ResumeFailed` - Recording errors

### Connection Events
- `connectionLost/connectionRestored` - WebSocket state
- `mercury:online/offline` - WebRTC state

### Console Patterns

```typescript
export const CONSOLE_PATTERNS = {
  SDK_STATE_CHANGE_SUCCESS: 'WXCC_SDK_AGENT_STATE_CHANGE_SUCCESS',
  TASK_INCOMING: 'WXCC_SDK_TASK_INCOMING',
  TASK_ESTABLISHED: 'WXCC_SDK_TASK_ESTABLISHED',
  TRANSFER_SUCCESS: 'WXCC_SDK_TASK_TRANSFER_SUCCESS',
  RECORDING_PAUSED: 'WXCC_SDK_TASK_RECORDING_PAUSED',
  STATION_LOGIN_SUCCESS: 'WXCC_SDK_STATION_LOGIN_SUCCESS',
};
```

---

## 13. Test Categories

| Category | Sets | Focus |
|----------|------|-------|
| **Station Login** | SET_3 | Desktop/Extension/Dial login, multi-login, reload, network |
| **User State** | SET_3 | Transitions, timer, callback verification, multi-session sync |
| **Incoming Task** | SET_1, SET_2 | Telephony/Chat/Email accept/decline, task list, RONA |
| **Task Control** | SET_4, SET_5 | Hold, recording, transfer, consult, wrapup |

---

## 14. Adding New Tests

1. **Create test file** in `tests/` exporting factory function
2. **Add to suite** in `suites/` using `test.describe('Name', createTests)`
3. **(Optional) Add new set** in `test-data.ts` with agents, queue, entry points

---

## 15. Running Tests

```bash
yarn test:e2e                                    # All tests
yarn test:e2e suites/station-login-user-state-tests.spec.ts  # Specific suite
yarn test:e2e --project=SET_3                    # Specific set
yarn test:e2e --debug | --ui | --headed          # Debug modes
```

---

## 16. Environment Variables

```env
# Sandbox
PW_SANDBOX=your-sandbox-name
PW_SANDBOX_PASSWORD=sandbox-password

# Entry Points
PW_ENTRY_POINT1=+1234567890
PW_ENTRY_POINT2=+1234567891
# ... PW_ENTRY_POINT3-5

# URLs
PW_CHAT_URL=https://your-chat-base-url

# Email
PW_SENDER_EMAIL=sender@gmail.com
PW_SENDER_EMAIL_PASSWORD=app-password

# Dial Number Login
PW_DIAL_NUMBER_LOGIN_USERNAME=dial-user
PW_DIAL_NUMBER_LOGIN_PASSWORD=dial-password
PW_DIAL_NUMBER_NAME=Dial Number Agent
```

---

**Document Version**: 1.2.0  
**Last Updated**: February 4, 2026  
**Maintained By**: Contact Center SDK Testing Team