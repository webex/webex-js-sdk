# Playwright E2E Framework — Architecture

## Purpose

Technical reference for Playwright framework structure, runtime data flow, and extension points.

---

## Layering

```text
Playwright Project (Set)
  -> Suite (playwright/suites/*.spec.ts)
    -> Test Factory (playwright/tests/*.spec.ts)
      -> Utils + TestManager + Constants
        -> Browser + Widgets + SDK-backed behavior
```

---

## Source of Truth

- Set definitions and suite mapping: `playwright/test-data.ts` (`USER_SETS`)
- Project generation and browser/runtime config: `playwright.config.ts`
- Runtime setup/teardown orchestration: `playwright/test-manager.ts`
- Shared test operations: `playwright/Utils/*.ts`
- Shared constants/types/timeouts: `playwright/constants.ts`
- OAuth + set-scoped env expansion: `playwright/global.setup.ts`

---

## Current File Topology (Baseline)

```text
playwright/
├── suites/
│   ├── digital-incoming-task-tests.spec.ts
│   ├── task-list-multi-session-tests.spec.ts
│   ├── station-login-user-state-tests.spec.ts
│   ├── basic-advanced-task-controls-tests.spec.ts
│   ├── advanced-task-controls-tests.spec.ts
│   ├── dial-number-tests.spec.ts
│   ├── multiparty-conference-set-7-tests.spec.ts
│   ├── multiparty-conference-set-8-tests.spec.ts
│   └── multiparty-conference-set-9-tests.spec.ts
├── tests/
│   ├── digital-incoming-task-and-task-controls.spec.ts
│   ├── incoming-task-and-controls-multi-session.spec.ts
│   ├── station-login-test.spec.ts
│   ├── user-state-test.spec.ts
│   ├── incoming-telephony-task-test.spec.ts
│   ├── basic-task-controls-test.spec.ts
│   ├── advanced-task-controls-test.spec.ts
│   ├── advance-task-control-combinations-test.spec.ts
│   ├── dial-number-task-control-test.spec.ts
│   ├── tasklist-test.spec.ts
│   ├── multiparty-conference-set-7-test.spec.ts
│   ├── multiparty-conference-set-8-test.spec.ts
│   └── multiparty-conference-set-9-test.spec.ts
├── Utils/
│   ├── controlUtils.ts
│   ├── initUtils.ts
│   ├── helperUtils.ts
│   ├── incomingTaskUtils.ts
│   ├── stationLoginUtils.ts
│   ├── userStateUtils.ts
│   ├── taskControlUtils.ts
│   ├── advancedTaskControlUtils.ts
│   └── wrapupUtils.ts
├── test-manager.ts
├── test-data.ts
├── constants.ts
├── global.setup.ts
└── ai-docs/
    ├── AGENTS.md
    └── ARCHITECTURE.md
```

Keep this section aligned to real repository contents.

---

## Set -> Suite -> Test Mapping

| Set     | Suite File (`TEST_SUITE`)                    | Test Files Imported By Suite                                                                    |
| ------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `SET_1` | `digital-incoming-task-tests.spec.ts`        | `digital-incoming-task-and-task-controls.spec.ts`, `dial-number-task-control-test.spec.ts`      |
| `SET_2` | `task-list-multi-session-tests.spec.ts`      | `incoming-task-and-controls-multi-session.spec.ts`, `tasklist-test.spec.ts`                     |
| `SET_3` | `station-login-user-state-tests.spec.ts`     | `station-login-test.spec.ts`, `user-state-test.spec.ts`, `incoming-telephony-task-test.spec.ts` |
| `SET_4` | `basic-advanced-task-controls-tests.spec.ts` | `basic-task-controls-test.spec.ts`, `advance-task-control-combinations-test.spec.ts`            |
| `SET_5` | `advanced-task-controls-tests.spec.ts`       | `advanced-task-controls-test.spec.ts`                                                           |
| `SET_6` | `dial-number-tests.spec.ts`                  | `dial-number-task-control-test.spec.ts`                                                         |
| `SET_7` | `multiparty-conference-set-7-tests.spec.ts`  | `multiparty-conference-set-7-test.spec.ts`                                                      |
| `SET_8` | `multiparty-conference-set-8-tests.spec.ts`  | `multiparty-conference-set-8-test.spec.ts`                                                      |
| `SET_9` | `multiparty-conference-set-9-tests.spec.ts`  | `multiparty-conference-set-9-test.spec.ts`                                                      |

Use this mapping to decide where new tests should be added and wired.

Conference scenario consolidation is implemented inside the SET_7/SET_8/SET_9 test files to reduce repeated call setup while preserving scenario ID traceability in test titles.

---

## Dynamic Project Generation

`playwright.config.ts` creates Playwright projects from `USER_SETS`:

- Project name: set key (`SET_X`)
- Suite binding: `testMatch = **/suites/${TEST_SUITE}`
- Worker count: `Object.keys(USER_SETS).length`
- Global timeout: `180000`
- Per-project retries: `1`

Any set added to `USER_SETS` becomes runnable through this model.

### System Under Test

The E2E tests validate Contact Center widgets running in `samples-cc-react-app` served at `https://localhost:8000/samples/contact-center/`.

`playwright.config.ts` boots the app using:

```typescript
webServer: {
  command: 'yarn samples:serve --port 8000',
  url: 'https://localhost:8000/samples/contact-center/',
}
```

Each generated set project uses Chrome launch flags required for telephony/WebRTC automation:

- `--use-fake-ui-for-media-stream`
- `--use-fake-device-for-media-stream`
- `--use-file-for-fake-audio-capture=<repo>/playwright/wav/dummyAudio.wav`
- `--remote-debugging-port=${9221 + index}` (unique port per set)

These flags are part of baseline runtime behavior and should be preserved unless intentionally changed.

---

## Runtime Data Flow

`global.setup.ts`:

1. Expands `USER_SETS` into set-scoped env keys (`<SET>_...`)
2. Builds OAuth groups dynamically from `USER_SETS` with group size `2` and runs them in parallel.
   Each group uses batch size 4 internally (`OAUTH_BATCH_SIZE=4`).
   With current `SET_1..SET_9`, this resolves to 5 groups:
   - `[SET_1, SET_2]`
   - `[SET_3, SET_4]`
   - `[SET_5, SET_6]`
   - `[SET_7, SET_8]`
   - `[SET_9]`
3. Optionally fetches dial-number OAuth token
4. Performs one final `.env` upsert in the same OAuth setup run

Test files:

1. Read Playwright project name via `test.info().project.name`
2. Instantiate `new TestManager(projectName)`

`test-manager.ts`:

1. Receives the set key via constructor (`projectName`)
2. Resolves set-scoped env values using that project key
3. Creates required contexts/pages and performs login/widget initialization
4. Handles soft cleanup (`softCleanup`) and full cleanup (`cleanup`)

---

## TestManager

`TestManager` is the setup/teardown orchestrator used across suites.

### Constructor

```typescript
new TestManager(projectName: string, maxRetries?: number)
```

- `projectName`: set key (for example, `SET_1`) used to resolve env values like `${projectName}_AGENT1_ACCESS_TOKEN`
- `maxRetries`: optional retry count (default from `DEFAULT_MAX_RETRIES`)

### SetupConfig (Universal setup)

`setup(browser, config)` accepts:

```typescript
interface SetupConfig {
  needsAgent1?: boolean; // default: true
  needsAgent2?: boolean; // default: false
  needsCaller?: boolean; // default: false
  needsExtension?: boolean; // default: false
  needsChat?: boolean; // default: false
  needsMultiSession?: boolean; // default: false
  agent1LoginMode?: LoginMode; // default: LOGIN_MODE.DESKTOP
  enableConsoleLogging?: boolean; // default: true
  enableAdvancedLogging?: boolean; // default: false
  needDialNumberLogin?: boolean; // default: false
}
```

### Page Properties

When enabled by setup config/method, these page properties are created and available:

- `agent1Page`
- `agent2Page`
- `agent3Page` (conference sets only)
- `agent4Page` (conference sets only)
- `callerPage`
- `agent1ExtensionPage`
- `chatPage`
- `multiSessionAgent1Page`
- `dialNumberPage`

### Universal Setup Flow (3 phases)

`setup()` runs a three-phase flow:

1. Create required browser contexts/pages in parallel (`createContextsForConfig`)
2. Run independent login + widget setup in parallel (`createSetupPromises` + optional multi-session flow)
3. Register console logging handlers (`setupConsoleLogging`)

### Convenience Methods

| Method                               | Behavior                                                                                                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `basicSetup()`                       | Calls `setup()` with desktop agent1 defaults                                                                                                                                                         |
| `setupForAdvancedTaskControls()`     | Calls `setup()` with agent1+agent2+caller+extension and advanced logging                                                                                                                             |
| `setupForAdvancedCombinations()`     | Calls `setup()` with agent1+agent2+caller and advanced logging                                                                                                                                       |
| `setupForDialNumber()`               | Calls `setup()` with dial-number login enabled                                                                                                                                                       |
| `setupForIncomingTaskDesktop()`      | Calls `setup()` for desktop incoming-task flow                                                                                                                                                       |
| `setupForIncomingTaskExtension()`    | Calls `setup()` for extension incoming-task flow                                                                                                                                                     |
| `setupForIncomingTaskMultiSession()` | Calls `setup()` for multi-session incoming-task flow                                                                                                                                                 |
| `setupForStationLogin()`             | Custom path (does not call `setup()`), purpose-built station-login + multi-login bootstrap. Station-login page initialization runs sequentially (main then multi-session) to reduce init contention. |
| `setupForMultipartyConference()`     | Sets up 4 agents + caller for conference tests (agent1–4 pages + callerPage)                                                                                                                         |
| `setupMultiSessionPage()`            | Targeted helper to initialize only multi-session page when needed                                                                                                                                    |

### Cleanup

- `softCleanup()`:
  - Handles stray tasks only (`handleStrayTasks`)
  - Covers `agent1Page`, `multiSessionAgent1Page`, `agent2Page`, `agent3Page`, `agent4Page`, and `callerPage`
  - Uses best-effort timeout guards so one stuck page does not block suite teardown
  - Intended for between-file cleanup via `afterAll`
- `cleanup()`:
  - Runs `softCleanup()` first
  - Performs station logout where applicable (including `multiSessionAgent1Page`)
  - Uses best-effort timeout guards for logout operations
  - Waits for post-logout settle (`login-button` visible + unregister settle timeout) before closing contexts
  - Closes all created pages/contexts
  - Intended for end-of-suite full cleanup

---

## Utils Reference

| File                          | Key Exports                                                                                                                                                                                                                                                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `initUtils.ts`                | `loginViaAccessToken`, `oauthLogin`, `enableAllWidgets`, `enableMultiLogin`, `initialiseWidgets`, `agentRelogin`, `setupMultiLoginPage`                                                                                                                       | Auth/bootstrap/widget init helpers                                                                                                                                                                                                                                                                                                                                                                                                        |
| `stationLoginUtils.ts`        | `desktopLogin`, `extensionLogin`, `dialLogin`, `telephonyLogin`, `stationLogout`, `verifyLoginMode`, `ensureUserStateVisible`                                                                                                                                 | Station login/logout validation for Desktop/Extension/Dial Number                                                                                                                                                                                                                                                                                                                                                                         |
| `userStateUtils.ts`           | `changeUserState`, `getCurrentState`, `verifyCurrentState`, `getStateElapsedTime`, `validateConsoleStateChange`, `checkCallbackSequence`                                                                                                                      | User-state actions and console/state validation                                                                                                                                                                                                                                                                                                                                                                                           |
| `controlUtils.ts`             | `findFirstVisibleControlIndex`, `findFirstVisibleEnabledControlIndex`, `hasAnyVisibleControl`, `hasAnyVisibleEnabledControl`, `clickFirstVisibleEnabledControl`                                                                                                  | Shared control scanning/click helpers for duplicated call-control groups across task, conference, and advanced consult flows.                                                                                                                                                                                                                                                                                                             |
| `taskControlUtils.ts`         | `holdCallToggle`, `recordCallToggle`, `isCallHeld`, `endTask`, `verifyHoldTimer`, `verifyHoldButtonIcon`, `verifyRecordButtonIcon`, `setupConsoleLogging`, `verifyHoldLogs`, `verifyRecordingLogs`, `verifyEndLogs`, `verifyRemoteAudioTracks`               | Basic call control actions + callback/event log assertions. `endTask` now stays generic and assumes the caller has already restored the page to a normal endable state.                                                                                                                                                                                                                                                                  |
| `advancedTaskControlUtils.ts` | `consultOrTransfer`, `cancelConsult`, `waitForPrimaryCallAfterConsult`, `setupAdvancedConsoleLogging`, `verifyTransferSuccessLogs`, `verifyConsultStartSuccessLogs`, `verifyConsultEndSuccessLogs`, `verifyConsultTransferredLogs`, `ACTIVE_CONSULT_CONTROL_TEST_IDS` | Consult/transfer operations + advanced callback/event log assertions. Includes consult-state polling and post-consult primary-call restoration before generic end-task operations.                                                                                                                                                                                                                                                       |
| `incomingTaskUtils.ts`        | `createCallTask`, `createChatTask`, `createEmailTask`, `waitForIncomingTask`, `acceptIncomingTask`, `declineIncomingTask`, `acceptExtensionCall`, `loginExtension`, `submitRonaPopup`                                                                         | Incoming task creation/acceptance/decline and extension helpers                                                                                                                                                                                                                                                                                                                                                                           |
| `wrapupUtils.ts`              | `submitWrapup`                                                                                                                                                                                                                                                | Wrapup submission                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `helperUtils.ts`              | `handleStrayTasks`, `pageSetup`, `waitForState`, `waitForStateLogs`, `waitForWebSocketDisconnection`, `waitForWebSocketReconnection`, `clearPendingCallAndWrapup`, `dismissOverlays`                                                                          | Shared setup/cleanup/state polling/network-watch helpers. `waitForState` polls visible state text (`state-name`) to align with `verifyCurrentState`. `pageSetup` includes one bounded station logout/re-login recovery if `state-select` is still missing after login. `handleStrayTasks` handles exit-conference, dual call control groups (iterates all end-call buttons to find enabled one), cancel-consult with switch-leg fallback. |
| `conferenceUtils.ts`          | `cleanupConferenceState`, `startBaselineCallOnAgent1`, `consultAgentAndAcceptCall`, `consultQueueAndAcceptCall`, `mergeConsultIntoConference`, `transferConsultAndSubmitWrapup`, `toggleConferenceLegIfSwitchAvailable`, `exitConferenceParticipantAndWrapup`, `endConferenceTaskAndWrapup` | Shared conference helpers used by Set 7, Set 8, and Set 9 to keep call setup/cleanup and consult-transfer flows consistent and reusable. Conference callers now choose explicit exit-vs-end behavior instead of using one mixed helper.                                                                                                                                                                                              |

Use existing helpers first; add new utilities only when behavior is not already covered.

---

## Constants Reference

### Key Enums/Objects

| Constant           | Values (Current)                                                                     | Used For                              |
| ------------------ | ------------------------------------------------------------------------------------ | ------------------------------------- |
| `USER_STATES`      | `MEETING`, `AVAILABLE`, `LUNCH` (`Lunch Break`), `RONA`, `ENGAGED`, `AGENT_DECLINED` | Agent state change/validation         |
| `LOGIN_MODE`       | `DESKTOP` (`Desktop`), `EXTENSION` (`Extension`), `DIAL_NUMBER` (`Dial Number`)      | Station login mode selection          |
| `PAGE_TYPES`       | `AGENT1`, `AGENT2`, `CALLER`, `EXTENSION`, `CHAT`, `MULTI_SESSION`, `DIAL_NUMBER`    | TestManager page/context identity     |
| `TASK_TYPES`       | `CALL`, `CHAT`, `EMAIL`, `SOCIAL`                                                    | Incoming task typing                  |
| `WRAPUP_REASONS`   | `SALE`, `RESOLVED`                                                                   | Wrapup flow                           |
| `RONA_OPTIONS`     | `AVAILABLE`, `IDLE`                                                                  | RONA popup next-state selection       |
| `CONSOLE_PATTERNS` | `SDK_STATE_CHANGE_SUCCESS`, `ON_STATE_CHANGE_REGEX`, `ON_STATE_CHANGE_KEYWORDS`      | State-change console pattern matching |

### Timeout Hierarchy

| Constant                                   | Value      | Typical Use                                                         |
| ------------------------------------------ | ---------- | ------------------------------------------------------------------- |
| `DROPDOWN_SETTLE_TIMEOUT`                  | `200` ms   | Dropdown animation settle                                           |
| `UI_SETTLE_TIMEOUT`                        | `2000` ms  | Generic UI settle                                                   |
| `DEFAULT_TIMEOUT`                          | `5000` ms  | Default visibility/check timeout                                    |
| `AWAIT_TIMEOUT`                            | `10000` ms | Standard element interactions                                       |
| `WRAPUP_TIMEOUT`                           | `15000` ms | Wrapup UI timing                                                    |
| `FORM_FIELD_TIMEOUT`                       | `20000` ms | Popover/form field loading                                          |
| `OPERATION_TIMEOUT`                        | `30000` ms | Longer user operations (for example logout checks)                  |
| `STATION_LOGOUT_UNREGISTER_SETTLE_TIMEOUT` | `4000` ms  | Post-logout wait for backend unregister to settle before next login |
| `EXTENSION_REGISTRATION_TIMEOUT`           | `40000` ms | Extension registration waits                                        |
| `NETWORK_OPERATION_TIMEOUT`                | `40000` ms | Network-dependent operations                                        |
| `WIDGET_INIT_TIMEOUT`                      | `50000` ms | Widget initialization                                               |
| `CHAT_LAUNCHER_TIMEOUT`                    | `60000` ms | Chat launcher iframe loading                                        |
| `ACCEPT_TASK_TIMEOUT`                      | `60000` ms | Incoming-task acceptance waits                                      |
| `CONFERENCE_SWITCH_TOGGLE_TIMEOUT`         | `1000` ms  | Wait after switching conference call legs                           |
| `CONFERENCE_END_TASK_SETTLE_TIMEOUT`       | `1500` ms  | Wait after ending task in conference                                |
| `CONFERENCE_ACTION_SETTLE_TIMEOUT`         | `2000` ms  | Wait after conference merge/exit actions                            |
| `CONFERENCE_CUSTOMER_DISCONNECT_TIMEOUT`   | `3000` ms  | Wait for customer disconnect propagation                            |
| `CONFERENCE_RECONNECT_SETTLE_TIMEOUT`      | `4000` ms  | Wait after network reconnect in conference                          |
| `CONSULT_NO_ANSWER_TIMEOUT`                | `12000` ms | Wait for consult no-answer (RONA) scenario                          |

Choose the smallest fitting timeout and document reasons for any increases.

---

## Console Log Verification Pattern

Console log monitoring is a core assertion pattern in this framework.

### 1. Setup handlers

- Basic controls: `setupConsoleLogging(page)`
- Advanced controls: `setupAdvancedConsoleLogging(page)`

These register `page.on('console', ...)` handlers and capture only relevant SDK/callback log messages.

### 2. Captured event categories

Basic controls (`taskControlUtils.ts`):

- `WXCC_SDK_TASK_HOLD_SUCCESS` / `WXCC_SDK_TASK_RESUME_SUCCESS`
- `WXCC_SDK_TASK_PAUSE_RECORDING_SUCCESS` / `WXCC_SDK_TASK_RESUME_RECORDING_SUCCESS`
- `onHoldResume invoked` / `onRecordingToggle invoked` / `onEnd invoked`

Advanced controls (`advancedTaskControlUtils.ts`):

- `WXCC_SDK_TASK_TRANSFER_SUCCESS`
- `WXCC_SDK_TASK_CONSULT_START_SUCCESS`
- `WXCC_SDK_TASK_CONSULT_END_SUCCESS`
- `AgentConsultTransferred`
- `onTransfer invoked` / `onConsult invoked` / `onEnd invoked`

State changes (`userStateUtils.ts` + `constants.ts`):

- `WXCC_SDK_AGENT_STATE_CHANGE_SUCCESS`
- `onStateChange invoked with state name: <stateName>`

### 3. Verification helpers

- Basic: `verifyHoldLogs`, `verifyRecordingLogs`, `verifyEndLogs`
- Advanced: `verifyTransferSuccessLogs`, `verifyConsultStartSuccessLogs`, `verifyConsultEndSuccessLogs`, `verifyConsultTransferredLogs`
- State: `validateConsoleStateChange`, `checkCallbackSequence`

### 4. Sequence validation

`checkCallbackSequence()` verifies ordering for state changes:

1. SDK success log is present
2. `onStateChange` callback log is present
3. Callback occurs after SDK success
4. Logged state value matches expected state

Use this pattern when assertions depend on callback/API event ordering.

---

## Extension Points

When adding a scenario family or changing framework behavior, update in this order:

1. `playwright/tests/*.spec.ts` (test factory logic)
2. `playwright/suites/*.spec.ts` (suite composition)
3. `playwright/test-data.ts` (set mapping + set data)
4. `playwright/test-manager.ts` and/or `playwright/Utils/*.ts` (shared setup/ops)
5. `playwright/global.setup.ts` and/or `playwright.config.ts` (env/runtime)
6. `playwright/ai-docs/AGENTS.md` and this file to match final implementation

Do not document future files/sets before they exist in code.

---

## Conference-Specific Patterns

### handleStrayTasks cleanup order for conference state

`handleStrayTasks` handles conference teardown in this priority:

1. Exit-conference button → click → check wrapup → submit if visible
2. End-call button → iterate all instances to find enabled one (conference pages render dual control groups: simple + CAD)
3. Cancel-consult → if end-call is disabled, try cancel-consult; if not visible, switch leg first via `switchToMainCall-consult-btn`
4. Resume from hold → if end-call still disabled after cancel-consult attempts

### Queue routing constraint

Queue routing will **not** re-route to an agent who RONA'd (Ring On No Answer) in the same call session. When designing tests that share a queue across scenarios, use different agents for queue-routed consults after a RONA test.

### Conference State Cleanup

Conference suites use guarded cleanup wrappers (`cleanupConferencePageWithTimeout`) with closed-page checks and per-page timeout limits. For shared-call conference flows, cleanup runs sequentially across agents to avoid ownership/leg race conditions; each task remains best-effort to avoid failing hooks when teardown has already started.

### Agent popover propagation

After setting an agent to Available, the agent may not immediately appear in the consult/transfer popover. `performAgentSelection` retries up to 3 times — closing and reopening the popover to force a fresh agent list fetch from the backend.

Conference helpers should verify target-agent state is `Available` before opening consult/transfer popovers, and verify consult control visibility/enabled state on the source agent before launching consult.

After transferring a consult lobby leg, participant states can settle asynchronously. Tests should wait for `Engaged` via state polling before strict equality assertions.

### resetCallerPage workaround

After a call ends, the Make Call button on the caller page may stay disabled. Clicking `#sd-get-media-streams` re-enables it. This is a known workaround (marked with TODO).

---

## Stability Principles

- Prefer explicit state assertions over blind waits
- Fix root causes before increasing timeouts
- Keep setup and cleanup deterministic
- Reuse existing utilities to avoid divergent selectors/flows
- Keep tests independently runnable by set/suite
- For mixed incoming digital load, create and accept tasks sequentially (not burst `Promise.all`) to reduce avoidable RONA transitions
- For parallel set execution, pre-start the web server to avoid port 3000 race conditions

---

## Related

- Workflow/runbook: [./AGENTS.md](./AGENTS.md)
- Framework overview: [../README.md](../README.md)
- Playwright templates: [../../ai-docs/templates/playwright/00-master.md](../../ai-docs/templates/playwright/00-master.md)

---

_Last Updated: 2026-03-09_
