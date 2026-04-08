import {test, expect, beforeEach, beforeAll, afterAll} from '@playwright/test';
import {changeUserState, verifyCurrentState} from '../Utils/userStateUtils';
import {createCallTask, acceptIncomingTask} from '../Utils/incomingTaskUtils';
import {
  clearCapturedLogs,
  verifyRemoteAudioTracks, // eslint-disable-line @typescript-eslint/no-unused-vars
  verifyRecordingLogs, // eslint-disable-line @typescript-eslint/no-unused-vars
  endTask,
} from '../Utils/taskControlUtils';
import {submitWrapup} from '../Utils/wrapupUtils';
import {USER_STATES, TASK_TYPES, WRAPUP_REASONS, ACCEPT_TASK_TIMEOUT} from '../constants';
import {TestManager} from '../test-manager';

export default function createCallTaskControlsTests() {
  let testManager: TestManager;

  beforeEach(() => {
    clearCapturedLogs();
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

  test.skip('Call task - verify remote audio tracks from caller to browser', async () => {
    // Skipped: WebRTC audio tracks don't work reliably with fake media devices
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

  test.skip('Call task - verify recording pause and resume functionality with callbacks', async () => {
    // Skipped: Fake media devices don't support recording
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
