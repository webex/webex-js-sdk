# Test Spec: Station Login, User State & Incoming Telephony Task Tests

## 1. Metadata

```yaml
test_key: station-login-user-state-telephony
author: AI Test Architect
date: 2026-02-05
status: Complete
test_summary: |
  Comprehensive E2E test suite for Contact Center SDK covering three core areas:
  1. Station Login Widget - All login modes (Desktop, Extension, Dial Number), persistence, multi-session
  2. User State Widget - State transitions, theme colors, timers, callback verification
  3. Incoming Telephony Tasks - Call lifecycle, RONA handling, wrapup in Desktop and Extension modes
user_set: SET_3
suite_file: suites/station-login-user-state-tests.spec.ts
assumptions:
  - Agents user19/user20 configured in SET_3 with queue assignments
  - Entry points and extension numbers configured in environment
  - RONA timeout configured to 18 seconds
  - Multi-session login enabled via SDK configuration
  - Caller page (Webex Calling web client) available for telephony tests
clarifications:
  - Desktop mode: Agent accepts/declines calls via widget buttons
  - Extension mode: Agent accepts/declines calls via Webex Calling web client
  - RONA occurs when agent doesn't respond within timeout
  - Agent_Declined state occurs when agent explicitly declines
unresolved_items: []
```

---

## 2. Overview

**Objective:** Validate the complete agent experience from station login through state management to telephony task handling.

**Test Scope:**

| Area | In Scope | Out of Scope |
|------|----------|--------------|
| Station Login | Desktop/Extension/Dial Number modes, reload persistence, network disruption, multi-session sync, hideDesktopLogin | - |
| User State | Initial state, theme colors, transitions, timers, callback order, multi-session sync | Engaged state (covered in task tests) |
| Telephony Tasks | Accept/decline/ignore calls, RONA popup, wrapup, customer disconnect | Chat/Email tasks, advanced controls |

**SDK Features Tested:**
- `cc.stationLogin()` / `cc.stationLogout()` - Agent station login/logout
- `cc.setAgentState()` - Change agent state
- `onStateChange` / `onWrapup` callbacks - Event notifications
- `task:incoming`, `task:assigned`, `task:end`, `task:wrapup` events
- WebSocket connection management
- Multi-session synchronization

**Related Files:**
- [station-login-test.spec.ts](tests/station-login-test.spec.ts)
- [user-state-test.spec.ts](tests/user-state-test.spec.ts)
- [incoming-telephony-task-test.spec.ts](tests/incoming-telephony-task-test.spec.ts)

---

## 3. Test Setup

### 3.1 TestManager Configurations

```typescript
// Station Login Tests - Dial Number & Extension modes
await testManager.setupForStationLogin(browser);

// Station Login Tests - Desktop mode
await testManager.setupForStationLogin(browser, true);

// User State Tests
await testManager.basicSetup(browser);
await telephonyLogin(page, LOGIN_MODE.EXTENSION, extensionNumber);

// Incoming Task Tests - Desktop Mode
await testManager.setupForIncomingTaskDesktop(browser);

// Incoming Task Tests - Extension Mode
await testManager.setupForIncomingTaskExtension(browser);
```

### 3.2 Test Data Requirements

| Data | Source | Value |
|------|--------|-------|
| Agent 1 | USER_SETS.SET_3.AGENTS.AGENT1 | user19, extension: 1019 |
| Agent 2 / Caller | USER_SETS.SET_3.AGENTS.AGENT2 | user20, extension: 1020 |
| Entry Point | process.env.${projectName}_ENTRY_POINT | Phone number |
| Queue | USER_SETS.SET_3.QUEUE_NAME | Queue e2e 3 |
| Wrapup Reason | WRAPUP_REASONS.SALE | "Sale" |

### 3.3 Constants Reference

```typescript
USER_STATES: { MEETING, AVAILABLE, LUNCH, RONA, ENGAGED, AGENT_DECLINED }
LOGIN_MODE: { DESKTOP, EXTENSION, DIAL_NUMBER }
THEME_COLORS: { MEETING, AVAILABLE, ENGAGED, RONA }
RONA_OPTIONS: { AVAILABLE, IDLE }
TASK_TYPES: { CALL, CHAT, EMAIL, SOCIAL }
```

---

## 4. Station Login Test Cases (15 Tests)

### 4.1 Dial Number Mode Tests

#### SL-TC1: Login, Logout, and UI Field Visibility with Dial Number Mode
**Tags:** `@dial-number` `@login` `@logout` `@smoke` `@ui` `@fields`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open login widget | Widget visible |
| 2 | Check login mode selector | Selector visible |
| 3 | Check phone number input | Input visible |
| 4 | Check team dropdown | Dropdown visible |
| 5 | Check login button | Button visible |
| 6 | Click on Dial Number radio button | Dial Number mode selected |
| 7 | Select team from dropdown | Team selected |
| 8 | Enter phone number in dial number field | Phone number entered |
| 9 | Click Login button | Login initiated |
| 10 | Wait for station-login div to be hidden | Login successful |
| 11 | Verify user state is visible | State widget displayed |
| 12 | Perform station logout | Agent logged out |
| 13 | Verify station-login div is visible | Logout successful |

```typescript
// UI field visibility
await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
await expect(testManager.agent1Page.getByTestId('login-option-select')).toBeVisible({timeout: 2000});
await expect(testManager.agent1Page.getByTestId('dial-number-input')).toBeVisible({timeout: 2000});
await expect(testManager.agent1Page.getByTestId('teams-select-dropdown')).toBeVisible({timeout: 2000});
await expect(testManager.agent1Page.getByTestId('login-button')).toBeVisible({timeout: 2000});
// Login/logout flow
await dialLogin(testManager.agent1Page, process.env[`${testManager.projectName}_ENTRY_POINT`]!);
await ensureUserStateVisible(testManager.agent1Page);
await stationLogout(testManager.agent1Page);
```

#### SL-TC2: Handle page reload and maintain Dial Number login state
**Tags:** `@dial-number` `@persistence` `@reload`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure user state visible | State widget visible |
| 2 | Reload page | Widget visible |
| 3 | Check login mode | Dial Number |
| 4 | Check dial number value | Value matches |
| 5 | State widget visible | State widget visible |

#### SL-TC3: Retain user state timer and switch to Meeting after network disconnection (Dial Number)
**Tags:** `@dial-number` `@network` `@timer` `@meeting`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure user state visible | State widget visible |
| 2 | Change state to Meeting | State is Meeting |
| 3 | Note timer value | Timer captured |
| 4 | Set offline | Disconnected |
| 5 | Wait for disconnect log | Log captured |
| 6 | Set online | Reconnected |
| 7 | Wait for reconnect log | Log captured |
| 8 | State is Meeting | State restored |
| 9 | Timer > previous | Timer persisted |

#### SL-TC4: Multi-login synchronization for Dial Number Mode
**Tags:** `@dial-number` `@multi-session` `@sync`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure user state visible | State widget visible |
| 2 | Open multi-session page | Multi-session active |
| 3 | Logout from one session | Both sessions logged out |

#### SL-TC5: (SKIPPED) Reset user state timer and maintain Available after network disconnection (Dial Number)
**Tags:** `@dial-number` `@timer` `@reset` `@skip`
**Skip Reason:** Timer reset bug not fixed

### 4.2 Extension Mode Tests


#### SL-TC6: Login, Logout, and UI Field Visibility with Extension Mode
**Tags:** `@extension` `@login` `@logout` `@smoke` `@ui` `@fields`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open login widget | Widget visible |
| 2 | Check login mode selector | Selector visible |
| 3 | Check extension number input | Input visible |
| 4 | Check team dropdown | Dropdown visible |
| 5 | Check login button | Button visible |
| 6 | Click Extension radio button | Extension mode selected |
| 7 | Select team | Team selected |
| 8 | Enter extension number | Extension entered |
| 9 | Click Login | Login initiated |
| 10 | State widget visible | Login successful |
| 11 | Logout | Logout successful |

```typescript
// UI field visibility
await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
await expect(testManager.agent1Page.getByTestId('login-option-select')).toBeVisible({timeout: 2000});
await expect(testManager.agent1Page.getByTestId('dial-number-input')).toBeVisible({timeout: 2000});
await expect(testManager.agent1Page.getByTestId('teams-select-dropdown')).toBeVisible({timeout: 2000});
await expect(testManager.agent1Page.getByTestId('login-button')).toBeVisible({timeout: 2000});
// Login/logout flow
await extensionLogin(testManager.agent1Page, process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]!);
await ensureUserStateVisible(testManager.agent1Page);
await stationLogout(testManager.agent1Page);
```

#### SL-TC7: Handle page reload and maintain Extension login state
**Tags:** `@extension` `@persistence` `@reload`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure user state visible | State widget visible |
| 2 | Reload page | Widget visible |
| 3 | Check login mode | Extension |
| 4 | Check extension value | Value matches |
| 5 | State widget visible | State widget visible |

#### SL-TC8: Retain user state timer and switch to Meeting after network disconnection (Extension)
**Tags:** `@extension` `@network` `@timer` `@meeting`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure user state visible | State widget visible |
| 2 | Change state to Meeting | State is Meeting |
| 3 | Note timer value | Timer captured |
| 4 | Set offline | Disconnected |
| 5 | Wait for disconnect log | Log captured |
| 6 | Set online | Reconnected |
| 7 | Wait for reconnect log | Log captured |
| 8 | State is Meeting | State restored |
| 9 | Timer > previous | Timer persisted |

#### SL-TC9: Multi-login synchronization for Extension Mode
**Tags:** `@extension` `@multi-session` `@sync`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure user state visible | State widget visible |
| 2 | Open multi-session page | Multi-session active |
| 3 | Logout from one session | Both sessions logged out |

#### SL-TC10: (SKIPPED) Reset user state timer and maintain Available after network disconnection (Extension)
**Tags:** `@extension` `@timer` `@reset` `@skip`
**Skip Reason:** Timer reset bug not fixed

### 4.3 hideDesktopLogin Feature Tests

#### SL-TC11: Toggle Desktop option visibility with hideDesktopLogin
**Tags:** `@hide-desktop` `@feature-toggle` `@ui`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open login widget | Widget visible |
| 2 | Toggle hideDesktopLogin checkbox | Desktop option hidden/visible |
| 3 | Toggle again | Desktop option toggles |

### 4.4 Desktop Mode Tests


#### SL-TC12: Login, Logout, and UI Field Visibility with Desktop Mode
**Tags:** `@desktop` `@login` `@logout` `@smoke` `@ui` `@fields`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open login widget | Widget visible |
| 2 | Check login mode selector | Selector visible |
| 3 | Check team dropdown | Dropdown visible |
| 4 | Check login button | Button visible |
| 5 | Select Desktop mode | Desktop selected |
| 6 | Select team | Team selected |
| 7 | Click Login | Login initiated |
| 8 | State widget visible | Login successful |
| 9 | Logout | Logout successful |

```typescript
// UI field visibility
await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
await expect(testManager.agent1Page.getByTestId('login-option-select')).toBeVisible({timeout: 2000});
await expect(testManager.agent1Page.getByTestId('teams-select-dropdown')).toBeVisible({timeout: 2000});
await expect(testManager.agent1Page.getByTestId('login-button')).toBeVisible({timeout: 2000});
// Login/logout flow
await desktopLogin(testManager.agent1Page);
await ensureUserStateVisible(testManager.agent1Page);
await stationLogout(testManager.agent1Page);
```

#### SL-TC13: (SKIPPED) Handle page reload and maintain Desktop login state
**Tags:** `@desktop` `@persistence` `@reload` `@skip`

#### SL-TC14: Retain user state timer and switch to Meeting after network disconnection (Desktop)
**Tags:** `@desktop` `@network` `@timer` `@meeting`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Ensure user state visible | State widget visible |
| 2 | Change state to Meeting | State is Meeting |
| 3 | Note timer value | Timer captured |
| 4 | Set offline | Disconnected |
| 5 | Wait for disconnect log | Log captured |
| 6 | Set online | Reconnected |
| 7 | Wait for reconnect log | Log captured |
| 8 | State is Meeting | State restored |
| 9 | Timer > previous | Timer persisted |

#### SL-TC15: (SKIPPED) Reset user state timer and maintain Available after network disconnection (Desktop)
**Tags:** `@desktop` `@timer` `@reset` `@skip`
**Skip Reason:** Timer reset bug not fixed


## 5. User State Test Cases (7 Tests)

### US-TC1: Verify Initial State is Meeting
**Tags:** `@user-state` `@initial-state` `@smoke`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login with Extension mode | Login successful |
| 2 | Get current state | State retrieved |
| 3 | Verify state is Meeting | Initial state correct |

```typescript
const currentState = await getCurrentState(testManager.agent1Page);
expect(currentState).toBe(USER_STATES.MEETING);
```

---

### US-TC2: Verify Meeting State Theme Color
**Tags:** `@user-state` `@theme` `@meeting`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Verify current state is Meeting | State is Meeting |
| 2 | Get state-select background color | Color retrieved |
| 3 | Compare with THEME_COLORS.MEETING | Color matches |

```typescript
const color = await userStateElement.evaluate((el) => getComputedStyle(el).backgroundColor);
expect(isColorClose(color, THEME_COLORS.MEETING)).toBe(true);
```

---

### US-TC3: Verify State Transition and Timer Reset
**Tags:** `@user-state` `@transition` `@timer`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Change state to Available | State changed |
| 2 | Wait 3 seconds | Timer running |
| 3 | Get elapsed time | Timer > 0 |
| 4 | Change state to Meeting | State changed |
| 5 | Wait 1 second | Timer reset |
| 6 | Verify timer < previous | Timer reset confirmed |

---

### US-TC4: Verify Callback and API Success Logging Order
**Tags:** `@user-state` `@callback` `@logging`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Clear console messages | Logs cleared |
| 2 | Change state to Available | State changed |
| 3 | Wait for console logs | Logs captured |
| 4 | Verify callback sequence | onStateChange after API success |

```typescript
expect(checkCallbackSequence(testManager.consoleMessages)).toBe(true);
```

---

### US-TC5: Verify State Persistence After Page Reload
**Tags:** `@user-state` `@persistence` `@reload`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Change to Available | State changed |
| 2 | Note timer value | Timer captured |
| 3 | Reload page | Page reloaded |
| 4 | Re-enable widgets | Widgets enabled |
| 5 | Verify state is Available | State persisted |
| 6 | Verify timer > previous | Timer persisted |

---

### US-TC6: Verify Multi-Session State Synchronization
**Tags:** `@user-state` `@multi-session` `@sync`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Login on multiSessionPage | Session 2 active |
| 2 | Change state on agent1Page to Available | State changed |
| 3 | Verify multiSessionPage state | State synchronized |
| 4 | Change state on multiSessionPage to Lunch | State changed |
| 5 | Verify agent1Page state | State synchronized |

```typescript
await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
await verifyCurrentState(testManager.multiSessionPage, USER_STATES.AVAILABLE);
```

---

### US-TC7: Verify Dual Timer for Idle States
**Tags:** `@user-state` `@dual-timer` `@idle`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Change to Lunch Break | Idle state active |
| 2 | Wait 3 seconds | Timer running |
| 3 | Get elapsed time | Should contain "/" |
| 4 | Parse both timer values | Format: MM:SS / MM:SS |
| 5 | Verify both timers > 0 | Dual timer working |

---

## 6. Incoming Telephony Task Test Cases (12 Tests)

### 6.1 Desktop Mode Tests

#### IT-TC1: Accept Call, End and Complete Wrapup (Desktop)
**Tags:** `@desktop` `@accept` `@wrapup` `@lifecycle`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create call from caller page | Call initiated |
| 2 | Set agent to Available | Ready for call |
| 3 | Wait for incoming task widget | Task visible (40s) |
| 4 | Accept incoming task | Call accepted |
| 5 | Wait for Engaged state | State changed |
| 6 | Verify Engaged theme color | Color matches |
| 7 | Verify Engaged in console logs | Log captured |
| 8 | Click end call button | Call ended |
| 9 | Submit wrapup (SALE reason) | Wrapup submitted |
| 10 | Wait for Available state | State restored |
| 11 | Verify callback order | Wrapup before state change |

```typescript
await createCallTask(callerPage, entryPoint);
await changeUserState(agent1Page, USER_STATES.AVAILABLE);
await acceptIncomingTask(agent1Page, TASK_TYPES.CALL);
await waitForState(agent1Page, USER_STATES.ENGAGED);
await agent1Page.getByTestId('call-control:end-call').first().click();
await submitWrapup(agent1Page, WRAPUP_REASONS.SALE);
expect(await verifyCallbackLogs(capturedLogs, WRAPUP_REASONS.SALE, USER_STATES.AVAILABLE)).toBe(true);
```

---

#### IT-TC2: Decline Call and Verify RONA State (Desktop)
**Tags:** `@desktop` `@decline` `@rona` `@agent-declined`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set agent to Available | Ready for call |
| 2 | Create call from caller | Call initiated |
| 3 | Wait for incoming task | Task visible |
| 4 | Decline incoming task | Task declined |
| 5 | Wait for RONA popup | Popup visible (15s) |
| 6 | Verify Agent_Declined state | State changed |
| 7 | Verify Meeting theme color | Agent is idle |
| 8 | End call from caller | Call ended |
| 9 | Submit RONA popup (Idle) | Meeting state |

```typescript
await declineIncomingTask(agent1Page, TASK_TYPES.CALL);
await agent1Page.getByTestId('samples:rona-popup').waitFor({state: 'visible', timeout: 15000});
await verifyCurrentState(agent1Page, USER_STATES.AGENT_DECLINED);
await submitRonaPopup(agent1Page, RONA_OPTIONS.IDLE);
```

---

#### IT-TC3: Ignore Call and Wait for RONA Timeout (Desktop)
**Tags:** `@desktop` `@ignore` `@rona` `@timeout`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set agent to Available | Ready for call |
| 2 | Create call | Call initiated |
| 3 | Wait for incoming task | Task visible |
| 4 | Wait for task to auto-hide | RONA timeout (30s) |
| 5 | Wait for RONA popup | Popup visible |
| 6 | End call from caller | Call ended |
| 7 | Submit RONA popup (Idle) | Meeting state |

---

#### IT-TC4: RONA - Select Available and Receive Another Call (Desktop)
**Tags:** `@desktop` `@rona` `@available` `@receive-again`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set Available, create call, decline | RONA popup visible |
| 2 | Submit RONA with Available | Agent is Available |
| 3 | Wait for incoming task again | Call re-routed |
| 4 | Decline again | Second RONA popup |
| 5 | Submit RONA with Idle | Meeting state |

---

#### IT-TC5: Set Agent State to Busy After Declining Call (Desktop)
**Tags:** `@desktop` `@decline` `@rona` `@busy`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create call, set Available | Call routing |
| 2 | Wait for incoming task | Task visible |
| 3 | Decline incoming task | RONA popup appears |
| 4 | Submit RONA with Idle | Agent state set to Meeting (busy) |
| 5 | Verify no incoming task | No new call received |
| 6 | End call from caller | Cleanup |

```typescript
await createCallTask(testManager.callerPage, process.env[`${testManager.projectName}_ENTRY_POINT`]!);
await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);
await declineIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
await testManager.agent1Page.getByTestId('samples:rona-popup').waitFor({state: 'visible', timeout: 15000});
await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
await waitForState(testManager.agent1Page, USER_STATES.MEETING);
const incomingTaskDiv = testManager.agent1Page.getByTestId('samples:incoming-task-telephony').first();
await expect(incomingTaskDiv).toBeHidden();
await endCallTask(testManager.callerPage!, true);
```

---

#### IT-TC6: Customer Disconnect Before Agent Answers (Desktop)
**Tags:** `@desktop` `@customer-disconnect` `@available`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Set Available, create call | Call routing |
| 2 | Wait for incoming task | Task visible |
| 3 | End call from caller | Customer disconnect |
| 4 | Wait for task to hide | Task removed |
| 5 | Verify agent is Available | State unchanged |

```typescript
await endCallTask(callerPage);
await incomingTaskDiv.waitFor({state: 'hidden', timeout: 30000});
await verifyCurrentState(agent1Page, USER_STATES.AVAILABLE);
```

---

### 6.2 Extension Mode Tests

#### IT-TC7: Accept Call, End and Complete Wrapup (Extension)
**Tags:** `@extension` `@accept` `@wrapup` `@lifecycle`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create call, set Available | Call routing |
| 2 | Wait for incoming task widget | Task visible |
| 3 | Wait for extension call indicator | Call on extension (20s) |
| 4 | Accept on extension page | Call accepted |
| 5 | Verify Engaged state | State changed |
| 6 | End call from extension | Call ended |
| 7 | Submit wrapup | Wrapup completed |

```typescript
await acceptExtensionCall(agent1ExtensionPage);
await waitForState(agent1Page, USER_STATES.ENGAGED);
await endCallTask(agent1ExtensionPage);
await submitWrapup(agent1Page, WRAPUP_REASONS.SALE);
```

---

#### IT-TC8: Decline Call and Verify RONA State (Extension)
**Tags:** `@extension` `@decline` `@rona`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create call, set Available | Call routing |
| 2 | Wait for extension indicator | Call visible |
| 3 | Decline on extension page | Call declined |
| 4 | Wait for RONA popup | Popup visible |
| 5 | Verify Agent_Declined | State changed |

```typescript
await declineExtensionCall(agent1ExtensionPage);
await verifyCurrentState(agent1Page, USER_STATES.AGENT_DECLINED);
```

---

#### IT-TC9: Ignore Call and Wait for RONA Timeout (Extension)
**Tags:** `@extension` `@ignore` `@rona` `@timeout`

Same flow as Desktop but ignoring on extension page.

---

#### IT-TC10: RONA - Select Available and Receive Another Call (Extension)
**Tags:** `@extension` `@rona` `@available`

---


#### IT-TC11: Set Agent State to Busy After Declining Call (Extension)
**Tags:** `@extension` `@decline` `@rona` `@busy`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Create call, set Available | Call routing |
| 2 | Wait for incoming task | Task visible |
| 3 | Decline on extension page | RONA popup appears |
| 4 | Submit RONA with Idle | Agent state set to Meeting (busy) |
| 5 | Verify no incoming task | No new call received |
| 6 | End call from caller | Cleanup |

```typescript
await createCallTask(testManager.callerPage, process.env[`${testManager.projectName}_ENTRY_POINT`]!);
await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);
await declineExtensionCall(testManager.agent1ExtensionPage);
await testManager.agent1Page.getByTestId('samples:rona-popup').waitFor({state: 'visible', timeout: 15000});
await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
await waitForState(testManager.agent1Page, USER_STATES.MEETING);
const incomingTaskDiv = testManager.agent1Page.getByTestId('samples:incoming-task-telephony').first();
await expect(incomingTaskDiv).toBeHidden();
await endCallTask(testManager.callerPage!, true);
```

#### IT-TC12: Customer Disconnect Before Agent Answers (Extension)
**Tags:** `@extension` `@customer-disconnect`

---

## 7. Utility Reference

### 7.1 Station Login Utilities (stationLoginUtils.ts)

| Utility | Purpose |
|---------|---------|
| `desktopLogin(page)` | Login with Desktop mode |
| `extensionLogin(page, extension)` | Login with Extension mode |
| `dialLogin(page, phoneNumber)` | Login with Dial Number mode |
| `telephonyLogin(page, mode, value)` | Generic telephony login |
| `stationLogout(page)` | Logout from station |
| `verifyLoginMode(page, mode)` | Verify current login mode |
| `ensureUserStateVisible(page)` | Wait for state widget |

### 7.2 User State Utilities (userStateUtils.ts)

| Utility | Purpose |
|---------|---------|
| `getCurrentState(page)` | Get current agent state |
| `changeUserState(page, state)` | Change agent state |
| `verifyCurrentState(page, expected)` | Assert current state |
| `getStateElapsedTime(page)` | Get timer value |
| `checkCallbackSequence(logs)` | Verify callback order |

### 7.3 Incoming Task Utilities (incomingTaskUtils.ts)

| Utility | Purpose |
|---------|---------|
| `createCallTask(page, number)` | Create call from caller |
| `endCallTask(page)` | End call from caller/extension |
| `acceptIncomingTask(page, type)` | Accept via widget |
| `declineIncomingTask(page, type)` | Decline via widget |
| `acceptExtensionCall(page)` | Accept on extension page |
| `declineExtensionCall(page)` | Decline on extension page |
| `submitRonaPopup(page, option)` | Submit RONA popup |

### 7.4 Wrapup Utilities (wrapupUtils.ts)

| Utility | Purpose |
|---------|---------|
| `submitWrapup(page, reason)` | Submit wrapup reason |

### 7.5 Helper Utilities (helperUtils.ts)

| Utility | Purpose |
|---------|---------|
| `waitForState(page, state)` | Wait for state to appear |
| `waitForStateLogs(logs, state)` | Wait for state in console |
| `isColorClose(actual, expected)` | Compare theme colors |

---

## 8. Timing & Timeouts

| Operation | Timeout | Rationale |
|-----------|---------|-----------|
| Incoming task visible | 40000ms | Queue routing delay |
| Extension call indicator | 20000ms | WebRTC setup |
| RONA popup visible | 15000ms | After RONA timeout |
| Task auto-hide (RONA) | 30000ms | RONA timeout + processing |
| Network reconnection | 30000ms | WebSocket reconnection |
| State transition | 5000ms | UI update delay |
| Post-action settle | 2000-5000ms | Async event processing |

---

## 9. Console Log Patterns

| Event | Console Pattern |
|-------|-----------------|
| State Change | `onStateChange invoked with state name: <state>` |
| Wrapup | `onWrapup invoked with reason : <reason>` |
| Disconnect | `disconnect with reason` |
| Reconnect | `WCC connection success` |
| API Success | `setAgentState succeeded` |

---

## 10. Test Suite Structure

```typescript
// suites/station-login-user-state-tests.spec.ts
import {test} from '@playwright/test';
import createStationLoginTests from '../tests/station-login-test.spec';
import createUserStateTests from '../tests/user-state-test.spec';
import createIncomingTelephonyTaskTests from '../tests/incoming-telephony-task-test.spec';

test.describe('Station Login Tests', createStationLoginTests);
test.describe('User State Tests', createUserStateTests);
test.describe('Incoming Telephony Task Tests', createIncomingTelephonyTaskTests);
```

---

## 11. Test Summary Matrix

### Station Login Tests (15)

| ID      | Mode            | Focus                        | Status  |
|---------|-----------------|------------------------------|---------|
| SL-TC1  | Dial Number     | Login/Logout & UI Fields     | Active  |
| SL-TC2  | Dial Number     | Reload Persistence           | Active  |
| SL-TC3  | Dial Number     | Timer Persist (Meeting)      | Active  |
| SL-TC4  | Dial Number     | Multi-Session Sync           | Active  |
| SL-TC5  | Dial Number     | Timer Reset (Available)      | Skipped |
| SL-TC6  | Extension       | Login/Logout & UI Fields     | Active  |
| SL-TC7  | Extension       | Reload Persistence           | Active  |
| SL-TC8  | Extension       | Timer Persist (Meeting)      | Active  |
| SL-TC9  | Extension       | Multi-Session Sync           | Active  |
| SL-TC10 | Extension       | Timer Reset (Available)      | Skipped |
| SL-TC11 | hideDesktop     | Feature Toggle UI            | Active  |
| SL-TC12 | Desktop         | Login/Logout & UI Fields     | Active  |
| SL-TC13 | Desktop         | Reload Persistence           | Skipped |
| SL-TC14 | Desktop         | Timer Persist (Meeting)      | Active  |
| SL-TC15 | Desktop         | Timer Reset (Available)      | Skipped |

### User State Tests (7)

| ID      | Focus                          | Status  |
|---------|--------------------------------|---------|
| US-TC1  | Initial State Meeting          | Active  |
| US-TC2  | Meeting Theme Color            | Active  |
| US-TC3  | State Transition & Timer Reset | Active  |
| US-TC4  | Callback & API Logging Order   | Active  |
| US-TC5  | State Persistence (Reload)     | Active  |
| US-TC6  | Multi-Session State Sync       | Active  |
| US-TC7  | Dual Timer for Idle States     | Active  |

### Incoming Telephony Task Tests (12)

| ID      | Mode      | Focus                                 | Status  |
|---------|-----------|---------------------------------------|---------|
| IT-TC1  | Desktop   | Accept/End/Wrapup                     | Active  |
| IT-TC2  | Desktop   | Decline/RONA                          | Active  |
| IT-TC3  | Desktop   | Ignore/RONA Timeout                   | Active  |
| IT-TC4  | Desktop   | RONA → Available (Receive Again)      | Active  |
| IT-TC5  | Desktop   | Busy State After Decline (RONA/Idle)  | Active  |
| IT-TC6  | Desktop   | Customer Disconnect                   | Active  |
| IT-TC7  | Extension | Accept/End/Wrapup                     | Active  |
| IT-TC8  | Extension | Decline/RONA                          | Active  |
| IT-TC9  | Extension | Ignore/RONA Timeout                   | Active  |
| IT-TC10 | Extension | RONA → Available (Receive Again)      | Active  |
| IT-TC11 | Extension | Busy State After Decline (RONA/Idle)  | Active  |
| IT-TC12 | Extension | Customer Disconnect                   | Active  |

---

## 12. Important Notes

### RONA Configuration
> **NOTE:** Set RONA Timeout to 18 seconds before running telephony tests.

### State Definitions
- **RONA**: Agent didn't respond within timeout
- **Agent_Declined**: Agent explicitly declined
- Both trigger RONA popup

### Extension Mode
- Call control happens on extension page (Webex Calling web client)
- Widget shows notification but no accept/decline buttons

---

**Total Test Cases: 34**
- Station Login: 15 (11 active, 4 skipped)
- User State: 7 (all active)
- Incoming Telephony: 12 (all active)

---

**Spec Version**: 1.0.0  
**Last Updated**: February 5, 2026  
**Generated By**: AI Test Architect