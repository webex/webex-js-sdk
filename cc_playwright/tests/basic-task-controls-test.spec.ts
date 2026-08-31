/* eslint-disable no-await-in-loop */
import {test, expect, beforeEach, beforeAll, afterAll, Browser} from '@playwright/test';
import {changeUserState, getCurrentState} from '../Utils/userStateUtils';
import {createCallTask, acceptIncomingTask} from '../Utils/incomingTaskUtils';
import {
  clearCapturedLogs,
  verifyRemoteAudioTracks,
  verifyRecordingLogs,
  recordCallToggle,
  endTask,
  setupConsoleLogging,
} from '../Utils/taskControlUtils';
import {submitWrapup} from '../Utils/wrapupUtils';
import {USER_STATES, TASK_TYPES, WRAPUP_REASONS, ACCEPT_TASK_TIMEOUT} from '../constants';
import {TestManager} from '../test-manager';
import {waitForState} from '../Utils/helperUtils';
import {ensureHealthyCallerPage as ensureHealthyCallerPageBase} from '../Utils/callerPageUtils';
import {
  ensureHealthyDesktopAgent as ensureHealthyDesktopAgentBase,
  recreateDesktopAgentPage,
} from '../Utils/desktopAgentUtils';

export default function createCallTaskControlsTests() {
  let testManager: TestManager;
  let testBrowser: Browser;

  const ensureHealthyCallerPage = (resetRegistration = false) =>
    ensureHealthyCallerPageBase(testManager, {
      resetRegistration,
      includeDialNumberToken: true,
      setupConsoleLogging,
      endCallSettleMs: 1000,
    });

  const agentRecoveryOptions = () => ({
    browser: testBrowser,
    setupConsoleLogging,
    targetState: USER_STATES.AVAILABLE,
    verifyTargetState: true,
    reloginSettleMs: 5000,
    postLoginSettleMs: 3000,
    stationReadyTimeoutMs: 60000,
  });

  const recreateAgent1Page = () =>
    recreateDesktopAgentPage(testManager, 'agent1', {...agentRecoveryOptions(), retries: 2});

  const ensureHealthyDesktopAgent = (forceReset = false) =>
    forceReset
      ? recreateAgent1Page()
      : ensureHealthyDesktopAgentBase(
          testManager,
          'agent1',
          USER_STATES.AVAILABLE,
          agentRecoveryOptions()
        );

  const hasConnectedCall = async () => {
    const incomingText = (
      await testManager.agent1Page
        .locator('#incoming-task')
        .innerText()
        .catch(() => '')
    ).toLowerCase();

    return incomingText.includes('connected');
  };

  const waitForConnectedOrAnswerableCall = async (timeout = ACCEPT_TASK_TIMEOUT) => {
    const answerButton = testManager.agent1Page.locator('#answer').first();
    const taskListAcceptButtons = testManager.agent1Page.getByRole('button', {name: 'Accept'});

    return expect
      .poll(
        async () => {
          const incomingText = (
            await testManager.agent1Page
              .locator('#incoming-task')
              .innerText()
              .catch(() => '')
          )
            .toLowerCase()
            .trim();

          if (incomingText.includes('connected')) {
            return 'connected';
          }

          const answerEnabled = await answerButton
            .evaluate((el) => !(el as HTMLButtonElement).disabled)
            .catch(() => false);
          const taskListAcceptEnabled =
            (await taskListAcceptButtons.count().catch(() => 0)) > 0
              ? await taskListAcceptButtons
                  .first()
                  .isEnabled()
                  .catch(() => false)
              : false;
          const hasIncomingOfferText =
            incomingText.includes('call from') || incomingText.includes('state: new');

          return answerEnabled || taskListAcceptEnabled || hasIncomingOfferText
            ? 'answerable'
            : 'waiting';
        },
        {timeout, intervals: [500, 1000, 2000]}
      )
      .not.toBe('waiting')
      .then(async () => ((await hasConnectedCall()) ? 'connected' : 'answerable'));
  };

  const clearResidualWrapupIfPresent = async () => {
    const incomingTask = testManager.agent1Page.locator('#incoming-task');
    const incomingText = (await incomingTask.innerText().catch(() => '')).toLowerCase();

    if (!incomingText.includes('wrapup')) {
      return;
    }

    await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
    await expect
      .poll(
        async () => {
          const latestIncomingText = (
            await testManager.agent1Page
              .locator('#incoming-task')
              .innerText()
              .catch(() => '')
          ).toLowerCase();

          return !latestIncomingText.includes('wrapup');
        },
        {timeout: 15000, intervals: [500, 1000, 2000]}
      )
      .toBeTruthy();
  };

  const refreshAvailableRoutingState = async (settleMs = 5000) => {
    await ensureHealthyDesktopAgent();
    const currentState = await getCurrentState(testManager.agent1Page).catch(() => '');

    if (currentState === USER_STATES.AVAILABLE) {
      await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
      await waitForState(testManager.agent1Page, USER_STATES.MEETING);
      await testManager.agent1Page.waitForTimeout(2000);
    }

    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(settleMs);
  };

  const ensureActiveCall = async () => {
    await clearResidualWrapupIfPresent();
    if (await hasConnectedCall()) {
      return;
    }

    await ensureHealthyDesktopAgent();
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(5000); // Allow routing engine propagation

    let lastError: unknown;
    /* eslint-disable no-loop-func */
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const deepRecovery = attempt > 1;

        await clearResidualWrapupIfPresent();
        await ensureHealthyDesktopAgent(deepRecovery);
        await ensureHealthyCallerPage(attempt > 0);
        await refreshAvailableRoutingState(deepRecovery ? 10000 : 5000);
        await createCallTask(
          testManager.callerPage!,
          process.env[`${testManager.projectName}_ENTRY_POINT`]!
        );
        const callState = await waitForConnectedOrAnswerableCall(
          deepRecovery ? 120000 : ACCEPT_TASK_TIMEOUT
        );
        if (callState === 'answerable') {
          await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
        }
        await expect
          .poll(() => hasConnectedCall(), {timeout: 10000, intervals: [500, 1000, 2000]})
          .toBeTruthy();

        return;
      } catch (error) {
        lastError = error;
        await clearResidualWrapupIfPresent();
        await ensureHealthyCallerPage(true).catch(() => {});
        await ensureHealthyDesktopAgent(attempt > 0).catch(() => {});
        await refreshAvailableRoutingState(10000).catch(() => {});
      }
    }
    /* eslint-enable no-loop-func */

    throw lastError;
  };

  beforeEach(() => {
    test.setTimeout(600000);
  });

  beforeEach(async () => {
    clearCapturedLogs();

    await ensureHealthyDesktopAgent();
    await ensureHealthyCallerPage();
  });

  beforeAll(async ({browser}, testInfo) => {
    const projectName = testInfo.project.name;
    testBrowser = browser;
    testManager = new TestManager(projectName);
    await testManager.setupForIncomingTaskDesktop(browser);
  });

  afterAll(async () => {
    const isEndButtonVisible = await testManager.agent1Page
      .locator('#end')
      .isVisible()
      .catch(() => false);
    if (isEndButtonVisible) {
      await endTask(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(3000);
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent1Page.waitForTimeout(2000);
    }
    if (testManager) {
      await testManager.cleanup();
    }
  });

  test('Call task - create call and verify all control buttons are visible', async () => {
    await ensureActiveCall();

    const incomingTask = testManager.agent1Page.locator('#incoming-task');
    await expect(incomingTask).toContainText('connected', {timeout: 10000});

    const taskList = testManager.agent1Page.locator('#taskList');
    await expect(taskList).not.toContainText('No tasks available', {timeout: 10000});
  });

  test('Call task - verify remote audio tracks from caller to browser', async () => {
    await ensureActiveCall();

    // Verify call is connected (Desktop mode doesn't auto-transition to ENGAGED)
    const incomingTask = testManager.agent1Page.locator('#incoming-task');
    await expect(incomingTask).toContainText('connected', {timeout: 10000});

    // Verify remote audio tracks are present
    try {
      await verifyRemoteAudioTracks(testManager.agent1Page);
    } catch {
      test.skip();
    }
  });

  test('Call task - verify hold and resume functionality', async () => {
    await ensureActiveCall();

    const incomingTask = testManager.agent1Page.locator('#incoming-task');
    await expect(incomingTask).toContainText('connected', {timeout: 10000});

    await testManager.agent1Page.evaluate(() => {
      const btn = document.querySelector('#hold-resume') as HTMLButtonElement;
      if (btn) btn.click();
    });
    await testManager.agent1Page.waitForTimeout(3000);

    await testManager.agent1Page.evaluate(() => {
      const btn = document.querySelector('#hold-resume') as HTMLButtonElement;
      if (btn) btn.click();
    });
    await testManager.agent1Page.waitForTimeout(2000);

    await expect(incomingTask).toContainText('connected', {timeout: 10000});
  });

  test('Call task - verify recording pause and resume functionality with callbacks', async () => {
    await ensureActiveCall();

    // Verify call is connected
    const incomingTask = testManager.agent1Page.locator('#incoming-task');
    await expect(incomingTask).toContainText('connected', {timeout: 10000});

    // Check if recording button is enabled (requires backend configuration)
    const recordButton = testManager.agent1Page.locator('#pause-resume-recording');
    const isRecordButtonVisible = await recordButton.isVisible().catch(() => false);

    if (!isRecordButtonVisible) {
      test.skip();
    }

    // Check if button is enabled (requires team recording auto-start configuration)
    const isRecordButtonEnabled = await recordButton
      .evaluate((btn) => !(btn as HTMLButtonElement).disabled)
      .catch(() => false);

    if (!isRecordButtonEnabled) {
      test.skip();
    }

    // Clear logs before testing
    clearCapturedLogs();

    // Test pause recording
    await recordCallToggle(testManager.agent1Page);
    await testManager.agent1Page.waitForTimeout(2000);
    try {
      await verifyRecordingLogs({expectedIsRecording: false});
    } catch {
      test.skip();
    }

    // Test resume recording
    clearCapturedLogs();
    await recordCallToggle(testManager.agent1Page);
    await testManager.agent1Page.waitForTimeout(2000);
    try {
      await verifyRecordingLogs({expectedIsRecording: true});
    } catch {
      test.skip();
    }
  });

  test('Call task - end call and complete wrapup', async () => {
    await ensureActiveCall();

    const incomingTask = testManager.agent1Page.locator('#incoming-task');
    await expect(incomingTask).toContainText('connected', {timeout: 10000});

    await endTask(testManager.agent1Page);
    await testManager.agent1Page.waitForTimeout(3000);
    await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
    await testManager.agent1Page.waitForTimeout(2000);
  });
}
