/* eslint-disable import/no-extraneous-dependencies, @typescript-eslint/no-non-null-assertion */
import {expect, test} from '@playwright/test';
import {agentRelogin} from '../Utils/initUtils';
import {
  ensureUserStateVisible,
  telephonyLogin,
  verifyDesktopOptionVisibility,
  verifyLoginMode,
} from '../Utils/stationLoginUtils';
import {changeUserState, getStateElapsedTime, verifyCurrentState} from '../Utils/userStateUtils';
import {
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
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.DIAL_NUMBER,
        process.env[`${testManager.projectName}_ENTRY_POINT`]
      );

      await agentRelogin(testManager.agent1Page);
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.DIAL_NUMBER,
        process.env[`${testManager.projectName}_ENTRY_POINT`]
      );

      await expect(testManager.agent1Page.locator('#AgentLogin')).toBeVisible({timeout: 2000});
      await verifyLoginMode(testManager.agent1Page, LOGIN_MODE.DIAL_NUMBER);

      const dialNumber = process.env[`${testManager.projectName}_ENTRY_POINT`];
      if (dialNumber) {
        await expect(testManager.agent1Page.locator('#dialNumber')).toHaveValue(dialNumber);
      }

      await expect(testManager.agent1Page.locator('#idleCodesDropdown')).toBeVisible({
        timeout: 5000,
      });
    });

    test('should retain user state timer and switch to Meeting state after network disconnection with Dial Number mode', async () => {
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.DIAL_NUMBER,
        process.env[`${testManager.projectName}_ENTRY_POINT`]
      );

      await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

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
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.DIAL_NUMBER,
        process.env[`${testManager.projectName}_ENTRY_POINT`]
      );
      await verifyLoginMode(testManager.agent1Page, LOGIN_MODE.DIAL_NUMBER);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

      const timerAfterReconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsAfterReconnection = parseTimeString(timerAfterReconnection);
      expect(secondsAfterReconnection).toBeGreaterThan(secondsBeforeDisconnection);
    });

    test.skip('should reset user state timer and maintain Available state after network disconnection with Dial Number mode', async () => {
      // Known product behavior issue retained as skip.
    });

    test('should support multi-login synchronization for Dial Number mode', async () => {
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.DIAL_NUMBER,
        process.env[`${testManager.projectName}_ENTRY_POINT`]
      );

      const multiSessionPage = testManager.multiSessionAgent1Page;
      expect(multiSessionPage).toBeTruthy();
      if (!multiSessionPage) {
        return;
      }

      await verifyLoginMode(multiSessionPage, LOGIN_MODE.DIAL_NUMBER);
      await multiSessionPage.locator('#logoutAgent').click();
      await testManager.agent1Page.waitForTimeout(2000);

      const stillVisible = await testManager.agent1Page
        .locator('#logoutAgent')
        .isVisible()
        .catch(() => false);
      expect(stillVisible).toBe(false);
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
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );

      await agentRelogin(testManager.agent1Page);
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );

      await expect(testManager.agent1Page.locator('#AgentLogin')).toBeVisible({timeout: 2000});
      await verifyLoginMode(testManager.agent1Page, LOGIN_MODE.EXTENSION);

      const extensionNumber = process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`];
      if (extensionNumber) {
        await expect(testManager.agent1Page.locator('#dialNumber')).toHaveValue(extensionNumber);
      }

      await expect(testManager.agent1Page.locator('#idleCodesDropdown')).toBeVisible({
        timeout: 5000,
      });
    });

    test('should retain user state timer and switch to Meeting state after network disconnection with Extension mode', async () => {
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );

      await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

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
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );
      await verifyLoginMode(testManager.agent1Page, LOGIN_MODE.EXTENSION);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

      const timerAfterReconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsAfterReconnection = parseTimeString(timerAfterReconnection);
      expect(secondsAfterReconnection).toBeGreaterThan(secondsBeforeDisconnection);
    });

    test.skip('should reset user state timer and maintain Available state after network disconnection with Extension mode', async () => {
      // Known product behavior issue retained as skip.
    });

    test('should support multi-login synchronization for Extension mode', async () => {
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );

      const multiSessionPage = testManager.multiSessionAgent1Page;
      expect(multiSessionPage).toBeTruthy();
      if (!multiSessionPage) {
        return;
      }

      await verifyLoginMode(multiSessionPage, LOGIN_MODE.EXTENSION);
      await multiSessionPage.locator('#logoutAgent').click();
      await testManager.agent1Page.waitForTimeout(2000);

      const stillVisible = await testManager.agent1Page
        .locator('#logoutAgent')
        .isVisible()
        .catch(() => false);
      expect(stillVisible).toBe(false);
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

    test.skip('should handle page reload and maintain Desktop login state', async () => {
      // Flaky in sample app; kept as skip for parity with previous suite behavior.
    });

    test('should retain user state timer and switch to Meeting state after network disconnection with Desktop mode', async () => {
      await ensureUserStateVisible(testManager.agent1Page, LOGIN_MODE.DESKTOP);
      await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

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

      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
      const timerAfterReconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsAfterReconnection = parseTimeString(timerAfterReconnection);
      expect(secondsAfterReconnection).toBeGreaterThan(secondsBeforeDisconnection);
    });

    test.skip('should reset user state timer and maintain Available state after network disconnection with Desktop mode', async () => {
      // Known product behavior issue retained as skip.
    });

    test('should verify Desktop login option is available', async () => {
      await verifyDesktopOptionVisibility(testManager.agent1Page, true);
    });
  });
}
