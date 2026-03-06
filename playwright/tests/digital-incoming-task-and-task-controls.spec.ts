/* eslint-disable import/no-extraneous-dependencies, @typescript-eslint/no-non-null-assertion */
import {test, Page, expect} from '@playwright/test';
import {changeUserState, verifyCurrentState} from '../Utils/userStateUtils';
import {
  createCallTask,
  createChatTask,
  endChatTask,
  acceptIncomingTask,
  acceptExtensionCall,
  createEmailTask,
  submitRonaPopup,
  waitForIncomingTask,
} from '../Utils/incomingTaskUtils';
import {verifyTaskControls, endTask, verifyEndLogs} from '../Utils/taskControlUtils';
import {TASK_TYPES, USER_STATES, THEME_COLORS, WRAPUP_REASONS, RONA_OPTIONS} from '../constants';
import {submitWrapup} from '../Utils/wrapupUtils';
import {
  waitForState,
  waitForStateLogs,
  getLastStateFromLogs,
  waitForWrapupReasonLogs,
  getLastWrapupReasonFromLogs,
  isColorClose,
} from '../Utils/helperUtils';
import {TestManager} from '../test-manager';

const capturedLogs: string[] = [];

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
  // eslint-disable-next-line @typescript-eslint/no-shadow
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
  capturedLogs.length = 0;

  const consoleHandler = (msg) => {
    const logText = msg.text();
    if (
      logText.includes('onStateChange invoked with state name:') ||
      logText.includes('onWrapup invoked with reason :')
    ) {
      capturedLogs.push(logText);
    }
  };

  page.on('console', consoleHandler);

  return () => page.off('console', consoleHandler);
}

export default function createDigitalIncomingTaskAndTaskControlsTests() {
  let testManager: TestManager;

  test.beforeEach(() => {
    capturedLogs.length = 0;
  });

  test.beforeAll(async ({browser}, testInfo) => {
    const projectName = testInfo.project.name;
    testManager = new TestManager(projectName);
    await testManager.setupForIncomingTaskExtension(browser);
    setupConsoleLogging(testManager.agent1Page);
  });

  test.afterAll(async () => {
    if (testManager) {
      await testManager.cleanup();
    }
  });

  test('should ignore incoming chat task and wait for RONA popup', async () => {
    await createChatTask(testManager.chatPage, process.env[`${testManager.projectName}_CHAT_URL`]!);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    const incomingTaskDiv = await waitForIncomingTask(
      testManager.agent1Page,
      TASK_TYPES.CHAT,
      60000
    );
    await incomingTaskDiv.waitFor({state: 'hidden', timeout: 20000});
    await expect(incomingTaskDiv).toBeHidden();
    await testManager.agent1Page
      .getByTestId('samples:rona-popup')
      .waitFor({state: 'visible', timeout: 15000});
    await expect(testManager.agent1Page.getByTestId('samples:rona-popup')).toBeVisible();
    await verifyCurrentState(testManager.agent1Page, USER_STATES.RONA);
    await waitForStateLogs(capturedLogs, USER_STATES.RONA);
    expect(await getLastStateFromLogs(capturedLogs)).toBe(USER_STATES.RONA);
    await testManager.agent1Page.waitForTimeout(3000);
    const userStateElement = testManager.agent1Page.getByTestId('state-select');
    const userStateElementColor = await userStateElement.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(isColorClose(userStateElementColor, THEME_COLORS.RONA)).toBe(true);
    await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
    await waitForState(testManager.agent1Page, USER_STATES.MEETING);
  });

  test('should set agent to Available and verify chat task behavior', async () => {
    await testManager.agent1Page.waitForTimeout(2000);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    const incomingTaskDiv = testManager.agent1Page
      .getByTestId('samples:incoming-task-chat')
      .first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 60000});
    await incomingTaskDiv.waitFor({state: 'hidden', timeout: 30000});
    await expect(incomingTaskDiv).toBeHidden();
    await testManager.agent1Page
      .getByTestId('samples:rona-popup')
      .waitFor({state: 'visible', timeout: 15000});
    await expect(testManager.agent1Page.getByTestId('samples:rona-popup')).toBeVisible();
    await waitForState(testManager.agent1Page, USER_STATES.RONA);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.RONA);
    await waitForStateLogs(capturedLogs, USER_STATES.RONA);
    expect(await getLastStateFromLogs(capturedLogs)).toBe(USER_STATES.RONA);
    await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(2000);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await expect(testManager.agent1Page.getByTestId('samples:rona-popup')).not.toBeVisible();
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 10000});
    await expect(incomingTaskDiv).toBeVisible();
    await incomingTaskDiv.waitFor({state: 'hidden', timeout: 30000});
    await testManager.agent1Page
      .getByTestId('samples:rona-popup')
      .waitFor({state: 'visible', timeout: 15000});
    await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
    await waitForState(testManager.agent1Page, USER_STATES.MEETING);
  });

  test('should set agent state to busy after ignoring chat task', async () => {
    await testManager.agent1Page.waitForTimeout(2000);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    const incomingTaskDiv = testManager.agent1Page
      .getByTestId('samples:incoming-task-chat')
      .first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 60000});
    await incomingTaskDiv.waitFor({state: 'hidden', timeout: 30000});
    await expect(incomingTaskDiv).toBeHidden();
    await testManager.agent1Page
      .getByTestId('samples:rona-popup')
      .waitFor({state: 'visible', timeout: 15000});
    await expect(testManager.agent1Page.getByTestId('samples:rona-popup')).toBeVisible();
    await verifyCurrentState(testManager.agent1Page, USER_STATES.RONA);
    await waitForStateLogs(capturedLogs, USER_STATES.RONA);
    expect(await getLastStateFromLogs(capturedLogs)).toBe(USER_STATES.RONA);
    await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
    await waitForState(testManager.agent1Page, USER_STATES.MEETING);
    await expect(testManager.agent1Page.getByTestId('samples:rona-popup')).not.toBeVisible();
    await testManager.agent1Page.waitForTimeout(3000);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
  });

  test('should accept incoming chat, end chat and complete wrapup with callback verification', async () => {
    await testManager.agent1Page.waitForTimeout(2000);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    const incomingTaskDiv = testManager.agent1Page
      .getByTestId('samples:incoming-task-chat')
      .first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 60000});
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CHAT);
    await waitForState(testManager.agent1Page, USER_STATES.ENGAGED);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);
    await testManager.agent1Page.waitForTimeout(3000);
    const userStateElement = testManager.agent1Page.getByTestId('state-select');
    const userStateElementColor = await userStateElement.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(isColorClose(userStateElementColor, THEME_COLORS.ENGAGED)).toBe(true);
    await waitForStateLogs(capturedLogs, USER_STATES.ENGAGED);
    expect(await getLastStateFromLogs(capturedLogs)).toBe(USER_STATES.ENGAGED);
    await expect(testManager.agent1Page.getByTestId('call-control:end-call').first()).toBeVisible();
    await testManager.agent1Page
      .getByTestId('call-control:end-call')
      .first()
      .click({timeout: 5000});
    await testManager.agent1Page.waitForTimeout(500);
    await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await waitForStateLogs(capturedLogs, USER_STATES.AVAILABLE);
    expect(await getLastStateFromLogs(capturedLogs)).toBe(USER_STATES.AVAILABLE);
    await waitForWrapupReasonLogs(capturedLogs, WRAPUP_REASONS.SALE);
    expect(await getLastWrapupReasonFromLogs(capturedLogs)).toBe(WRAPUP_REASONS.SALE);
    expect(await verifyCallbackLogs(capturedLogs, WRAPUP_REASONS.SALE, USER_STATES.AVAILABLE)).toBe(
      true
    );
  });

  test('should handle chat disconnect before agent answers', async () => {
    await createChatTask(testManager.chatPage, process.env[`${testManager.projectName}_CHAT_URL`]!);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    const incomingTaskDiv = testManager.agent1Page
      .getByTestId('samples:incoming-task-chat')
      .first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 60000});
    await endChatTask(testManager.chatPage);
    await incomingTaskDiv.waitFor({state: 'hidden', timeout: 30000});
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
  });

  test('should ignore incoming email task and wait for RONA popup and accept and wrapup', async () => {
    await createEmailTask(process.env[`${testManager.projectName}_EMAIL_ENTRY_POINT`]!);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    const incomingTaskDiv = testManager.agent1Page
      .getByTestId('samples:incoming-task-email')
      .first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 50000});
    await incomingTaskDiv.waitFor({state: 'hidden', timeout: 30000});
    await expect(incomingTaskDiv).toBeHidden();
    await waitForState(testManager.agent1Page, USER_STATES.RONA);
    await testManager.agent1Page
      .getByTestId('samples:rona-popup')
      .waitFor({state: 'visible', timeout: 15000});
    await testManager.agent1Page.waitForTimeout(3000);
    const userStateElement = testManager.agent1Page.getByTestId('state-select');
    const userStateElementColor = await userStateElement.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(isColorClose(userStateElementColor, THEME_COLORS.RONA)).toBe(true);
    await expect(testManager.agent1Page.getByTestId('samples:rona-popup')).toBeVisible();
    await verifyCurrentState(testManager.agent1Page, USER_STATES.RONA);
    await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.AVAILABLE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 10000});
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL);
    const endButton = testManager.agent1Page.getByTestId('call-control:end-call').first();
    await endButton.waitFor({state: 'visible', timeout: 7000});
    await endButton.click({timeout: 5000});
    await testManager.agent1Page.waitForTimeout(1000);
    await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await waitForStateLogs(capturedLogs, USER_STATES.AVAILABLE);
    expect(await getLastStateFromLogs(capturedLogs)).toBe(USER_STATES.AVAILABLE);
    await waitForWrapupReasonLogs(capturedLogs, WRAPUP_REASONS.SALE);
    expect(await getLastWrapupReasonFromLogs(capturedLogs)).toBe(WRAPUP_REASONS.SALE);
    expect(await verifyCallbackLogs(capturedLogs, WRAPUP_REASONS.SALE, USER_STATES.AVAILABLE)).toBe(
      true
    );
    await testManager.agent1Page.waitForTimeout(2000);
  });

  test('should set agent to Available and verify email task behavior', async () => {
    await createEmailTask(process.env[`${testManager.projectName}_EMAIL_ENTRY_POINT`]!);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    const incomingTaskDiv = testManager.agent1Page
      .getByTestId('samples:incoming-task-email')
      .first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 50000});
    await incomingTaskDiv.waitFor({state: 'hidden', timeout: 30000});
    await expect(incomingTaskDiv).toBeHidden();
    await testManager.agent1Page
      .getByTestId('samples:rona-popup')
      .waitFor({state: 'visible', timeout: 15000});
    await expect(testManager.agent1Page.getByTestId('samples:rona-popup')).toBeVisible();
    await verifyCurrentState(testManager.agent1Page, USER_STATES.RONA);
    await waitForStateLogs(capturedLogs, USER_STATES.RONA);
    expect(await getLastStateFromLogs(capturedLogs)).toBe(USER_STATES.RONA);
    await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.AVAILABLE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await expect(testManager.agent1Page.getByTestId('samples:rona-popup')).not.toBeVisible();
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 10000});
    await expect(incomingTaskDiv).toBeVisible();
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL);
    await testManager.agent1Page.waitForTimeout(1000);
    const endButton = testManager.agent1Page.getByTestId('call-control:end-call').first();
    await endButton.waitFor({state: 'visible', timeout: 12000});
    await endButton.click({timeout: 5000});
    await testManager.agent1Page.waitForTimeout(1000);
    await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(2000);
  });

  test('should set agent state to busy after ignoring email task', async () => {
    await createEmailTask(process.env[`${testManager.projectName}_EMAIL_ENTRY_POINT`]!);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    const incomingTaskDiv = testManager.agent1Page
      .getByTestId('samples:incoming-task-email')
      .first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 50000});
    await incomingTaskDiv.waitFor({state: 'hidden', timeout: 30000});
    await testManager.agent1Page
      .getByTestId('samples:rona-popup')
      .waitFor({state: 'visible', timeout: 15000});
    await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
    await waitForState(testManager.agent1Page, USER_STATES.MEETING);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
    await incomingTaskDiv.waitFor({state: 'hidden', timeout: 5000});
    await expect(incomingTaskDiv).toBeHidden();
    await testManager.agent1Page.waitForTimeout(2000);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 10000});
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL);
    await testManager.agent1Page.waitForTimeout(3000);
    await testManager.agent1Page
      .getByTestId('call-control:end-call')
      .first()
      .click({timeout: 5000});
    await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
  });

  test('should handle multiple incoming tasks with callback verifications', async () => {
    // First become available, then create tasks so they arrive fresh
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(1000);

    // Create call first and handle it before other tasks
    await createCallTask(
      testManager.callerPage,
      process.env[`${testManager.projectName}_ENTRY_POINT`]!
    );

    const incomingCallTaskDiv = testManager.agent1Page
      .getByTestId('samples:incoming-task-telephony')
      .first();
    const incomingChatTaskDiv = testManager.agent1Page
      .getByTestId('samples:incoming-task-chat')
      .first();
    const incomingEmailTaskDiv = testManager.agent1Page
      .getByTestId('samples:incoming-task-email')
      .first();

    await incomingCallTaskDiv.waitFor({state: 'visible', timeout: 40000});
    await acceptExtensionCall(testManager.agent1ExtensionPage);
    await testManager.agent1Page.waitForTimeout(3000);

    // Now create chat and email tasks
    await Promise.all([
      createChatTask(testManager.chatPage, process.env[`${testManager.projectName}_CHAT_URL`]!),
      createEmailTask(process.env[`${testManager.projectName}_EMAIL_ENTRY_POINT`]!),
    ]);
    await incomingChatTaskDiv.waitFor({state: 'visible', timeout: 40000});
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CHAT);
    await incomingEmailTaskDiv.waitFor({state: 'visible', timeout: 40000});
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL);
    await waitForState(testManager.agent1Page, USER_STATES.ENGAGED);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);
    await waitForStateLogs(capturedLogs, USER_STATES.ENGAGED);
    expect(await getLastStateFromLogs(capturedLogs)).toBe(USER_STATES.ENGAGED);

    let count = 3;

    // eslint-disable-next-line no-await-in-loop
    while (count > 0) {
      capturedLogs.length = 0;
      // eslint-disable-next-line no-await-in-loop
      await testManager.agent1Page.waitForTimeout(2000);
      const endButton = testManager.agent1Page.getByTestId('call-control:end-call').first();
      // eslint-disable-next-line no-await-in-loop
      const endButtonVisible = await endButton
        .waitFor({state: 'visible', timeout: 2000})
        .then(() => true)
        .catch(() => false);
      if (endButtonVisible) {
        // eslint-disable-next-line no-await-in-loop
        await endButton.click({timeout: 5000});
        // eslint-disable-next-line no-await-in-loop
        await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
      } else {
        const wrapupBox = testManager.agent1Page.getByTestId('wrapup-button').first();
        // eslint-disable-next-line no-await-in-loop
        const isWrapupBoxVisible = await wrapupBox
          .waitFor({state: 'visible', timeout: 2000})
          .then(() => true)
          .catch(() => false);
        if (isWrapupBoxVisible) {
          // eslint-disable-next-line no-await-in-loop
          await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
          // eslint-disable-next-line no-await-in-loop
          await testManager.agent1Page.waitForTimeout(2000);
        } else {
          break;
        }
      }

      // eslint-disable-next-line no-await-in-loop
      await waitForState(
        testManager.agent1Page,
        count === 1 ? USER_STATES.AVAILABLE : USER_STATES.ENGAGED
      );
      // eslint-disable-next-line no-await-in-loop
      await verifyCurrentState(
        testManager.agent1Page,
        count === 1 ? USER_STATES.AVAILABLE : USER_STATES.ENGAGED
      );
      // eslint-disable-next-line no-await-in-loop
      await waitForStateLogs(
        capturedLogs,
        count === 1 ? USER_STATES.AVAILABLE : USER_STATES.ENGAGED
      );
      // eslint-disable-next-line no-await-in-loop
      expect(await getLastStateFromLogs(capturedLogs)).toBe(
        count === 1 ? USER_STATES.AVAILABLE : USER_STATES.ENGAGED
      );
      // eslint-disable-next-line no-await-in-loop
      await waitForWrapupReasonLogs(capturedLogs, WRAPUP_REASONS.SALE);
      // eslint-disable-next-line no-await-in-loop
      expect(await getLastWrapupReasonFromLogs(capturedLogs)).toBe(WRAPUP_REASONS.SALE);
      // eslint-disable-next-line no-await-in-loop
      expect(
        // eslint-disable-next-line no-await-in-loop
        await verifyCallbackLogs(
          capturedLogs,
          WRAPUP_REASONS.SALE,
          count === 1 ? USER_STATES.AVAILABLE : USER_STATES.ENGAGED
        )
      ).toBe(true);
      // eslint-disable-next-line no-plusplus
      count--;
    }
  });

  test('Chat task - verify transfer and end buttons are visible, end chat, and wrap up', async () => {
    // Create chat task
    await createChatTask(testManager.chatPage, process.env[`${testManager.projectName}_CHAT_URL`]!);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);

    // Wait for incoming chat notification
    const incomingTaskDiv = testManager.agent1Page
      .getByTestId('samples:incoming-task-chat')
      .first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 120000});

    // Accept the incoming chat
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CHAT);
    await testManager.agent1Page.waitForTimeout(5000);

    // Verify agent state changed to engaged
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

    try {
      // Use utility to check chat control buttons are visible
      await verifyTaskControls(testManager.agent1Page, TASK_TYPES.CHAT);

      // End the chat by clicking the end button
      await endTask(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(3000);

      // Verify onEnd callback logs
      verifyEndLogs();

      // Submit wrapup
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent1Page.waitForTimeout(2000);
    } catch (error) {
      throw new Error(`Chat task control test failed: ${error.message}`);
    }
  });

  test('Email task - verify transfer and end buttons are visible, end email, and wrap up', async () => {
    // Create email task
    await createEmailTask(process.env[`${testManager.projectName}_EMAIL_ENTRY_POINT`]!);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);

    // Wait for incoming email notification (emails may take longer)
    const incomingTaskDiv = testManager.agent1Page
      .getByTestId('samples:incoming-task-email')
      .first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 180000}); // 3 minutes for email

    // Accept the incoming email
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL);
    await testManager.agent1Page.waitForTimeout(5000);

    // Verify agent state changed to engaged
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

    try {
      // Use utility to check email control buttons are visible
      await verifyTaskControls(testManager.agent1Page, TASK_TYPES.EMAIL);

      // End the email by clicking the end button
      await endTask(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(3000);

      // Verify onEnd callback logs
      verifyEndLogs();

      // Submit wrapup
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent1Page.waitForTimeout(2000);
    } catch (error) {
      throw new Error(`Email task control test failed: ${error.message}`);
    }
  });

  test.afterAll(async () => {
    await testManager.cleanup();
  });
}
