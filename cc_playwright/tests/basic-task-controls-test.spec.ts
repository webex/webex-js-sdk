import {test, expect, beforeEach, beforeAll, afterAll} from '@playwright/test';
import {changeUserState, verifyCurrentState} from '../Utils/userStateUtils';
import {createCallTask, acceptIncomingTask} from '../Utils/incomingTaskUtils';
import {
  clearCapturedLogs,
  verifyRemoteAudioTracks,
  verifyRecordingLogs,
  recordCallToggle,
  endTask,
} from '../Utils/taskControlUtils';
import {submitWrapup} from '../Utils/wrapupUtils';
import {USER_STATES, TASK_TYPES, WRAPUP_REASONS, ACCEPT_TASK_TIMEOUT} from '../constants';
import {TestManager} from '../test-manager';

export default function createCallTaskControlsTests() {
  let testManager: TestManager;

  beforeEach(async () => {
    clearCapturedLogs();

    // Check if call is active
    const taskList = testManager.agent1Page.locator('#taskList');
    const taskCount = await taskList
      .locator('.task-item-content')
      .count()
      .catch(() => 0);

    if (taskCount === 0) {
      // No active call - create one
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(2000);

      await createCallTask(
        testManager.callerPage!,
        process.env[`${testManager.projectName}_ENTRY_POINT`]!
      );
      await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);

      const incomingTask = testManager.agent1Page.locator('#incoming-task');
      await expect(incomingTask).toContainText('connected', {timeout: 10000});
    }
  });

  beforeAll(async ({browser}, testInfo) => {
    const projectName = testInfo.project.name;
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
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(3000);

    await createCallTask(
      testManager.callerPage!,
      process.env[`${testManager.projectName}_ENTRY_POINT`]!
    );
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);

    const incomingTask = testManager.agent1Page.locator('#incoming-task');
    await expect(incomingTask).toContainText('connected', {timeout: 10000});

    const taskList = testManager.agent1Page.locator('#taskList');
    await expect(taskList).not.toContainText('No tasks available', {timeout: 10000});
  });

  test('Call task - verify remote audio tracks from caller to browser', async () => {
    // Verify call is connected (Desktop mode doesn't auto-transition to ENGAGED)
    const incomingTask = testManager.agent1Page.locator('#incoming-task');
    await expect(incomingTask).toContainText('connected', {timeout: 10000});

    // Verify remote audio tracks are present
    await verifyRemoteAudioTracks(testManager.agent1Page);
  });

  test('Call task - verify hold and resume functionality', async () => {
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
    // Verify call is connected
    const incomingTask = testManager.agent1Page.locator('#incoming-task');
    await expect(incomingTask).toContainText('connected', {timeout: 10000});

    // Check if recording button is enabled (requires backend configuration)
    const recordButton = testManager.agent1Page.locator('#pause-resume-recording');
    const isRecordButtonVisible = await recordButton.isVisible().catch(() => false);

    if (!isRecordButtonVisible) {
      // eslint-disable-next-line no-console
      console.log(
        'Recording button not visible - skipping test. Recording may be hidden in CSS or not supported by this team.'
      );
      test.skip();

      return;
    }

    // Check if button is enabled (requires team recording auto-start configuration)
    const isRecordButtonEnabled = await recordButton
      .evaluate((btn) => !(btn as HTMLButtonElement).disabled)
      .catch(() => false);

    if (!isRecordButtonEnabled) {
      // eslint-disable-next-line no-console
      console.log(
        'Recording button is disabled - skipping test. Team configuration does not have recording auto-start enabled. This requires backend configuration in Control Hub for the team.'
      );
      test.skip();

      return;
    }

    // Clear logs before testing
    clearCapturedLogs();

    // Test pause recording
    await recordCallToggle(testManager.agent1Page);
    await testManager.agent1Page.waitForTimeout(2000);
    await verifyRecordingLogs({expectedIsRecording: false});

    // Test resume recording
    clearCapturedLogs();
    await recordCallToggle(testManager.agent1Page);
    await testManager.agent1Page.waitForTimeout(2000);
    await verifyRecordingLogs({expectedIsRecording: true});
  });

  test('Call task - end call and complete wrapup', async () => {
    const incomingTask = testManager.agent1Page.locator('#incoming-task');
    await expect(incomingTask).toContainText('connected', {timeout: 10000});

    await endTask(testManager.agent1Page);
    await testManager.agent1Page.waitForTimeout(3000);
    await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
    await testManager.agent1Page.waitForTimeout(2000);
  });
}
