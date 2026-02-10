import {test, expect} from '@playwright/test';
import {agentRelogin} from '../Utils/initUtils';
import {
  telephonyLogin,
  verifyLoginMode,
  ensureUserStateVisible,
  verifyDesktopOptionVisibility,
} from '../Utils/stationLoginUtils';
import {changeUserState, verifyCurrentState, getStateElapsedTime} from '../Utils/userStateUtils';
import {parseTimeString, waitForWebSocketDisconnection, waitForWebSocketReconnection} from '../Utils/helperUtils';
import {USER_STATES, LOGIN_MODE, LONG_WAIT} from '../constants';
import {TestManager} from '../test-manager';

export default function createStationLoginTests() {
  test.describe('Station Login Tests - Dial Number Mode', () => {
    let testManager: TestManager;

    test.beforeAll(async ({browser}, testInfo) => {
      const projectName = testInfo.project.name;
      testManager = new TestManager(projectName);
      await testManager.setupForStationLogin(browser);
    });

    test.afterAll(async () => {
      if (testManager) {
        await testManager.cleanup();
      }
    });

    test('should login with Dial Number mode and verify all fields are visible', async () => {
      await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
      const loginModeSelector = testManager.agent1Page.getByTestId('login-option-select');
      await expect(loginModeSelector).toBeVisible({timeout: 2000});
      const phoneNumberInput = testManager.agent1Page.getByTestId('dial-number-input');
      await expect(phoneNumberInput).toBeVisible({timeout: 2000});
      const teamSelectionDropdown = testManager.agent1Page.getByTestId('teams-select-dropdown');
      await expect(teamSelectionDropdown).toBeVisible({timeout: 2000});
      const loginButton = testManager.agent1Page.getByTestId('login-button');
      await expect(loginButton).toBeVisible({timeout: 2000});
      await expect(loginButton).toContainText('Login');
      await telephonyLogin(
        testManager.agent1Page,
        LOGIN_MODE.DIAL_NUMBER,
        process.env[`${testManager.projectName}_ENTRY_POINT`]
      );
      await expect(testManager.agent1Page.getByTestId('state-select')).toBeVisible({timeout: LONG_WAIT});
      await verifyLoginMode(testManager.agent1Page, 'Dial Number');
    });

    test('should handle page reload and maintain Dial Number login state', async () => {
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.DIAL_NUMBER,
        process.env[`${testManager.projectName}_ENTRY_POINT`]
      );
      await agentRelogin(testManager.agent1Page);
      await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
      await verifyLoginMode(testManager.agent1Page, 'Dial Number');
      const dialNumber = process.env[`${testManager.projectName}_ENTRY_POINT`];
      if (dialNumber) {
        await expect(testManager.agent1Page.getByTestId('dial-number-input').locator('input')).toHaveValue(dialNumber);
      }
      await expect(testManager.agent1Page.getByTestId('state-select')).toBeVisible({timeout: 2000});
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
      await testManager.agent1Page.waitForTimeout(3000);
      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(true);
      await testManager.agent1Page.waitForTimeout(3000);
      const isWebSocketDisconnected = await waitForWebSocketDisconnection(testManager.consoleMessages);
      expect(isWebSocketDisconnected).toBe(true);
      await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
      await verifyLoginMode(testManager.agent1Page, 'Dial Number');
      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(false);
      await testManager.agent1Page.waitForTimeout(3000);
      const isWebSocketReconnected = await waitForWebSocketReconnection(testManager.consoleMessages);
      expect(isWebSocketReconnected).toBe(true);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
      const timerAfterReconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsAfterReconnection = parseTimeString(timerAfterReconnection);
      expect(secondsAfterReconnection).toBeGreaterThan(secondsBeforeDisconnection);
      await verifyLoginMode(testManager.agent1Page, 'Dial Number');
    });

    // TODO: The bug of timer reset for Available state should be fixed before implementing this test case
    test.skip('should reset user state timer and maintain Available state after network disconnection with Dial Number mode', async () => {
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.DIAL_NUMBER,
        process.env[`${testManager.projectName}_ENTRY_POINT`]
      );
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(15000);
      const timerBeforeDisconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsBeforeDisconnection = parseTimeString(timerBeforeDisconnection);
      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(true);
      const isWebSocketDisconnected = await waitForWebSocketDisconnection(testManager.consoleMessages);
      expect(isWebSocketDisconnected).toBe(true);
      await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
      await verifyLoginMode(testManager.agent1Page, 'Dial Number');
      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(false);
      const isWebSocketReconnected = await waitForWebSocketReconnection(testManager.consoleMessages);
      expect(isWebSocketReconnected).toBe(true);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
      const timerAfterReconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsAfterReconnection = parseTimeString(timerAfterReconnection);
      expect(secondsAfterReconnection).toBeLessThan(secondsBeforeDisconnection);
      await testManager.agent1Page.waitForTimeout(10000);
      const agentStateChangeLog = testManager.consoleMessages.find(
        (msg) => msg.includes('AGENT Status set successfully') || msg.includes('Agent state changed successfully')
      );
      expect(agentStateChangeLog).toBeTruthy();
      await verifyLoginMode(testManager.agent1Page, 'Dial Number');
    });

    test('should support multi-login synchronization for Dial Number Mode ', async () => {
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.DIAL_NUMBER,
        process.env[`${testManager.projectName}_ENTRY_POINT`]
      );

      const multiSessionPage = testManager.multiSessionAgent1Page!;
      await verifyLoginMode(multiSessionPage, 'Dial Number');
      //Verify if signing out from one session logs out the other session
      await multiSessionPage.getByTestId('samples:station-logout-button').click();
      await testManager.agent1Page.waitForTimeout(2000);
      const isLogoutButtonVisible = await testManager.agent1Page
        .getByTestId('samples:station-logout-button')
        .isVisible()
        .catch(() => false);
      expect(isLogoutButtonVisible).toBe(false);
    });
  });

  test.describe.skip('Station Login Tests - Extension Mode', () => {
    let testManager: TestManager;

    test.beforeAll(async ({browser}, testInfo) => {
      const projectName = testInfo.project.name;
      testManager = new TestManager(projectName);
      await testManager.setupForStationLogin(browser);
    });

    test.afterAll(async () => {
      if (testManager) {
        await testManager.cleanup();
      }
    });

    test('should login with Extension mode and verify all fields are visible', async () => {
      await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
      const loginModeSelector = testManager.agent1Page.getByTestId('login-option-select');
      await expect(loginModeSelector).toBeVisible({timeout: 2000});
      const phoneNumberInput = testManager.agent1Page.getByTestId('dial-number-input');
      await expect(phoneNumberInput).toBeVisible({timeout: 2000});
      const teamSelectionDropdown = testManager.agent1Page.getByTestId('teams-select-dropdown');
      await expect(teamSelectionDropdown).toBeVisible({timeout: 2000});
      const loginButton = testManager.agent1Page.getByTestId('login-button');
      await expect(loginButton).toBeVisible({timeout: 2000});
      await expect(loginButton).toContainText('Login');
      await telephonyLogin(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );
      await expect(testManager.agent1Page.getByTestId('state-select')).toBeVisible({timeout: LONG_WAIT});
      await verifyLoginMode(testManager.agent1Page, 'Extension');
    });

    test('should handle page reload and maintain Extension login state', async () => {
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );
      await agentRelogin(testManager.agent1Page);
      await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
      await verifyLoginMode(testManager.agent1Page, 'Extension');
      const extensionNumber = process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`];
      if (extensionNumber) {
        await expect(testManager.agent1Page.getByTestId('dial-number-input').locator('input')).toHaveValue(
          extensionNumber
        );
      }
      await expect(testManager.agent1Page.getByTestId('state-select')).toBeVisible({timeout: 2000});
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
      await testManager.agent1Page.waitForTimeout(3000);
      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(true);
      await testManager.agent1Page.waitForTimeout(3000);
      const isWebSocketDisconnected = await waitForWebSocketDisconnection(testManager.consoleMessages);
      expect(isWebSocketDisconnected).toBe(true);
      await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
      await verifyLoginMode(testManager.agent1Page, 'Extension');
      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(false);
      await testManager.agent1Page.waitForTimeout(3000);
      const isWebSocketReconnected = await waitForWebSocketReconnection(testManager.consoleMessages);
      expect(isWebSocketReconnected).toBe(true);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
      const timerAfterReconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsAfterReconnection = parseTimeString(timerAfterReconnection);
      expect(secondsAfterReconnection).toBeGreaterThan(secondsBeforeDisconnection);
      await verifyLoginMode(testManager.agent1Page, 'Extension');
    });

    // TODO: The bug of timer reset for Available state should be fixed before implementing this test case
    test.skip('should reset user state timer and maintain Available state after network disconnection with Extension mode', async () => {
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(15000);
      const timerBeforeDisconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsBeforeDisconnection = parseTimeString(timerBeforeDisconnection);
      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(true);
      const isWebSocketDisconnected = await waitForWebSocketDisconnection(testManager.consoleMessages);
      expect(isWebSocketDisconnected).toBe(true);
      await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
      await verifyLoginMode(testManager.agent1Page, 'Extension');
      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(false);
      const isWebSocketReconnected = await waitForWebSocketReconnection(testManager.consoleMessages);
      expect(isWebSocketReconnected).toBe(true);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
      const timerAfterReconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsAfterReconnection = parseTimeString(timerAfterReconnection);
      expect(secondsAfterReconnection).toBeLessThan(secondsBeforeDisconnection);
      await testManager.agent1Page.waitForTimeout(10000);
      const agentStateChangeLog = testManager.consoleMessages.find(
        (msg) => msg.includes('AGENT Status set successfully') || msg.includes('Agent state changed successfully')
      );
      expect(agentStateChangeLog).toBeTruthy();
      await verifyLoginMode(testManager.agent1Page, 'Extension');
    });

    test('should support multi-login synchronization for Extension Mode', async () => {
      await ensureUserStateVisible(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );

      const multiSessionPage = testManager.multiSessionAgent1Page!;
      await verifyLoginMode(multiSessionPage, 'Extension');
      await multiSessionPage.getByTestId('samples:station-logout-button').click();
      await testManager.agent1Page.waitForTimeout(2000);
      const isLogoutButtonVisible = await testManager.agent1Page
        .getByTestId('samples:station-logout-button')
        .isVisible()
        .catch(() => false);
      expect(isLogoutButtonVisible).toBe(false);
    });
  });

  test.describe.skip('Station Login Tests - hideDesktopLogin Feature', () => {
    let testManager: TestManager;

    test.beforeAll(async ({browser}, testInfo) => {
      const projectName = testInfo.project.name;
      testManager = new TestManager(projectName);
      await testManager.setupForStationLogin(browser, false);
    });

    test.afterAll(async () => {
      if (testManager) {
        await testManager.cleanup();
      }
    });

    test('should toggle Desktop option visibility when hideDesktopLogin checkbox is toggled', async () => {
      await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
      const hideDesktopCheckbox = testManager.agent1Page.getByTestId('samples:hide-desktop-login-checkbox');

      // Uncheck - Desktop should be visible
      await hideDesktopCheckbox.click();
      await testManager.agent1Page.waitForTimeout(500);
      await verifyDesktopOptionVisibility(testManager.agent1Page, true);

      // Check - Desktop should be hidden
      await hideDesktopCheckbox.click();
      await testManager.agent1Page.waitForTimeout(500);
      await verifyDesktopOptionVisibility(testManager.agent1Page, false);

      // Uncheck again - Desktop should be visible again
      await hideDesktopCheckbox.click();
      await testManager.agent1Page.waitForTimeout(500);
      await verifyDesktopOptionVisibility(testManager.agent1Page, true);
    });
  });
  test.describe.skip('Station Login Tests - Desktop Mode', () => {
    let testManager: TestManager;

    test.beforeAll(async ({browser}, testInfo) => {
      const projectName = testInfo.project.name;
      testManager = new TestManager(projectName);
      await testManager.setupForStationLogin(browser, true);
    });

    test.afterAll(async () => {
      if (testManager) {
        await testManager.cleanup();
      }
    });

    test('should login with Desktop mode and verify all fields are visible', async () => {
      await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
      const loginModeSelector = testManager.agent1Page.getByTestId('login-option-select');
      await expect(loginModeSelector).toBeVisible({timeout: 2000});
      const teamSelectionDropdown = testManager.agent1Page.getByTestId('teams-select-dropdown');
      await expect(teamSelectionDropdown).toBeVisible({timeout: 2000});
      const loginButton = testManager.agent1Page.getByTestId('login-button');
      await expect(loginButton).toBeVisible({timeout: 2000});
      await expect(loginButton).toContainText('Login');
      await telephonyLogin(testManager.agent1Page, LOGIN_MODE.DESKTOP);
      await expect(testManager.agent1Page.getByTestId('state-select')).toBeVisible({timeout: 3000});
      await verifyLoginMode(testManager.agent1Page, 'Desktop');
    });

    test.skip('should handle page reload and maintain Desktop login state', async () => {
      await ensureUserStateVisible(testManager.agent1Page, LOGIN_MODE.DESKTOP);
      await agentRelogin(testManager.agent1Page);
      await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
      await verifyLoginMode(testManager.agent1Page, 'Desktop');
      await expect(testManager.agent1Page.getByTestId('state-select')).toBeVisible({timeout: 2000});
    });

    test('should retain user state timer and switch to Meeting state after network disconnection with Desktop mode', async () => {
      await ensureUserStateVisible(testManager.agent1Page, LOGIN_MODE.DESKTOP);
      await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
      const timerBeforeDisconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsBeforeDisconnection = parseTimeString(timerBeforeDisconnection);
      await testManager.agent1Page.waitForTimeout(3000);
      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(true);
      const isWebSocketDisconnected = await waitForWebSocketDisconnection(testManager.consoleMessages);
      expect(isWebSocketDisconnected).toBe(true);
      await testManager.agent1Page.waitForTimeout(3000);
      await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
      await verifyLoginMode(testManager.agent1Page, 'Desktop');
      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(false);
      await testManager.agent1Page.waitForTimeout(3000);
      const isWebSocketReconnected = await waitForWebSocketReconnection(testManager.consoleMessages);
      expect(isWebSocketReconnected).toBe(true);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
      const timerAfterReconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsAfterReconnection = parseTimeString(timerAfterReconnection);
      expect(secondsAfterReconnection).toBeGreaterThan(secondsBeforeDisconnection);
      await verifyLoginMode(testManager.agent1Page, 'Desktop');
    });

    // TODO: The bug of timer reset for Available state should be fixed before implementing this test case
    test.skip('should reset user state timer and maintain Available state after network disconnection with Desktop mode', async () => {
      await ensureUserStateVisible(testManager.agent1Page, LOGIN_MODE.DESKTOP);
      await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
      await testManager.agent1Page.waitForTimeout(15000);
      const timerBeforeDisconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsBeforeDisconnection = parseTimeString(timerBeforeDisconnection);
      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(true);
      const isWebSocketDisconnected = await waitForWebSocketDisconnection(testManager.consoleMessages);
      expect(isWebSocketDisconnected).toBe(true);
      await expect(testManager.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: 2000});
      await verifyLoginMode(testManager.agent1Page, 'Desktop');
      testManager.consoleMessages.length = 0;
      await testManager.agent1Page.context().setOffline(false);
      const isWebSocketReconnected = await waitForWebSocketReconnection(testManager.consoleMessages);
      expect(isWebSocketReconnected).toBe(true);
      await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
      const timerAfterReconnection = await getStateElapsedTime(testManager.agent1Page);
      const secondsAfterReconnection = parseTimeString(timerAfterReconnection);
      expect(secondsAfterReconnection).toBeLessThan(secondsBeforeDisconnection);
      await testManager.agent1Page.waitForTimeout(10000);
      const agentStateChangeLog = testManager.consoleMessages.find(
        (msg) => msg.includes('AGENT Status set successfully') || msg.includes('Agent state changed successfully')
      );
      expect(agentStateChangeLog).toBeTruthy();
      await verifyLoginMode(testManager.agent1Page, 'Desktop');
    });
  });
}
