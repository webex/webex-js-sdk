# Playwright E2E — Architecture Reference

## Purpose

Complete technical reference for the Playwright E2E framework in `@webex/contact-center`. This document covers the SUT, TestManager, utilities, constants, patterns, and file topology.

---

## System Under Test (SUT)

The SUT is the **SDK sample app** at `docs/samples/contact-center/`. Unlike ccWidgets (which tests UI widgets), ccSDK E2E tests exercise the raw SDK through a vanilla JavaScript sample app.

### SUT Structure

| File | Purpose |
|------|---------|
| `docs/samples/contact-center/app.js` | Main app — exposes SDK methods via DOM elements |
| `docs/samples/contact-center/index.html` | HTML with buttons, dropdowns, and status elements |
| `docs/samples/contact-center/style.css` | Styling |

### Key DOM Elements (from `app.js`)

| Element ID | SDK Method / Purpose |
|------------|---------------------|
| `#access-token-save` | Store auth token |
| `#webexcc-register` | `cc.register()` — WebSocket registration |
| `#webexcc-deregister` | `cc.deregister()` — WebSocket disconnect |
| `#loginAgent` | `agent.stationLogin()` — Station login |
| `#logoutAgent` | `agent.logout()` — Agent logout |
| `#setAgentStatus` | `agent.stateChange()` — Set agent state |
| `#answer` | `task.answer()` — Answer incoming task |
| `#decline` | `task.decline()` — Decline incoming task |
| `#hold-resume` | `task.hold()` / `task.resume()` — Hold/resume |
| `#end` | `task.end()` — End active task |
| `#wrapup` | `task.wrapup()` — Submit wrapup |
| `#initiate-consult` | `task.consult()` — Start consultation |
| `#consult-transfer` | `task.consultTransfer()` — Consult transfer |
| `#initiate-transfer` | `task.blindTransfer()` — Blind transfer |
| `#merge-conference` | `task.conference()` — Merge to conference |

### Console Output Pattern

The sample app logs SDK events and state changes to the browser console. E2E tests capture these via `page.on('console', ...)` — this is the **primary assertion mechanism** for SDK behavior verification.

Key console output patterns from `app.js`:
- `WXCC_SDK_*` events logged on SDK callbacks
- `onStateChange invoked with state name: <state>` on agent state transitions
- `onHoldResume` callbacks on hold/resume actions

---

## TestManager

The `TestManager` class orchestrates browser context creation, page provisioning, login flows, and cleanup for each test.

### Constructor

```typescript
class TestManager {
  constructor(projectName: string, maxRetries: number = DEFAULT_MAX_RETRIES)
}
```

- `projectName`: Maps to environment variable prefix for per-SET credentials (`${projectName}_AGENT1_ACCESS_TOKEN`, etc.)
- `maxRetries`: Retry count for flaky operations (default: 3)

### SetupConfig Options

| Option | Type | Default | Purpose |
|--------|------|---------|---------|
| `needsAgent1` | `boolean` | `true` | Provision agent 1 browser context + login |
| `needsAgent2` | `boolean` | `false` | Provision agent 2 for multi-agent tests |
| `needsCaller` | `boolean` | `false` | Provision caller page for incoming task tests |
| `needsExtension` | `boolean` | `false` | Provision extension login page |
| `needsChat` | `boolean` | `false` | Provision chat page for digital channel tests |
| `needsMultiSession` | `boolean` | `false` | Provision second session for same agent |
| `agent1LoginMode` | `LoginMode` | `'Desktop'` | Login mode: Desktop, Extension, or Dial Number |
| `enableConsoleLogging` | `boolean` | `true` | Capture console messages for verification |
| `enableAdvancedLogging` | `boolean` | `false` | Capture advanced task control console events |
| `needDialNumberLogin` | `boolean` | `false` | Provision dial number login flow |

### Page Properties

| Property | Type | Description |
|----------|------|-------------|
| `agent1Page` | `Page` | Main agent 1 page (always available) |
| `agent2Page` | `Page` | Agent 2 page (when `needsAgent2: true`) |
| `callerPage` | `Page` | Caller extension page (when `needsCaller: true`) |
| `agent1ExtensionPage` | `Page` | Extension login page (when `needsExtension: true`) |
| `chatPage` | `Page` | Chat page (when `needsChat: true`) |
| `multiSessionAgent1Page` | `Page` | Second session page (when `needsMultiSession: true`) |
| `dialNumberPage` | `Page` | Dial number page (when `needDialNumberLogin: true`) |

### Convenience Methods

| Method | Purpose |
|--------|---------|
| `setup(browser, config)` | 3-phase parallel setup: contexts → login + init → console logging |
| `cleanup()` | Close all browser contexts in parallel |
| `retryOperation(operation, name, maxRetries)` | Retry with exponential backoff |
| `isLogoutButtonVisible(page, timeout)` | Check if logout button is visible |

### 3-Phase Parallel Setup

The `setup()` method executes in three parallelized phases:

1. **Create browser contexts** — `Promise.all` creates all required `BrowserContext` + `Page` pairs
2. **Login + widget init** — `Promise.all` runs login flows for each provisioned page independently
3. **Console logging** — Attaches `page.on('console', ...)` handlers after pages are ready

### Cleanup

`cleanup()` closes all open browser contexts in parallel. Tests MUST call `cleanup()` in `test.afterAll` to avoid leaked browser processes.

---

## Utils Reference

Shared utilities in `playwright/utils/`. Each file provides focused helper functions.

| File | Key Functions | Purpose |
|------|--------------|---------|
| `initUtils.ts` | `enableAllWidgets()`, `initialiseWidgets()`, `loginViaAccessToken()`, `enableMultiLogin()` | Page initialization, widget loading, token-based auth |
| `stationLoginUtils.ts` | `telephonyLogin()`, `stationLogout()` | Station login/logout flows with team and DN selection |
| `incomingTaskUtils.ts` | `loginExtension()` | Extension login for caller agent |
| `taskControlUtils.ts` | `setupConsoleLogging()` | Basic console log capture setup |
| `advancedTaskControlUtils.ts` | `setupAdvancedConsoleLogging()` | Advanced console log capture for task controls |
| `helperUtils.ts` | `pageSetup()`, `handleStrayTasks()` | Page navigation, stray task cleanup |
| `userStateUtils.ts` | State change utilities | Agent state transition helpers |
| `wrapupUtils.ts` | Wrapup utilities | Wrapup code selection and submission |

---

## Constants

### Enums (const object + type pattern)

| Constant | Values | Purpose |
|----------|--------|---------|
| `USER_STATES` | Meeting, Available, Lunch Break, RONA, Engaged, Agent_Declined | Agent state values |
| `THEME_COLORS` | RGB values for Available, Meeting, Engaged, RONA | Visual state indicators |
| `LOGIN_MODE` | Desktop, Extension, Dial Number | Station login modes |
| `PAGE_TYPES` | agent1, agent2, caller, extension, chat, multiSession, dialNumber | TestManager page identifiers |
| `TASK_TYPES` | Call, Chat, Email, Social | Task channel types |
| `WRAPUP_REASONS` | Sale, Resolved | Wrapup completion reasons |
| `RONA_OPTIONS` | Available, Idle | RONA recovery options |

### Timeout Hierarchy

Timeouts are organized from shortest to longest. Always pick the smallest timeout that satisfies the operation — never use a longer timeout "just in case."

| Timeout | Value | Use For |
|---------|-------|---------|
| `DROPDOWN_SETTLE_TIMEOUT` | 200ms | UI micro-interactions (dropdown animation) |
| `UI_SETTLE_TIMEOUT` | 2000ms | UI state settling after action |
| `DEFAULT_TIMEOUT` | 5000ms | Default TestManager operation timeout |
| `AWAIT_TIMEOUT` | 10000ms | Universal await for async operations |
| `WRAPUP_TIMEOUT` | 15000ms | Wrapup submission + confirmation |
| `FORM_FIELD_TIMEOUT` | 20000ms | Form field population after API response |
| `OPERATION_TIMEOUT` | 30000ms | Long-running SDK operations |
| `EXTENSION_REGISTRATION_TIMEOUT` | 40000ms | Extension registration + WebSocket setup |
| `NETWORK_OPERATION_TIMEOUT` | 40000ms | Network-dependent operations |
| `WIDGET_INIT_TIMEOUT` | 50000ms | Full widget initialization |
| `ACCEPT_TASK_TIMEOUT` | 60000ms | Incoming task acceptance (includes routing delay) |
| `CHAT_LAUNCHER_TIMEOUT` | 60000ms | Chat widget launcher initialization |

### Console Patterns

| Pattern | Value | Purpose |
|---------|-------|---------|
| `SDK_STATE_CHANGE_SUCCESS` | `'WXCC_SDK_AGENT_STATE_CHANGE_SUCCESS'` | Detect successful agent state change |
| `ON_STATE_CHANGE_REGEX` | `/onStateChange invoked with state name:\s*(.+)/i` | Extract state name from callback log |
| `ON_STATE_CHANGE_KEYWORDS` | `['onstatechange', 'invoked']` | Quick-match keywords before regex |

---

## Console Log Verification Pattern

This is the **primary assertion mechanism** for SDK E2E tests. Instead of checking UI elements (which don't exist in SDK-only tests), tests verify SDK behavior by capturing browser console output.

### How It Works

1. **Setup**: `page.on('console', (msg) => tm.consoleMessages.push(msg.text()))` captures all console output
2. **Action**: Test triggers SDK method via DOM element click (e.g., `page.click('#answer')`)
3. **Verify**: Test asserts that expected console patterns appeared:
   ```typescript
   // Wait for state change event
   await expect.poll(() =>
     tm.consoleMessages.some(msg =>
       msg.includes(CONSOLE_PATTERNS.SDK_STATE_CHANGE_SUCCESS)
     )
   ).toBeTruthy();

   // Extract state name from callback
   const stateMsg = tm.consoleMessages.find(msg =>
     CONSOLE_PATTERNS.ON_STATE_CHANGE_REGEX.test(msg)
   );
   const match = stateMsg?.match(CONSOLE_PATTERNS.ON_STATE_CHANGE_REGEX);
   expect(match?.[1]).toBe('Available');
   ```

### Key Rules

- **Always use `expect.poll()`** for console message checks — messages arrive asynchronously
- **Use exact matches** where possible — avoid `expect.objectContaining` or partial matches
- **Clear `consoleMessages` between assertions** if the same pattern appears multiple times
- **Reference `CONSOLE_PATTERNS`** from constants — never hardcode pattern strings in tests

---

## Set → Suite → Test Mapping

> This table is empty because no tests exist yet. Update this table as tests are added.

| SET (Project) | Suite File | Test Files | Description |
|--------------|------------|------------|-------------|
| _(none yet)_ | — | — | No E2E tests exist yet |

---

## File Topology

> Update this tree as files are added.

```
packages/@webex/contact-center/playwright/
├── ai-docs/
│   ├── AGENTS.md                      # This usage guide
│   └── ARCHITECTURE.md                # This file
├── test-manager.ts                    # TestManager class (to be created)
├── constants.ts                       # Timeouts, enums, console patterns (to be created)
├── playwright.config.ts               # Playwright config (to be created)
├── global-setup.ts                    # One-time auth/env setup (to be created)
├── test-data.ts                       # Fixture data (to be created)
├── utils/                             # Shared utilities (to be created)
├── tests/                             # Test files organized by SET (to be created)
└── suites/                            # Suite registries (to be created)
```

---

## Extension Points

When adding new capabilities to the framework:

1. **New page type**: Add to `PAGE_TYPES` constant, add property to TestManager, add context creation in `createContextsForConfig()`, add setup in `createSetupPromises()`
2. **New SetupConfig option**: Add to `SetupConfig` interface with default in `setup()`, document in this file's SetupConfig table
3. **New timeout**: Add to constants file at correct hierarchy level, document in this file's Timeout Hierarchy table
4. **New console pattern**: Add to `CONSOLE_PATTERNS` constant, document in this file's Console Patterns table
5. **New utility file**: Create in `utils/`, export functions, document in this file's Utils Reference table

---

## Stability Principles

1. **Root cause over timeout increase** — If a test fails intermittently, investigate why, don't just bump timeouts
2. **Explicit waits over implicit** — Use `expect.poll()`, `page.waitForSelector()`, or `page.waitForEvent()` instead of `page.waitForTimeout()`
3. **Isolated tests** — Each test file exports a factory function. Tests share no mutable state outside TestManager
4. **Deterministic cleanup** — `cleanup()` in `afterAll` closes all contexts. `handleStrayTasks()` cleans orphaned tasks
5. **Named callbacks** — Use named functions for `.on()`/`.off()` handlers so they can be unsubscribed
