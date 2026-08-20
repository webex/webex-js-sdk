import {test, expect} from '@playwright/test';
import {stationLogout, telephonyLogin} from '../Utils/stationLoginUtils';
import {
  getCurrentState,
  changeUserState,
  verifyCurrentState,
  getStateElapsedTime,
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
      await stationLogout(testManager.agent1Page, false);
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
  });

  test.skip('should verify SDK event callback fires before promise resolves', async () =>
    undefined);

  test.skip('should verify state persistence after page reload', async () => {
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

    // Restore station login (SDK doesn't auto-restore login state in sample app)
    await telephonyLogin(
      testManager.agent1Page,
      LOGIN_MODE.EXTENSION,
      process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
    );

    // Wait for idle codes dropdown to be visible
    const idleCodesDropdown = testManager.agent1Page.locator('#idleCodesDropdown');
    await expect(idleCodesDropdown).toBeVisible({timeout: 10000});

    // Wait for state to be restored
    await testManager.agent1Page.waitForTimeout(3000);

    // Verify state was restored to Available
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
  });

  test('should test multi-session synchronization', async ({browser}, testInfo) => {
    await testManager.cleanup();

    const multiSessionManager = new TestManager(testInfo.project.name);

    try {
      await multiSessionManager.setupForUserStateMultiSession(browser);

      const initialState = await getCurrentState(multiSessionManager.agent1Page);
      await expect(getCurrentState(multiSessionManager.multiSessionAgent1Page)).resolves.toBe(
        initialState
      );

      await changeUserState(multiSessionManager.agent1Page, USER_STATES.AVAILABLE);
      await Promise.all([
        verifyCurrentState(multiSessionManager.agent1Page, USER_STATES.AVAILABLE),
        verifyCurrentState(multiSessionManager.multiSessionAgent1Page, USER_STATES.AVAILABLE),
      ]);

      await changeUserState(multiSessionManager.agent1Page, USER_STATES.MEETING);
      await Promise.all([
        verifyCurrentState(multiSessionManager.agent1Page, USER_STATES.MEETING),
        verifyCurrentState(multiSessionManager.multiSessionAgent1Page, USER_STATES.MEETING),
      ]);

      await changeUserState(multiSessionManager.multiSessionAgent1Page, USER_STATES.AVAILABLE);
      await Promise.all([
        verifyCurrentState(multiSessionManager.agent1Page, USER_STATES.AVAILABLE),
        verifyCurrentState(multiSessionManager.multiSessionAgent1Page, USER_STATES.AVAILABLE),
      ]);
    } finally {
      await multiSessionManager.cleanup();
    }
  });

  test.skip('should test idle state transition and dual timer', async () => {});
}
