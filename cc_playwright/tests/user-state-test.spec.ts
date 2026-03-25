import {test, expect} from '@playwright/test';
import {stationLogout, telephonyLogin} from '../Utils/stationLoginUtils';
import {
  getCurrentState,
  changeUserState,
  verifyCurrentState,
  getStateElapsedTime,
  checkCallbackSequence,
} from '../Utils/userStateUtils';
import {ensureRegisteredAfterReload} from '../Utils/initUtils';
import {USER_STATES, LOGIN_MODE} from '../constants';
import {TestManager} from '../test-manager';

export default function createUserStateTests() {
  let testManager: TestManager;

  test.beforeAll(async ({browser}, testInfo) => {
    const projectName = testInfo.project.name;
    testManager = new TestManager(projectName);
    await testManager.basicSetup(browser);
    // Handle the station login manually like in the original
    const loginButtonExists = await testManager.agent1Page
      .locator('#loginAgent')
      .isVisible()
      .catch(() => false);
    if (loginButtonExists) {
      await telephonyLogin(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );
    } else {
      await stationLogout(testManager.agent1Page, false); // Don't throw during setup
      await telephonyLogin(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );
    }
    await expect(testManager.agent1Page.locator('#idleCodesDropdown')).toBeVisible();
  });

  test.afterAll(async () => {
    if (testManager) {
      await testManager.cleanup();
    }
  });

  test('should verify initial state is Meeting', async () => {
    const state = await getCurrentState(testManager.agent1Page);
    if (state !== USER_STATES.MEETING) throw new Error('Initial state is not Meeting');
  });

  test.skip('should verify Meeting state theme color', async () => {
    // Sample app doesn't implement widget theme system - theme colors not available
    // See MIGRATION.md for details
  });

  test('should change state to Available and verify timer reset', async () => {
    const parseTimer = (timer: string) => {
      const parts = timer.split(':');

      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };

    // Explicitly set MEETING state
    await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

    // Wait for timer to be visible and populated
    await testManager.agent1Page.waitForTimeout(3000);

    const timerBefore = await getStateElapsedTime(testManager.agent1Page);
    const secondsBefore = parseTimer(timerBefore);

    // Change state to Available
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);

    const timerAfter = await getStateElapsedTime(testManager.agent1Page);
    const secondsAfter = parseTimer(timerAfter);

    // Timer resets on state change, so after should be less than or equal to before
    expect(secondsAfter).toBeLessThanOrEqual(secondsBefore);
    // Theme color assertion removed - sample app doesn't implement widget theme system
  });

  test('should verify existence and order in which callback and API success are logged for Available state', async () => {
    await changeUserState(testManager.agent1Page, USER_STATES.MEETING);

    // Wait for state change to complete AND verify it succeeded
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
    await testManager.agent1Page.waitForTimeout(3000);

    // Clear console messages before the state change we want to test
    testManager.consoleMessages.length = 0;

    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);

    // checkCallbackSequence polls for messages with 10s timeout - no additional wait needed
    const isCallbackSuccessful = await checkCallbackSequence(
      testManager.agent1Page,
      USER_STATES.AVAILABLE,
      testManager.consoleMessages
    );

    expect(isCallbackSuccessful).toBe(true);
  });

  test('should verify state persistence after page reload', async () => {
    // Set state to Available
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(3000);

    // Reload the page
    await testManager.agent1Page.reload();
    await testManager.agent1Page.waitForLoadState('domcontentloaded');
    await testManager.agent1Page.waitForTimeout(3000);

    // Ensure SDK is registered after reload
    await ensureRegisteredAfterReload(testManager.agent1Page);

    // Wait for idle codes dropdown to be visible
    const idleCodesDropdown = testManager.agent1Page.locator('#idleCodesDropdown');
    await expect(idleCodesDropdown).toBeVisible({timeout: 10000});

    // Wait for state to be restored
    await testManager.agent1Page.waitForTimeout(3000);

    // Verify state was restored to Available
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
  });

  test('should test multi-session synchronization', async () => {
    // Create multi-session page since basicSetup doesn't include it
    if (!testManager.multiSessionAgent1Page) {
      if (!testManager.multiSessionContext) {
        testManager.multiSessionContext = await testManager.agent1Context.browser()!.newContext();
      }
      testManager.multiSessionAgent1Page = await testManager.multiSessionContext.newPage();
    }

    await testManager.setupMultiSessionPage();
    const multiSessionPage = testManager.multiSessionAgent1Page!;

    await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
    await multiSessionPage.waitForTimeout(3000);

    await verifyCurrentState(multiSessionPage, USER_STATES.MEETING);

    await multiSessionPage.waitForTimeout(3000);
    const [timer1, timer2] = await Promise.all([
      getStateElapsedTime(testManager.agent1Page),
      getStateElapsedTime(multiSessionPage),
    ]);

    // Parse the timers to compare
    const parseTimer = (timer: string) => {
      const parts = timer.split(':');

      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };
    const timer1Parsed = parseTimer(timer1);
    const timer2Parsed = parseTimer(timer2);

    if (Math.abs(timer1Parsed - timer2Parsed) > 1) {
      throw new Error(
        `Multi-session timer synchronization failed: Primary=${timer1Parsed}, Secondary=${timer2Parsed}`
      );
    }
  });

  test.skip('should test idle state transition and dual timer', async () => {
    // Sample app doesn't emit widget-specific console log patterns
    // (onStateChange invoked with state name:)
    // Dual timer functionality can be validated without console logs if needed
  });
}
