/* eslint-disable import/no-extraneous-dependencies, @typescript-eslint/no-non-null-assertion */
import {test} from '@playwright/test';
import {changeUserState, getCurrentState, verifyCurrentState} from '../Utils/userStateUtils';
import {createCallTask, acceptIncomingTask} from '../Utils/incomingTaskUtils';
import {
  verifyTaskControls,
  holdCallToggle,
  recordCallToggle,
  clearCapturedLogs,
  verifyHoldLogs,
  verifyRecordingLogs,
  verifyEndLogs,
  verifyHoldTimer,
  verifyRemoteAudioTracks,
  verifyHoldMusicElement,
  endTask,
  verifyHoldButtonIcon,
  verifyRecordButtonIcon,
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
    if ((await getCurrentState(testManager.agent1Page)) === USER_STATES.ENGAGED) {
      // If still engaged, end the call to clean up
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
    // Create call task
    await createCallTask(
      testManager.callerPage!,
      process.env[`${testManager.projectName}_ENTRY_POINT`]!
    );
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);

    // Accept the incoming call (waits for task to be visible)
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CALL, ACCEPT_TASK_TIMEOUT);
    await testManager.agent1Page.waitForTimeout(5000);

    // Verify agent state changed to engaged
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

    // Use utility to check all call control buttons are visible
    try {
      await verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL);
    } catch (error) {
      throw new Error(`Call control buttons verification failed: ${error.message}`);
    }
  });

  test('Call task - verify remote audio tracks from caller to browser', async () => {
    // Verify we're still in an engaged call from previous test
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

    try {
      // Then verify the audio tracks with the exact structure you provided
      await verifyRemoteAudioTracks(testManager.agent1Page);
    } catch (error) {
      throw new Error(`Remote audio tracks verification failed: ${error.message}`);
    }
  });

  test('Call task - verify hold and resume functionality with callbacks, timer, and hold music', async () => {
    // Verify we're still in an engaged call from previous test
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

    try {
      // Clear logs first to ensure clean state
      clearCapturedLogs();

      // Verify initial hold button icon (should show pause icon when call is active)
      await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: false});

      // Put call on hold from agent side
      await holdCallToggle(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(3000); // Allow time for hold to take effect

      // Verify hold callback logs
      verifyHoldLogs({expectedIsHeld: true});

      // Verify hold button icon changed to play icon (when call is on hold)
      await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true});

      // Verify hold music element is present on the CALLER page (where hold music plays)
      // The hold music plays on the caller's side when agent puts call on hold
      await verifyHoldMusicElement(testManager.callerPage!);

      // Verify hold timer is visible and functioning
      await verifyHoldTimer(testManager.agent1Page, {shouldBeVisible: true});

      clearCapturedLogs(); // Clear logs for next verification

      // Resume call from hold
      await holdCallToggle(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(2000);

      // Verify resume callback logs
      verifyHoldLogs({expectedIsHeld: false});

      // Verify hold button icon changed back to pause icon (when call is active)
      await verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: false});

      verifyHoldTimer(testManager.agent1Page, {shouldBeVisible: false});
    } catch (error) {
      throw new Error(
        `Hold/Resume functionality with callbacks, timer, and hold music verification failed: ${error.message}`
      );
    }
  });

  test('Call task - verify recording pause and resume functionality with callbacks', async () => {
    // Verify we're still in an engaged call from previous tests
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

    try {
      // Verify initial record button icon (should show pause icon when recording is active)
      await verifyRecordButtonIcon(testManager.agent1Page, {expectedIsRecording: true});

      // Pause the call recording
      await recordCallToggle(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(2000);

      // Verify pause recording callback logs
      verifyRecordingLogs({expectedIsRecording: false});

      // Verify record button icon changed to record icon (when recording is paused)
      await verifyRecordButtonIcon(testManager.agent1Page, {expectedIsRecording: false});

      clearCapturedLogs(); // Clear logs for next verification

      // Resume the call recording
      await recordCallToggle(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(2000);

      // Verify resume recording callback logs
      verifyRecordingLogs({expectedIsRecording: true});

      // Verify record button icon changed back to pause icon (when recording is active)
      await verifyRecordButtonIcon(testManager.agent1Page, {expectedIsRecording: true});
    } catch (error) {
      throw new Error(`Recording pause/resume functionality verification failed: ${error.message}`);
    }
  });

  test('Call task - end call and complete wrapup', async () => {
    // Verify we're still in an engaged call from previous tests
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);

    try {
      // End the call by clicking the end button
      await endTask(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(3000);

      // Verify onEnd callback logs
      verifyEndLogs();

      // Submit wrapup
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent1Page.waitForTimeout(2000);
    } catch (error) {
      throw new Error(`Call task end and wrapup failed: ${error.message}`);
    }
  });
}
