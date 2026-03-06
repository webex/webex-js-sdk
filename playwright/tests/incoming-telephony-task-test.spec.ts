/* eslint-disable import/no-extraneous-dependencies, @typescript-eslint/no-non-null-assertion */
import {expect, Page, test} from '@playwright/test';
import {changeUserState, verifyCurrentState} from '../Utils/userStateUtils';
import {
  acceptExtensionCall,
  acceptIncomingTask,
  createCallTask,
  declineIncomingTask,
  endCallTask,
  submitRonaPopup,
  waitForIncomingTask,
} from '../Utils/incomingTaskUtils';
import {RONA_OPTIONS, TASK_TYPES, THEME_COLORS, USER_STATES, WRAPUP_REASONS} from '../constants';
import {submitWrapup} from '../Utils/wrapupUtils';
import {
  getLastStateFromLogs,
  getLastWrapupReasonFromLogs,
  isColorClose,
  waitForState,
  waitForStateLogs,
  waitForWrapupReasonLogs,
} from '../Utils/helperUtils';
import {TestManager} from '../test-manager';

const capturedLogs: string[] = [];

function setupConsoleLogging(page: Page): () => void {
  capturedLogs.length = 0;

  const consoleHandler = (msg: any) => {
    const text = msg.text();
    if (
      text.includes('onStateChange invoked with state name:') ||
      text.includes('onWrapup invoked with reason :')
    ) {
      capturedLogs.push(text);
    }
  };

  page.on('console', consoleHandler);

  return () => page.off('console', consoleHandler);
}

async function verifyCallbackLogs(
  expectedWrapupReason: string,
  expectedState: string
): Promise<void> {
  const wrapup = await getLastWrapupReasonFromLogs(capturedLogs);
  const state = await getLastStateFromLogs(capturedLogs);

  expect(wrapup).toBe(expectedWrapupReason);
  expect(state).toBe(expectedState);
}

export default function createIncomingTelephonyTaskTests() {
  test.describe('Incoming Call Task Tests for Desktop Mode', () => {
    let testManager: TestManager;

    test.beforeEach(() => {
      capturedLogs.length = 0;
    });

    test.beforeAll(async ({browser}, testInfo) => {
      testManager = new TestManager(testInfo.project.name);
      await testManager.setupForIncomingTaskDesktop(browser);
      setupConsoleLogging(testManager.agent1Page);
    });

    test.afterAll(async () => {
      await testManager.cleanup();
    });

    test('should accept incoming call, end call and complete wrapup in desktop mode', async () => {
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);

      await waitForState(testManager.agent1Page, USER_STATES.ENGAGED);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

      const color = await testManager.agent1Page
        .locator('#idleCodesDropdown')
        .evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(isColorClose(color, THEME_COLORS.ENGAGED)).toBe(true);

      await testManager.agent1Page.locator('#end').click({timeout: 5000});
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);

      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await waitForStateLogs(capturedLogs, USER_STATES.AVAILABLE);
      await waitForWrapupReasonLogs(capturedLogs, WRAPUP_REASONS.SALE);
      await verifyCallbackLogs(WRAPUP_REASONS.SALE, USER_STATES.AVAILABLE);
    });

    test('should decline incoming call and verify RONA state in desktop mode', async () => {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);

      await declineIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await testManager.agent1Page
        .locator('#agentStatePopup')
        .waitFor({state: 'visible', timeout: 15000});

      await waitForState(testManager.agent1Page, USER_STATES.AGENT_DECLINED);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AGENT_DECLINED);

      const color = await testManager.agent1Page
        .locator('#idleCodesDropdown')
        .evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(isColorClose(color, THEME_COLORS.MEETING)).toBe(true);

      await endCallTask(testManager.callerPage, true);
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
      await waitForState(testManager.agent1Page, USER_STATES.MEETING);
    });

    test('should ignore incoming call and wait for RONA popup in desktop mode', async () => {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );

      const incomingTask = await waitForIncomingTask(
        testManager.agent1Page,
        TASK_TYPES.CALL,
        40000
      );
      await incomingTask.waitFor({state: 'hidden', timeout: 30000});

      await testManager.agent1Page
        .locator('#agentStatePopup')
        .waitFor({state: 'visible', timeout: 15000});
      await expect(testManager.agent1Page.locator('#agentStatePopup')).toBeVisible();

      await endCallTask(testManager.callerPage, true);
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
      await waitForState(testManager.agent1Page, USER_STATES.MEETING);
    });

    test('should handle customer disconnect before agent answers in desktop mode', async () => {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );

      const incomingTask = await waitForIncomingTask(
        testManager.agent1Page,
        TASK_TYPES.CALL,
        40000
      );
      await endCallTask(testManager.callerPage, true);

      await incomingTask.waitFor({state: 'hidden', timeout: 30000});
      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    });
  });

  test.describe('Incoming Task Tests in Extension Mode', () => {
    let testManager: TestManager;

    test.beforeEach(() => {
      capturedLogs.length = 0;
    });

    test.beforeAll(async ({browser}, testInfo) => {
      testManager = new TestManager(testInfo.project.name);
      await testManager.setupForIncomingTaskExtension(browser);
      setupConsoleLogging(testManager.agent1Page);
    });

    test.afterAll(async () => {
      await testManager.cleanup();
    });

    test('should accept incoming call, end call and complete wrapup in extension mode', async () => {
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);

      await acceptExtensionCall(testManager.agent1ExtensionPage);
      await waitForState(testManager.agent1Page, USER_STATES.ENGAGED);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

      const color = await testManager.agent1Page
        .locator('#idleCodesDropdown')
        .evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(isColorClose(color, THEME_COLORS.ENGAGED)).toBe(true);

      await testManager.agent1Page.locator('#end').click({timeout: 5000});
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);

      await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await waitForStateLogs(capturedLogs, USER_STATES.AVAILABLE);
      await waitForWrapupReasonLogs(capturedLogs, WRAPUP_REASONS.SALE);
      await verifyCallbackLogs(WRAPUP_REASONS.SALE, USER_STATES.AVAILABLE);
    });

    test('should decline incoming call and verify RONA state in extension mode', async () => {
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await createCallTask(
        testManager.callerPage,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, 40000);

      await declineIncomingTask(testManager.agent1Page, TASK_TYPES.CALL);
      await testManager.agent1Page
        .locator('#agentStatePopup')
        .waitFor({state: 'visible', timeout: 15000});

      await waitForState(testManager.agent1Page, USER_STATES.AGENT_DECLINED);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AGENT_DECLINED);

      await endCallTask(testManager.callerPage, true);
      await submitRonaPopup(testManager.agent1Page, RONA_OPTIONS.IDLE);
      await waitForState(testManager.agent1Page, USER_STATES.MEETING);
    });
  });
}
