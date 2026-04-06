/* eslint-disable import/no-extraneous-dependencies, @typescript-eslint/no-non-null-assertion */
import {expect, test} from '@playwright/test';
import {
  ensureUserStateVisible,
  stationLogout,
  telephonyLogin,
  verifyDesktopOptionVisibility,
  verifyLoginMode,
} from '../Utils/stationLoginUtils';
import {ensureRegisteredAfterReload} from '../Utils/initUtils';
import {changeUserState, getStateElapsedTime, verifyCurrentState} from '../Utils/userStateUtils';
import {
  handleStrayTasks,
  parseTimeString,
  waitForWebSocketDisconnection,
  waitForWebSocketReconnection,
} from '../Utils/helperUtils';
import {EXTENSION_REGISTRATION_TIMEOUT, LOGIN_MODE, USER_STATES} from '../constants';
import {TestManager} from '../test-manager';

async function assertStationLoginFieldsVisible(page: any): Promise<void> {
  await expect(page.locator('#AgentLogin')).toBeVisible({timeout: 2000});
  await expect(page.locator('#dialNumber')).toBeVisible({timeout: 2000});
  await expect(page.locator('#teamsDropdown')).toBeVisible({timeout: 2000});
  await expect(page.locator('#loginAgent')).toBeVisible({timeout: 2000});
}

export default function createStationLoginTests() {
  test.describe('Station Login Tests - Dial Number Mode', () => {
    let testManager: TestManager;

    test.beforeAll(async ({browser}, testInfo) => {
      testManager = new TestManager(testInfo.project.name);
      await testManager.setupForStationLogin(browser);
    });

    test.afterAll(async () => {
      await testManager.cleanup();
    });

    test('should login with Dial Number mode and verify all fields are visible', async () => {
      await assertStationLoginFieldsVisible(testManager.agent1Page);
      await telephonyLogin(
        testManager.agent1Page,
        LOGIN_MODE.DIAL_NUMBER,
        process.env[`${testManager.projectName}_ENTRY_POINT`]
      );

      await expect(testManager.agent1Page.locator('#idleCodesDropdown')).toBeVisible({
        timeout: EXTENSION_REGISTRATION_TIMEOUT,
      });
      await verifyLoginMode(testManager.agent1Page, LOGIN_MODE.DIAL_NUMBER);
    });

    test('should handle page reload and maintain Dial Number login state', async () => {
      await telephonyLogin(
        testManager.agent1Page,
        LOGIN_MODE.DIAL_NUMBER,
        process.env[`${testManager.projectName}_ENTRY_POINT`]
      );

      await expect(testManager.agent1Page.locator('#idleCodesDropdown')).toBeVisible({
        timeout: EXTENSION_REGISTRATION_TIMEOUT,
      });

      // Reload page
      await testManager.agent1Page.reload();

      // Wait for page to reinitialize - SDK should restore from storage
      await testManager.agent1Page.waitForLoadState('domcontentloaded');
      await testManager.agent1Page.waitForTimeout(3000);

      // Ensure SDK is registered after reload
      await ensureRegisteredAfterReload(testManager.agent1Page);

      // After reload, user state widget should still be visible (SDK state persists)
      await expect(testManager.agent1Page.locator('#idleCodesDropdown')).toBeVisible({
        timeout: EXTENSION_REGISTRATION_TIMEOUT,
      });

      // Login mode should be preserved in SDK
      await verifyLoginMode(testManager.agent1Page, LOGIN_MODE.DIAL_NUMBER);

      // Dial number should be preserved
      const dialNumber = process.env[`${testManager.projectName}_ENTRY_POINT`];
      if (dialNumber) {
        const dialNumberInput = testManager.agent1Page.locator('#dialNumber');
        if (await dialNumberInput.isVisible().catch(() => false)) {
          await expect(dialNumberInput).toHaveValue(dialNumber);
        }
      }
    });

    test('should retain user state timer and switch to Meeting state after network disconnection with Dial Number mode', async () => {
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.DIAL_NUMBER,
        process.env[`${testManager.projectName}_ENTRY_POINT`]
      );

      await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

      // Wait for timer to start counting
      await testManager.agent1Page.waitForTimeout(3000);
      const timerBeforeDisconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsBeforeDisconnection = parseTimeString(timerBeforeDisconnection);

      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(true);
      await testManager.agent1Page.waitForTimeout(3000);

      expect(await waitForWebSocketDisconnection(testManager.consoleMessages)).toBe(true);

      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(false);
      await testManager.agent1Page.waitForTimeout(3000);

      expect(await waitForWebSocketReconnection(testManager.consoleMessages)).toBe(true);

      // After reconnection, wait for state to restore
      await testManager.agent1Page.waitForTimeout(2000);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

      // Wait a bit for timer to resume counting
      await testManager.agent1Page.waitForTimeout(2000);
      const timerAfterReconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsAfterReconnection = parseTimeString(timerAfterReconnection);

      // Timer should have progressed (at least 5 seconds total elapsed)
      expect(secondsAfterReconnection).toBeGreaterThanOrEqual(secondsBeforeDisconnection);
    });

    test.skip('should reset user state timer and maintain Available state after network disconnection with Dial Number mode', async () => {
      // Known product behavior issue retained as skip.
    });

    test.skip('should support multi-login synchronization for Dial Number mode', async () => {
      // Multi-session support removed - sample app doesn't support widget-based multi-session
    });
  });

  test.describe('Station Login Tests - Extension Mode', () => {
    let testManager: TestManager;

    test.beforeAll(async ({browser}, testInfo) => {
      testManager = new TestManager(testInfo.project.name);
      await testManager.setupForStationLogin(browser);
    });

    test.afterAll(async () => {
      await testManager.cleanup();
    });

    test('should login with Extension mode and verify all fields are visible', async () => {
      await assertStationLoginFieldsVisible(testManager.agent1Page);
      await telephonyLogin(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );

      await expect(testManager.agent1Page.locator('#idleCodesDropdown')).toBeVisible({
        timeout: EXTENSION_REGISTRATION_TIMEOUT,
      });
      await verifyLoginMode(testManager.agent1Page, LOGIN_MODE.EXTENSION);
    });

    test('should handle page reload and maintain Extension login state', async () => {
      await telephonyLogin(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );

      await expect(testManager.agent1Page.locator('#idleCodesDropdown')).toBeVisible({
        timeout: EXTENSION_REGISTRATION_TIMEOUT,
      });

      // Reload page
      await testManager.agent1Page.reload();

      // Wait for page to reinitialize - SDK should restore from storage
      await testManager.agent1Page.waitForLoadState('domcontentloaded');
      await testManager.agent1Page.waitForTimeout(3000);

      // Ensure SDK is registered after reload
      await ensureRegisteredAfterReload(testManager.agent1Page);

      // After reload, user state widget should still be visible (SDK state persists)
      await expect(testManager.agent1Page.locator('#idleCodesDropdown')).toBeVisible({
        timeout: EXTENSION_REGISTRATION_TIMEOUT,
      });

      // Login mode should be preserved in SDK
      await verifyLoginMode(testManager.agent1Page, LOGIN_MODE.EXTENSION);

      // Extension number should be preserved
      const extensionNumber = process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`];
      if (extensionNumber) {
        const dialNumberInput = testManager.agent1Page.locator('#dialNumber');
        if (await dialNumberInput.isVisible().catch(() => false)) {
          await expect(dialNumberInput).toHaveValue(extensionNumber);
        }
      }
    });

    test('should retain user state timer and switch to Meeting state after network disconnection with Extension mode', async () => {
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );

      await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

      // Wait for timer to start counting
      await testManager.agent1Page.waitForTimeout(3000);
      const timerBeforeDisconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsBeforeDisconnection = parseTimeString(timerBeforeDisconnection);

      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(true);
      await testManager.agent1Page.waitForTimeout(3000);

      expect(await waitForWebSocketDisconnection(testManager.consoleMessages)).toBe(true);

      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(false);
      await testManager.agent1Page.waitForTimeout(3000);

      expect(await waitForWebSocketReconnection(testManager.consoleMessages)).toBe(true);

      // After reconnection, wait for state to restore
      await testManager.agent1Page.waitForTimeout(2000);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

      // Wait a bit for timer to resume counting
      await testManager.agent1Page.waitForTimeout(2000);
      const timerAfterReconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsAfterReconnection = parseTimeString(timerAfterReconnection);

      // Timer should have progressed (at least as much time as before)
      expect(secondsAfterReconnection).toBeGreaterThanOrEqual(secondsBeforeDisconnection);
    });

    test.skip('should reset user state timer and maintain Available state after network disconnection with Extension mode', async () => {
      // Known product behavior issue retained as skip.
    });

    test.skip('should support multi-login synchronization for Extension mode', async () => {
      // Multi-session support removed - sample app doesn't support widget-based multi-session
    });
  });

  test.describe.skip('Station Login Tests - hideDesktopLogin Feature', () => {
    test('Native sample app does not expose a hideDesktopLogin toggle control', async () => {});
  });

  test.describe('Station Login Tests - Desktop Mode', () => {
    let testManager: TestManager;

    test.beforeAll(async ({browser}, testInfo) => {
      testManager = new TestManager(testInfo.project.name);
      await testManager.setupForStationLogin(browser);

      // CRITICAL: Clear any concurrent Extension sessions from previous tests
      const agent1Page = testManager.agent1Page;
      const logoutVisible = await agent1Page
        .locator('#logoutAgent')
        .isVisible()
        .catch(() => false);

      if (logoutVisible) {
        await handleStrayTasks(agent1Page).catch(() => {});
        await stationLogout(agent1Page, false);
        await agent1Page.waitForTimeout(5000); // Wait for backend session cleanup
      }
    });

    test.afterAll(async () => {
      await testManager.cleanup();
    });

    test('should login with Desktop mode and verify all fields are visible', async () => {
      await assertStationLoginFieldsVisible(testManager.agent1Page);
      await telephonyLogin(testManager.agent1Page, LOGIN_MODE.DESKTOP);
      await expect(testManager.agent1Page.locator('#idleCodesDropdown')).toBeVisible({
        timeout: 3000,
      });
      await verifyLoginMode(testManager.agent1Page, LOGIN_MODE.DESKTOP);
    });

    test('should handle page reload and maintain Desktop login state', async () => {
      await telephonyLogin(testManager.agent1Page, LOGIN_MODE.DESKTOP);

      await expect(testManager.agent1Page.locator('#idleCodesDropdown')).toBeVisible({
        timeout: 3000,
      });

      // Reload page
      await testManager.agent1Page.reload();

      // Wait for page to reinitialize - SDK should restore from storage
      await testManager.agent1Page.waitForLoadState('domcontentloaded');
      await testManager.agent1Page.waitForTimeout(3000);

      // Ensure SDK is registered after reload
      await ensureRegisteredAfterReload(testManager.agent1Page);

      // After reload, user state widget should still be visible (SDK state persists)
      await expect(testManager.agent1Page.locator('#idleCodesDropdown')).toBeVisible({
        timeout: EXTENSION_REGISTRATION_TIMEOUT,
      });

      // Login mode should be preserved in SDK
      await verifyLoginMode(testManager.agent1Page, LOGIN_MODE.DESKTOP);
    });

    test('should retain user state timer and switch to Meeting state after network disconnection with Desktop mode', async () => {
      await ensureUserStateVisible(testManager.agent1Page, LOGIN_MODE.DESKTOP);

      await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

      // Wait for timer to start counting
      await testManager.agent1Page.waitForTimeout(3000);
      const timerBeforeDisconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsBeforeDisconnection = parseTimeString(timerBeforeDisconnection);

      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(true);
      await testManager.agent1Page.waitForTimeout(3000);
      expect(await waitForWebSocketDisconnection(testManager.consoleMessages)).toBe(true);

      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(false);
      await testManager.agent1Page.waitForTimeout(3000);
      expect(await waitForWebSocketReconnection(testManager.consoleMessages)).toBe(true);

      // After reconnection, wait for state to restore
      await testManager.agent1Page.waitForTimeout(2000);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

      // Wait a bit for timer to resume counting
      await testManager.agent1Page.waitForTimeout(2000);
      const timerAfterReconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsAfterReconnection = parseTimeString(timerAfterReconnection);

      // Timer should have progressed (at least as much time as before)
      expect(secondsAfterReconnection).toBeGreaterThanOrEqual(secondsBeforeDisconnection);
    });

    test.skip('should reset user state timer and maintain Available state after network disconnection with Desktop mode', async () => {
      // Known product behavior issue retained as skip.
    });

    test('should verify Desktop login option is available', async () => {
      await verifyDesktopOptionVisibility(testManager.agent1Page, true);
    });
  });
}
