import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {
  acceptExtensionCall,
  acceptIncomingTask,
  createCallTask,
  createChatTask,
  createEmailTask,
  declineExtensionCall,
  endCallTask,
  submitRonaPopup,
  waitForIncomingTask,
} from '../Utils/incomingTaskUtils';
import {changeUserState, verifyCurrentState} from '../Utils/userStateUtils';
import {
  holdCallToggle,
  recordCallToggle,
  verifyHoldButtonIcon,
  verifyHoldTimer,
  verifyRecordButtonIcon,
  verifyTaskControls,
} from '../Utils/taskControlUtils';
import {RONA_OPTIONS, TASK_TYPES, THEME_COLORS, USER_STATES, WRAPUP_REASONS} from '../constants';
import {isColorClose, waitForState} from '../Utils/helperUtils';
import {submitWrapup} from '../Utils/wrapupUtils';

export default function createIncomingTaskAndControlsMultiSessionTests() {
  let testManager: TestManager;

  test.beforeAll(async ({browser}, testInfo) => {
    const projectName = testInfo.project.name;
    testManager = new TestManager(projectName);
    await testManager.setupForIncomingTaskMultiSession(browser);
  });

  test.afterAll(async () => {
    if (testManager) {
      await testManager.cleanup();
    }
  });

  test('should handle multi-session incoming call with state synchronization', async () => {
    await createCallTask(
      testManager.callerPage,
      process.env[`${testManager.projectName}_ENTRY_POINT`]!
    );
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    let incomingTaskDiv = testManager.agent1Page.locator('#incoming-task').first();
    let incomingTaskDiv2 = testManager.multiSessionAgent1Page.locator('#incoming-task').first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 40000});
    await testManager.agent1ExtensionPage.waitForTimeout(2000);
    await expect(testManager.agent1ExtensionPage.locator('#answer').first()).toBeEnabled({
      timeout: 20000,
    });
    await incomingTaskDiv2.waitFor({state: 'visible', timeout: 10000});
    await testManager.agent1Page.waitForTimeout(5000);
    await testManager.agent1ExtensionPage.waitForTimeout(1000);
    await declineExtensionCall(testManager.agent1ExtensionPage);
    await testManager.agent1Page
      .locator('#agentStatePopup')
      .waitFor({state: 'visible', timeout: 10000});
    await testManager.multiSessionAgent1Page
      .locator('#agentStatePopup')
      .waitFor({state: 'visible', timeout: 10000});
    await testManager.agent1Page.waitForTimeout(3000);
    await submitRonaPopup(testManager.multiSessionAgent1Page, RONA_OPTIONS.IDLE);
    await waitForState(testManager.agent1Page, USER_STATES.MEETING);
    await waitForState(testManager.multiSessionAgent1Page, USER_STATES.MEETING);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.MEETING);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
    await expect(testManager.agent1Page.locator('#agentStatePopup')).not.toBeVisible();
    await expect(testManager.multiSessionAgent1Page.locator('#agentStatePopup')).not.toBeVisible();
    await testManager.agent1Page.waitForTimeout(2000);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await waitForState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
    await testManager.multiSessionAgent1Page.waitForTimeout(2000);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
    incomingTaskDiv = testManager.agent1Page.locator('#incoming-task').first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 10000});
    await testManager.agent1ExtensionPage.waitForTimeout(2000);
    await expect(testManager.agent1ExtensionPage.locator('#answer').first()).toBeEnabled({
      timeout: 10000,
    });
    incomingTaskDiv2 = testManager.multiSessionAgent1Page.locator('#incoming-task').first();
    await incomingTaskDiv2.waitFor({state: 'visible', timeout: 10000});
    await testManager.agent1Page.waitForTimeout(2000);
    await acceptExtensionCall(testManager.agent1ExtensionPage);
    await testManager.agent1Page.waitForTimeout(2000);
    await waitForState(testManager.agent1Page, USER_STATES.ENGAGED);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.ENGAGED);
    await testManager.agent1Page.waitForTimeout(3000);
    const userStateElement = testManager.agent1Page.locator('#idleCodesDropdown');
    const userStateElementColor = await userStateElement.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(isColorClose(userStateElementColor, THEME_COLORS.ENGAGED)).toBe(true);
    const userStateElement2 = testManager.multiSessionAgent1Page.locator('#idleCodesDropdown');
    const userStateElementColor2 = await userStateElement2.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(isColorClose(userStateElementColor2, THEME_COLORS.ENGAGED)).toBe(true);
    await expect(incomingTaskDiv).toBeHidden();
    await expect(incomingTaskDiv2).toBeHidden();
    await testManager.multiSessionAgent1Page.locator('#end').first().click({timeout: 5000});
    await testManager.agent1Page.waitForTimeout(1000);
    await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await waitForState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
  });

  test('Multi-login call controls - verify controls are synchronized', async () => {
    // Set both AGENT1 sessions to available state
    await Promise.all([changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE)]);
    await testManager.agent1Page.waitForTimeout(2000);

    // Caller page creates call to extension page
    await createCallTask(
      testManager.callerPage!,
      process.env[`${testManager.projectName}_ENTRY_POINT`]!
    );

    // Wait for incoming call notification on both AGENT1 sessions
    const incomingTaskSession1 = testManager.agent1Page.locator('#incoming-task').first();
    const incomingTaskSession2 = testManager
      .multiSessionAgent1Page!.locator('#incoming-task')
      .first();

    await Promise.all([
      incomingTaskSession1.waitFor({state: 'visible', timeout: 40000}),
      incomingTaskSession2.waitFor({state: 'visible', timeout: 40000}),
    ]);

    // Wait for extension caller to be visible and accept the call
    await testManager.agent1ExtensionPage.waitForTimeout(2000);
    await expect(testManager.agent1ExtensionPage.locator('#answer').first()).toBeEnabled({
      timeout: 20000,
    });
    await acceptExtensionCall(testManager.agent1ExtensionPage);
    await testManager.agent1Page.waitForTimeout(2000);
    await testManager.multiSessionAgent1Page!.waitForTimeout(2000);
    // Verify both AGENT1 sessions show engaged state
    await Promise.all([
      verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED),
      verifyCurrentState(testManager.multiSessionAgent1Page!, USER_STATES.ENGAGED),
    ]);

    try {
      // Verify call control buttons are visible on both AGENT1 sessions
      await Promise.all([
        verifyTaskControls(testManager.agent1Page, TASK_TYPES.CALL),
        verifyTaskControls(testManager.multiSessionAgent1Page!, TASK_TYPES.CALL),
      ]);

      // Verify initial hold button icons on both sessions (should show pause icon when call is active)
      await Promise.all([
        verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: false}),
        verifyHoldButtonIcon(testManager.multiSessionAgent1Page!, {expectedIsHeld: false}),
      ]);

      // Put call on hold from session 1 (AGENT1)
      await holdCallToggle(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(3000);

      // Verify hold button icons changed to play icon on both sessions (when call is on hold)
      await Promise.all([
        verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: true}),
        verifyHoldButtonIcon(testManager.multiSessionAgent1Page!, {expectedIsHeld: true}),
      ]);

      // Verify hold timer is visible on both AGENT1 sessions
      await Promise.all([
        verifyHoldTimer(testManager.agent1Page, {shouldBeVisible: true}),
        verifyHoldTimer(testManager.multiSessionAgent1Page!, {shouldBeVisible: true}),
      ]);

      // Resume call from session 2 (AGENT1)
      await holdCallToggle(testManager.multiSessionAgent1Page!);
      await testManager.multiSessionAgent1Page!.waitForTimeout(3000);

      // Verify hold button icons changed back to pause icon on both sessions (when call is active)
      await Promise.all([
        verifyHoldButtonIcon(testManager.agent1Page, {expectedIsHeld: false}),
        verifyHoldButtonIcon(testManager.multiSessionAgent1Page!, {expectedIsHeld: false}),
      ]);

      // Verify hold timer disappears on both AGENT1 sessions
      await Promise.all([
        verifyHoldTimer(testManager.agent1Page, {shouldBeVisible: false}),
        verifyHoldTimer(testManager.multiSessionAgent1Page!, {shouldBeVisible: false}),
      ]);

      // Verify initial record button icons on both sessions (should show pause icon when recording is active)
      await Promise.all([
        verifyRecordButtonIcon(testManager.agent1Page, {expectedIsRecording: true}),
        verifyRecordButtonIcon(testManager.multiSessionAgent1Page!, {expectedIsRecording: true}),
      ]);

      // Pause recording from session 1 (AGENT1)
      await recordCallToggle(testManager.agent1Page);
      await testManager.agent1Page.waitForTimeout(2000);

      // Verify record button icons changed to record icon on both sessions (when recording is paused)
      await Promise.all([
        verifyRecordButtonIcon(testManager.agent1Page, {expectedIsRecording: false}),
        verifyRecordButtonIcon(testManager.multiSessionAgent1Page!, {expectedIsRecording: false}),
      ]);

      // Resume recording from session 2 (AGENT1)
      await recordCallToggle(testManager.multiSessionAgent1Page!);
      await testManager.multiSessionAgent1Page!.waitForTimeout(2000);

      // Verify record button icons changed back to pause icon on both sessions (when recording is active)
      await Promise.all([
        verifyRecordButtonIcon(testManager.agent1Page, {expectedIsRecording: true}),
        verifyRecordButtonIcon(testManager.multiSessionAgent1Page!, {expectedIsRecording: true}),
      ]);

      // End call from extension page
      await endCallTask(testManager.agent1ExtensionPage!);
      await testManager.agent1Page.waitForTimeout(2000);

      // Submit wrapup from session 1 (AGENT1)
      await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.RESOLVED);
      await testManager.agent1Page.waitForTimeout(2000);

      // Verify both AGENT1 sessions return to available state
      await Promise.all([
        verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE),
        verifyCurrentState(testManager.multiSessionAgent1Page!, USER_STATES.AVAILABLE),
      ]);
    } catch (error) {
      throw new Error(`Multi-session call controls synchronization failed: ${error.message}`);
    }
  });

  test('should handle multi-session incoming chat with state synchronization', async () => {
    await createChatTask(testManager.chatPage, process.env[`${testManager.projectName}_CHAT_URL`]!);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    let incomingTaskDiv = testManager.agent1Page.locator('#incoming-task').first();
    let incomingTaskDiv2 = testManager.multiSessionAgent1Page.locator('#incoming-task').first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 60000});
    await incomingTaskDiv2.waitFor({state: 'visible', timeout: 10000});
    await incomingTaskDiv.waitFor({state: 'hidden', timeout: 30000});
    await incomingTaskDiv2.waitFor({state: 'hidden', timeout: 10000});
    await testManager.agent1Page
      .locator('#agentStatePopup')
      .waitFor({state: 'visible', timeout: 15000});
    await testManager.multiSessionAgent1Page
      .locator('#agentStatePopup')
      .waitFor({state: 'visible', timeout: 15000});
    await submitRonaPopup(testManager.multiSessionAgent1Page, RONA_OPTIONS.IDLE);
    await waitForState(testManager.agent1Page, USER_STATES.MEETING);
    await waitForState(testManager.multiSessionAgent1Page, USER_STATES.MEETING);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.MEETING);
    await testManager.agent1Page.waitForTimeout(2000);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await waitForState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
    await testManager.multiSessionAgent1Page.waitForTimeout(2000);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
    incomingTaskDiv = testManager.agent1Page.locator('#incoming-task').first();
    incomingTaskDiv2 = testManager.multiSessionAgent1Page.locator('#incoming-task').first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 10000});
    await incomingTaskDiv2.waitFor({state: 'visible', timeout: 10000});
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.CHAT);
    await waitForState(testManager.agent1Page, USER_STATES.ENGAGED);
    await waitForState(testManager.multiSessionAgent1Page, USER_STATES.ENGAGED);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.ENGAGED);
    await testManager.agent1Page.waitForTimeout(3000);
    const userStateElement = testManager.agent1Page.locator('#idleCodesDropdown');
    const userStateElementColor = await userStateElement.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(isColorClose(userStateElementColor, THEME_COLORS.ENGAGED)).toBe(true);
    const userStateElement2 = testManager.multiSessionAgent1Page.locator('#idleCodesDropdown');
    const userStateElementColor2 = await userStateElement2.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(isColorClose(userStateElementColor2, THEME_COLORS.ENGAGED)).toBe(true);
    await expect(incomingTaskDiv).toBeHidden();
    await expect(incomingTaskDiv2).toBeHidden();
    await testManager.multiSessionAgent1Page.locator('#end').first().click({timeout: 5000});
    await submitWrapup(testManager.multiSessionAgent1Page, WRAPUP_REASONS.SALE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await waitForState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
  });

  test('should handle multi-session incoming email with state synchronization', async () => {
    await createEmailTask(process.env[`${testManager.projectName}_EMAIL_ENTRY_POINT`]!);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await waitForIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL);
    await waitForIncomingTask(testManager.multiSessionAgent1Page, TASK_TYPES.EMAIL);
    await testManager.agent1Page.bringToFront();
    await testManager.agent1Page
      .locator('#agentStatePopup')
      .waitFor({state: 'visible', timeout: 20000});
    await testManager.multiSessionAgent1Page.bringToFront();
    await testManager.multiSessionAgent1Page
      .locator('#agentStatePopup')
      .waitFor({state: 'visible', timeout: 20000});
    await testManager.agent1Page.waitForTimeout(3000);
    await submitRonaPopup(testManager.multiSessionAgent1Page, RONA_OPTIONS.IDLE);
    await waitForState(testManager.agent1Page, USER_STATES.MEETING);
    await waitForState(testManager.multiSessionAgent1Page, USER_STATES.MEETING);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.MEETING);
    await testManager.agent1Page.waitForTimeout(3000);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await waitForState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await testManager.multiSessionAgent1Page.waitForTimeout(2000);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
    const incomingTaskDiv = testManager.agent1Page.locator('#incoming-task').first();
    const incomingTaskDiv2 = testManager.multiSessionAgent1Page.locator('#incoming-task').first();
    await incomingTaskDiv.waitFor({state: 'visible', timeout: 15000});
    await incomingTaskDiv2.waitFor({state: 'visible', timeout: 15000});
    await acceptIncomingTask(testManager.agent1Page, TASK_TYPES.EMAIL);
    await waitForState(testManager.agent1Page, USER_STATES.ENGAGED);
    await waitForState(testManager.multiSessionAgent1Page, USER_STATES.ENGAGED);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.ENGAGED);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.ENGAGED);
    await testManager.agent1Page.waitForTimeout(3000);
    const userStateElement = testManager.agent1Page.locator('#idleCodesDropdown');
    const userStateElementColor = await userStateElement.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(isColorClose(userStateElementColor, THEME_COLORS.ENGAGED)).toBe(true);
    const userStateElement2 = testManager.multiSessionAgent1Page.locator('#idleCodesDropdown');
    const userStateElementColor2 = await userStateElement2.evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(isColorClose(userStateElementColor2, THEME_COLORS.ENGAGED)).toBe(true);
    await expect(incomingTaskDiv).toBeHidden();
    await expect(incomingTaskDiv2).toBeHidden();
    await testManager.multiSessionAgent1Page.locator('#end').first().click({timeout: 5000});
    await submitWrapup(testManager.agent1Page, WRAPUP_REASONS.SALE);
    await waitForState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await waitForState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
  });

  test.afterAll(async () => {
    await testManager.cleanup();
  });
}
