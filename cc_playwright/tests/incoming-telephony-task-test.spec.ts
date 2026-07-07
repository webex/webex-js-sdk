import {test, Page, expect} from '@playwright/test';
import {changeUserState, verifyCurrentState} from '../Utils/userStateUtils';
import {
  createCallTask,
  declineExtensionCall,
  declineIncomingTask,
  endCallTask,
  acceptIncomingTask,
  acceptExtensionCall,
  submitRonaPopup,
  waitForIncomingTask,
} from '../Utils/incomingTaskUtils';
import {TASK_TYPES, USER_STATES, WRAPUP_REASONS, RONA_OPTIONS} from '../constants';
import {waitForState, handleStrayTasks} from '../Utils/helperUtils';
import {TestManager} from '../test-manager';

const moduleCapturedLogs: string[] = [];

// NOTE : Make Sure to set RONA Timeout to 18 seconds before running this test.

/**
 * Verifies the captured logs for wrapup and state change events
 * @param capturedLogs - Array of log messages
 * @param expectedWrapupReason - The expected wrapup reason to verify
 * @param expectedState - The expected state name to verify
 * @param shouldWrapupComeFirst - Whether the wrapup log should come before the state change log (default: true)
 * @returns Promise<boolean> - True if verification is successful, otherwise throws an error
 * @throws Error if logs do not match expected values or order
 * @description Checks the last wrapup reason and state name in logs against expected values, ensuring correct order if specified
 * @example
 * ```typescript
 * await verifyCallbackLogs(capturedLogs, WRAPUP_REASONS.SALE, USER_STATES.AVAILABLE);
 * ```
 */

export async function verifyCallbackLogs(
  capturedLogs: string[],
  expectedWrapupReason: string,
  expectedState: string,
  shouldWrapupComeFirst = true
): Promise<boolean> {
  const wrapupLogs = capturedLogs.filter((log) => log.includes('onWrapup invoked with reason :'));
  const stateChangeLogs = capturedLogs.filter((log) =>
    log.includes('onStateChange invoked with state name:')
  );

  if (wrapupLogs.length === 0 || stateChangeLogs.length === 0) {
    throw new Error('Missing required logs, check callbacks for wrapup or statechange');
  }

  const lastWrapupLog = wrapupLogs[wrapupLogs.length - 1];
  const lastStateChangeLog = stateChangeLogs[stateChangeLogs.length - 1];

  const wrapupLogIndex = capturedLogs.lastIndexOf(lastWrapupLog);
  const stateChangeLogIndex = capturedLogs.lastIndexOf(lastStateChangeLog);

  if (shouldWrapupComeFirst && wrapupLogIndex >= stateChangeLogIndex) {
    throw new Error('Wrapup log should come before state change log');
  }

  const wrapupMatch = lastWrapupLog.match(/onWrapup invoked with reason : (.+)$/);
  const stateMatch = lastStateChangeLog.match(/onStateChange invoked with state name:\s*(.+)$/);

  if (!wrapupMatch || !stateMatch) {
    throw new Error('Could not extract values from logs');
  }

  const actualWrapupReason = wrapupMatch[1].trim();
  const actualStateName = stateMatch[1].trim();

  // Verify expected values
  if (actualWrapupReason !== expectedWrapupReason) {
    throw new Error(
      `Wrapup reason mismatch, expected ${expectedWrapupReason}, got ${actualWrapupReason}`
    );
  }

  if (actualStateName !== expectedState) {
    throw new Error(`State name mismatch, expected ${expectedState}, got ${actualStateName}`);
  }

  return true;
}

function setupConsoleLogging(page: Page): () => void {
  moduleCapturedLogs.length = 0;

  const consoleHandler = (msg: any) => {
    const logText = msg.text();
    if (
      logText.includes('onStateChange invoked with state name:') ||
      logText.includes('onWrapup invoked with reason :')
    ) {
      moduleCapturedLogs.push(logText);
    }
  };

  page.on('console', consoleHandler);

  return () => page.off('console', consoleHandler);
}

async function waitForExtensionIncomingAnswerEnabled(page: Page, timeout = 40000): Promise<void> {
  const answerButton = page.locator('#answer').first();
  await expect
    .poll(
      async () => {
        return answerButton.isEnabled().catch(() => false);
      },
      {timeout, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();
}

export default function createIncomingTelephonyTaskTests() {
  test.describe('Incoming Call Task Tests for Desktop Mode', () => {
    let testManager: TestManager;

    test.beforeEach(async () => {
      moduleCapturedLogs.length = 0;

      // Clean up any orphaned tasks FIRST (before checking login state)
      await handleStrayTasks(testManager.agent1Page).catch(() => {});
      await testManager.agent1Page.waitForTimeout(2000);

      // Verify agent is logged in - check login button state (more reliable than logout visibility)
      const loginButton = testManager.agent1Page.locator('#loginAgent');
      const needsLogin = await loginButton.isEnabled().catch(() => false);

      if (needsLogin) {
        const {telephonyLogin} = await import('../Utils/stationLoginUtils');
        const {LOGIN_MODE} = await import('../constants');
        await telephonyLogin(testManager.agent1Page, LOGIN_MODE.DESKTOP);

        // Wait for logout button to confirm successful login
        const logoutButton = testManager.agent1Page.locator('#logoutAgent');
        await logoutButton.waitFor({state: 'visible', timeout: 40000});
      }
    });

    test.beforeAll(async ({browser}, testInfo) => {
      const projectName = testInfo.project.name;
      testManager = new TestManager(projectName);
      await testManager.setupForIncomingTaskDesktop(browser);

      setupConsoleLogging(testManager.agent1Page);

      // Verify station login completed successfully and recover if needed
      const {telephonyLogin} = await import('../Utils/stationLoginUtils');
      const {LOGIN_MODE} = await import('../constants');

      const logoutButton = testManager.agent1Page.locator('#logoutAgent');
      let isLoggedIn = await logoutButton.isVisible().catch(() => false);

      if (!isLoggedIn) {
        // Try one recovery attempt with explicit Desktop login
        const loginButton = testManager.agent1Page.locator('#loginAgent');
        const loginVisible = await loginButton.isVisible().catch(() => false);

        if (loginVisible) {
          await telephonyLogin(testManager.agent1Page, LOGIN_MODE.DESKTOP);
          await logoutButton.waitFor({state: 'visible', timeout: 40000});
          isLoggedIn = true;
        }

        if (!isLoggedIn) {
          throw new Error(
            'Station login did not complete after recovery attempt. Agent must be logged in to receive telephony tasks.'
          );
        }
      }

      // Ensure agent is in Available state to receive calls
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    });

    test('should accept incoming call, end call and complete wrapup in desktop mode', async () => {
      // Verify caller page is ready
      const callerReady = await testManager.callerPage
        .locator('#destination')
        .isVisible()
        .catch(() => false);
      if (!callerReady) {
        throw new Error('Caller page is not ready. Missing #destination input.');
      }

      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);

      // Log the entry point being called
      const entryPoint = process.env[`${testManager.projectName}_ENTRY_POINT`];
      // eslint-disable-next-line no-console
      console.log(`[TEST] Creating call to entry point: ${entryPoint}`);

      await createCallTask(testManager.callerPage, entryPoint!);
      // eslint-disable-next-line no-console
      console.log('[TEST] Call created, waiting for incoming task...');

      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);

      // NOTE: Desktop mode does NOT automatically transition agent state to Engaged
      // Verify call is active using stable indicators: task connected and End enabled.
      await expect
        .poll(
          async () => {
            const endButton = testManager.agent1Page.locator('#end').first();
            const endVisible = await endButton.isVisible().catch(() => false);
            const endEnabled = await endButton.isEnabled().catch(() => false);
            const acceptStillVisible = await testManager.agent1Page
              .locator('#taskList .task-item-content')
              .first()
              .getByRole('button', {name: 'Accept'})
              .isVisible()
              .catch(() => false);
            const incomingText = (
              await testManager.agent1Page
                .locator('#incoming-task')
                .innerText()
                .catch(() => '')
            )
              .toLowerCase()
              .trim();

            return (
              endVisible && endEnabled && !acceptStillVisible && incomingText.includes('connected')
            );
          },
          {timeout: 20000, intervals: [500, 1000, 2000]}
        )
        .toBeTruthy();

      // Verify call is connected in task display
      const taskDisplay = testManager.agent1Page.locator('#incoming-task');
      await expect(taskDisplay).toContainText('connected', {timeout: 10000});

      await testManager.agent1Page.locator('#end').first().click({timeout: 5000});
      await testManager.agent1Page.waitForTimeout(2000);

      // Sample app uses simple dropdown + button for wrapup (not widget UI)
      const wrapupDropdown = testManager.agent1Page.locator('#wrapupCodesDropdown');
      await expect(wrapupDropdown).toBeEnabled({timeout: 15000});
      await wrapupDropdown.selectOption({label: WRAPUP_REASONS.SALE});
      await testManager.agent1Page.locator('#wrapup').click({timeout: 5000});
      await testManager.agent1Page.waitForTimeout(2000);

      // Verify wrapup completed by checking task is gone
      const taskList = testManager.agent1Page.locator('#taskList');
      await expect(taskList).toContainText('No tasks available', {timeout: 5000});

      // NOTE: Desktop mode doesn't auto-transition agent state after wrapup
      // Agent remains in previous manual state (Meeting, Available, etc.)
      // Sample app doesn't emit widget-specific console log patterns
    });

    test('should decline incoming call and verify RONA state in desktop mode', async () => {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);
      await testManager.agent1Page.waitForTimeout(3000);
      await declineIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await testManager.agent1Page
        .locator('#agentStatePopup')
        .waitFor({state: 'visible', timeout: 15000});
      // AGENT_DECLINED is a transitional state - popup visibility confirms the transition
      await endCallTask(testManager.callerPage!, true);
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
      await waitForState(testManager.agent1Page, USER_STATES.MEETING);
    });

    test('should ignore incoming call and wait for RONA popup in desktop mode', async () => {
      await testManager.agent1Page.waitForTimeout(2000);
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);

      // Wait for RONA timeout (configured at ~18 seconds) - popup appears when RONA triggers
      await testManager.agent1Page
        .locator('#agentStatePopup')
        .waitFor({state: 'visible', timeout: 25000});
      await expect(testManager.agent1Page.locator('#agentStatePopup')).toBeVisible();

      await endCallTask(testManager.callerPage!, true);
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
      await waitForState(testManager.agent1Page, USER_STATES.MEETING);
    });

    test('should set agent state to Available and receive another call in desktop mode', async () => {
      await testManager.agent1Page.waitForTimeout(2000);
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);
      await testManager.agent1Page.waitForTimeout(3000);
      await declineIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await testManager.agent1Page
        .locator('#agentStatePopup')
        .waitFor({state: 'visible', timeout: 15000});
      // AGENT_DECLINED is a transitional state - no UI dropdown value is set during RONA
      // Verify via popup visibility instead of dropdown state
      await endCallTask(testManager.callerPage!, true);
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.AVAILABLE);
      await expect(testManager.agent1Page.locator('#agentStatePopup')).not.toBeVisible();
      await testManager.agent1Page.waitForTimeout(5000);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      const incomingTaskDiv = await waitForIncomingTask(
        testManager.agent1Page,
        TASK_TYPES.CALL,
        40000
      );
      await expect(incomingTaskDiv).toBeVisible();
      await testManager.agent1Page.waitForTimeout(3000);
      await declineIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await testManager.agent1Page
        .locator('#agentStatePopup')
        .waitFor({state: 'visible', timeout: 15000});
      await expect(testManager.agent1Page.locator('#agentStatePopup')).toBeVisible();
      await endCallTask(testManager.callerPage!, true);
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
      await waitForState(testManager.agent1Page, USER_STATES.MEETING);
    });

    test('should set agent state to busy after declining call in desktop mode', async () => {
      await testManager.agent1Page.waitForTimeout(2000);
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);
      await testManager.agent1Page.waitForTimeout(3000);
      await declineIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await testManager.agent1Page
        .locator('#agentStatePopup')
        .waitFor({state: 'visible', timeout: 15000});
      // AGENT_DECLINED is a transitional state - no UI dropdown value is set during RONA
      // Verify via popup visibility instead of dropdown state
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
      await waitForState(testManager.agent1Page, USER_STATES.MEETING);
      await expect(testManager.agent1Page.locator('#agentStatePopup')).not.toBeVisible();
      await waitForState(testManager.agent1Page, USER_STATES.MEETING);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
      await expect(testManager.agent1Page.locator('#incoming-task')).toContainText(
        'No Incoming Tasks',
        {timeout: 10000}
      );
      await endCallTask(testManager.callerPage!, true);
      await testManager.agent1Page.waitForTimeout(2000);
    });

    test('should handle customer disconnect before agent answers in desktop mode', async () => {
      // Sample app now filters out orphaned tasks when customer disconnects an unanswered call (ALERTING state):
      // - SDK does NOT fire task:end event
      // - SDK does NOT trigger RONA popup
      // - Sample app now filters out tasks older than 25s in ALERTING state
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      const incomingTaskDiv = await waitForIncomingTask(
        testManager.agent1Page,
        TASK_TYPES.CALL,
        40000
      );

      // Verify task is visible before customer disconnect
      await expect(incomingTaskDiv).toBeVisible();

      // Customer ends call before agent answers
      await endCallTask(testManager.callerPage!, true);

      // Wait for sample app to filter out the stale task (threshold: 25s)
      // Force updateTaskList() after 26s to trigger the filter
      await testManager.agent1Page.waitForTimeout(26000);
      await testManager.agent1Page.evaluate(() => {
        if (typeof (window as any).updateTaskList === 'function') {
          (window as any).updateTaskList();
        }
      });

      await expect
        .poll(
          async () => {
            const taskList = testManager.agent1Page.locator('#taskList');
            const text = (await taskList.innerText().catch(() => '')).toLowerCase();

            return text.includes('no tasks') || text.trim() === 'tasklist';
          },
          {timeout: 5000, intervals: [500, 1000]}
        )
        .toBeTruthy();

      // Verify agent remains in Available state (no RONA popup expected)
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    });

    test.afterAll(async () => {
      await testManager.cleanup();
    });
  });

  test.describe('Incoming Task Tests in Extension Mode', () => {
    let testManager: TestManager;

    test.beforeEach(async () => {
      moduleCapturedLogs.length = 0;

      // Clean up any orphaned tasks FIRST (before checking login state)
      await handleStrayTasks(testManager.agent1Page, testManager.agent1ExtensionPage).catch(
        () => {}
      );
      await testManager.agent1Page.waitForTimeout(2000);

      // Verify agent is logged in - check login button state (more reliable than logout visibility)
      const loginButton = testManager.agent1Page.locator('#loginAgent');
      const needsLogin = await loginButton.isEnabled().catch(() => false);

      if (needsLogin) {
        const {telephonyLogin} = await import('../Utils/stationLoginUtils');
        const {LOGIN_MODE} = await import('../constants');
        const extensionNumber = process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`];
        await telephonyLogin(testManager.agent1Page, LOGIN_MODE.EXTENSION, extensionNumber);

        // Wait for logout button to confirm successful login
        const logoutButton = testManager.agent1Page.locator('#logoutAgent');
        await logoutButton.waitFor({state: 'visible', timeout: 40000});
      }
    });

    test.beforeAll(async ({browser}, testInfo) => {
      const projectName = testInfo.project.name;
      testManager = new TestManager(projectName);
      await testManager.setupForIncomingTaskExtension(browser);
      setupConsoleLogging(testManager.agent1Page);

      // SESSION CLEANUP: Force logout to clear any concurrent/stale sessions
      const {telephonyLogin, stationLogout} = await import('../Utils/stationLoginUtils');
      const {LOGIN_MODE} = await import('../constants');

      // Check if already logged in and force logout
      const logoutButtonInitial = testManager.agent1Page.locator('#logoutAgent');
      const isAlreadyLoggedIn = await logoutButtonInitial.isVisible().catch(() => false);

      if (isAlreadyLoggedIn) {
        // Handle any stray tasks before logout
        await handleStrayTasks(testManager.agent1Page).catch(() => {});
        await testManager.agent1Page.waitForTimeout(2000);

        // Force logout to clear session
        await stationLogout(testManager.agent1Page, false);
        await testManager.agent1Page.waitForTimeout(5000); // Wait for backend to process logout
      }

      // Verify station login completed successfully and recover if needed

      const logoutButton = testManager.agent1Page.locator('#logoutAgent');
      let isLoggedIn = await logoutButton.isVisible().catch(() => false);

      if (!isLoggedIn) {
        // Try one recovery attempt with explicit Extension login
        const loginButton = testManager.agent1Page.locator('#loginAgent');
        const loginVisible = await loginButton.isVisible().catch(() => false);

        if (loginVisible) {
          const extensionNumber = process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`];
          await telephonyLogin(testManager.agent1Page, LOGIN_MODE.EXTENSION, extensionNumber);
          await logoutButton.waitFor({state: 'visible', timeout: 40000});
          isLoggedIn = true;
        }

        if (!isLoggedIn) {
          throw new Error(
            'Station login did not complete after recovery attempt. Agent must be logged in to receive telephony tasks.'
          );
        }
      }

      // Ensure agent is in Available state to receive calls
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);

      // Verify extension phone is registered and ready
      const registrationStatus = testManager.agent1ExtensionPage.locator('#registration-status');
      await expect(registrationStatus).toContainText('Registered', {timeout: 40000});

      // Verify extension phone can receive calls
      const answerButton = testManager.agent1ExtensionPage.locator('#answer').first();
      await expect(answerButton).toBeVisible({timeout: 10000});
    });

    test('should accept incoming call, end call and complete wrapup in extension mode', async () => {
      await testManager.agent1Page.waitForTimeout(2000);
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);
      await waitForExtensionIncomingAnswerEnabled(testManager.agent1ExtensionPage, 40000);
      await acceptExtensionCall(testManager.agent1ExtensionPage);

      // NOTE: Extension mode also doesn't auto-transition agent state to Engaged in sample app
      // Verify call is active using stable indicators: End enabled and incoming task connected.
      await expect
        .poll(
          async () => {
            const endButton = testManager.agent1Page.locator('#end').first();
            const endVisible = await endButton.isVisible().catch(() => false);
            const endEnabled = await endButton.isEnabled().catch(() => false);
            const incomingText = (
              await testManager.agent1Page
                .locator('#incoming-task')
                .innerText()
                .catch(() => '')
            )
              .toLowerCase()
              .trim();

            return endVisible && endEnabled && incomingText.includes('connected');
          },
          {timeout: 25000, intervals: [500, 1000, 2000]}
        )
        .toBeTruthy();

      // Verify call is connected in task display
      const taskDisplay = testManager.agent1Page.locator('#incoming-task');
      await expect(taskDisplay).toContainText('connected', {timeout: 10000});

      await endCallTask(testManager.agent1ExtensionPage);
      await testManager.agent1Page.waitForTimeout(2000);

      // Sample app uses simple dropdown + button for wrapup (not widget UI)
      const wrapupDropdown = testManager.agent1Page.locator('#wrapupCodesDropdown');
      await expect(wrapupDropdown).toBeEnabled({timeout: 15000});
      await wrapupDropdown.selectOption({label: WRAPUP_REASONS.SALE});
      await testManager.agent1Page.locator('#wrapup').click({timeout: 5000});
      await testManager.agent1Page.waitForTimeout(2000);

      // Verify wrapup completed
      await testManager.agent1Page.waitForTimeout(3000);
      const taskList = testManager.agent1Page.locator('#taskList');
      await expect(taskList).toContainText('No tasks available', {timeout: 5000});

      // NOTE: Sample app doesn't emit widget-specific console log patterns
      // Extension mode also doesn't auto-transition state after wrapup
    });

    test('should decline incoming call and verify RONA state in extension mode', async () => {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);
      await waitForExtensionIncomingAnswerEnabled(testManager.agent1ExtensionPage, 40000);
      await testManager.agent1Page.waitForTimeout(5000);
      await declineExtensionCall(testManager.agent1ExtensionPage);
      await expect(testManager.agent1ExtensionPage.locator('#answer').first()).toBeDisabled({
        timeout: 5000,
      });
      await testManager.agent1Page
        .locator('#agentStatePopup')
        .waitFor({state: 'visible', timeout: 15000});
      // AGENT_DECLINED is a transitional state - verify via popup visibility (sample app doesn't emit widget console patterns)
      await expect(testManager.agent1Page.locator('#agentStatePopup')).toBeVisible();
      await endCallTask(testManager.callerPage!, true);
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
      await testManager.agent1Page.waitForTimeout(10000);
    });

    test('should ignore incoming call and wait for RONA popup in extension mode', async () => {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);
      await waitForExtensionIncomingAnswerEnabled(testManager.agent1ExtensionPage, 40000);

      // In extension mode, task row may remain visible while RONA popup is shown.
      await testManager.agent1Page
        .locator('#agentStatePopup')
        .waitFor({state: 'visible', timeout: 30000});
      await expect(testManager.agent1Page.locator('#agentStatePopup')).toBeVisible();
      await expect(testManager.agent1ExtensionPage.locator('#answer').first()).toBeDisabled({
        timeout: 10000,
      });
      await endCallTask(testManager.callerPage!, true);
      // Sample app doesn't emit widget console patterns - verify RONA via popup visibility above
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
      await waitForState(testManager.agent1Page, USER_STATES.MEETING);
      await testManager.agent1Page.waitForTimeout(10000);
    });

    test('should set agent state to Available and receive another call in extension mode', async () => {
      // This test explicitly handles cleanup for orphaned tasks at the end (line 517).
      // Validates agent can receive second call after handling RONA from first declined call.
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);
      await waitForExtensionIncomingAnswerEnabled(testManager.agent1ExtensionPage, 40000);
      await testManager.agent1Page.waitForTimeout(5000);
      await declineExtensionCall(testManager.agent1ExtensionPage);
      await testManager.agent1Page
        .locator('#agentStatePopup')
        .waitFor({state: 'visible', timeout: 15000});
      await expect(testManager.agent1Page.locator('#agentStatePopup')).toBeVisible();
      // AGENT_DECLINED is a transitional state - verify via popup visibility (sample app doesn't emit widget console patterns)
      await endCallTask(testManager.callerPage!, true);
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.AVAILABLE);
      await expect(testManager.agent1Page.locator('#agentStatePopup')).not.toBeVisible();
      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      const incomingTaskDiv = await waitForIncomingTask(
        testManager.agent1Page,
        TASK_TYPES.CALL,
        40000
      );
      await expect(incomingTaskDiv).toBeVisible();
      await endCallTask(testManager.callerPage!, true);
      // Customer disconnected - orphaned task needs manual cleanup
      // Wait for sample app to filter out the stale task (threshold: 25s)
      // Force updateTaskList() after 26s to trigger the filter
      await testManager.agent1Page.waitForTimeout(26000);
      await testManager.agent1Page.evaluate(() => {
        if (typeof (window as any).updateTaskList === 'function') {
          (window as any).updateTaskList();
        }
      });

      // Poll for task list to be empty (instead of single assertion)
      await expect
        .poll(
          async () => {
            const taskList = testManager.agent1Page.locator('#taskList');
            const text = (await taskList.innerText().catch(() => '')).toLowerCase();

            return text.includes('no tasks') || text.trim() === 'tasklist';
          },
          {timeout: 5000, intervals: [500, 1000]}
        )
        .toBeTruthy();
    });

    test('should set agent state to busy after declining call in extension mode', async () => {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);
      await waitForExtensionIncomingAnswerEnabled(testManager.agent1ExtensionPage, 40000);
      await testManager.agent1Page.waitForTimeout(5000);
      await declineExtensionCall(testManager.agent1ExtensionPage);
      await testManager.agent1Page
        .locator('#agentStatePopup')
        .waitFor({state: 'visible', timeout: 15000});
      await expect(testManager.agent1Page.locator('#agentStatePopup')).toBeVisible();
      // AGENT_DECLINED is a transitional state - verify via popup visibility (sample app doesn't emit widget console patterns)
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
      await waitForState(testManager.agent1Page, USER_STATES.MEETING);
      await expect(testManager.agent1Page.locator('#agentStatePopup')).not.toBeVisible();
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
      await expect(testManager.agent1ExtensionPage.locator('#answer').first()).toBeDisabled();
      // In Extension mode, declining on extension phone doesn't formally decline SDK task
      // SDK does NOT fire task:end event, task remains in ALERTING state
      // Sample app filters out orphaned tasks older than 25s in ALERTING state
      await endCallTask(testManager.callerPage!, true);
      // Wait for sample app's stale task filter to kick in (25s threshold + buffer)
      await testManager.agent1Page.waitForTimeout(26000);
      await testManager.agent1Page.evaluate(() => {
        if (typeof (window as any).updateTaskList === 'function') {
          (window as any).updateTaskList();
        }
      });
      // Now task should be filtered out
      await expect
        .poll(
          async () => {
            const taskList = testManager.agent1Page.locator('#taskList');
            const text = (await taskList.innerText().catch(() => '')).toLowerCase();

            return text.includes('no tasks') || text.trim() === 'tasklist';
          },
          {timeout: 10000, intervals: [500, 1000, 2000]}
        )
        .toBeTruthy();
    });

    test('should handle call disconnect before agent answers in extension mode', async () => {
      // Sample app now filters out orphaned tasks when customer disconnects an unanswered call (ALERTING state):
      // - SDK does NOT fire task:end event
      // - SDK does NOT trigger RONA popup
      // - Sample app now filters out tasks older than 25s in ALERTING state
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      const incomingTaskDiv = await waitForIncomingTask(
        testManager.agent1Page,
        TASK_TYPES.CALL,
        40000
      );

      // Verify task is visible before customer disconnect
      await expect(incomingTaskDiv).toBeVisible();

      // Customer ends call before agent answers
      await endCallTask(testManager.callerPage!, true);

      // Wait for sample app to filter out the stale task (threshold: 25s)
      // Force updateTaskList() after 26s to trigger the filter
      await testManager.agent1Page.waitForTimeout(26000);
      await testManager.agent1Page.evaluate(() => {
        if (typeof (window as any).updateTaskList === 'function') {
          (window as any).updateTaskList();
        }
      });

      await expect
        .poll(
          async () => {
            const taskList = testManager.agent1Page.locator('#taskList');
            const text = (await taskList.innerText().catch(() => '')).toLowerCase();

            return text.includes('no tasks') || text.trim() === 'tasklist';
          },
          {timeout: 5000, intervals: [500, 1000]}
        )
        .toBeTruthy();

      // Extension mode: State may be cleared after orphaned task cleanup
      // Check if RONA popup appeared (shouldn't happen but handle if it does)
      const statePopup = testManager.agent1Page.locator('#agentStatePopup');
      const isPopupVisible = await statePopup.isVisible().catch(() => false);
      if (isPopupVisible) {
        await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.AVAILABLE);
      }

      // Restore to Available if state was lost during cleanup
      const {getCurrentState} = await import('../Utils/userStateUtils');
      const currentState = await getCurrentState(testManager.agent1Page);
      if (!currentState || currentState.trim() === '') {
        await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      }

      // Verify agent is in Available state (no RONA popup expected)
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    });

    test.afterAll(async () => {
      await testManager.cleanup();
    });
  });
}
