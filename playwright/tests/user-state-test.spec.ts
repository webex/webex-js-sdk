/* eslint-disable import/no-extraneous-dependencies, @typescript-eslint/no-non-null-assertion */
import {expect, test} from '@playwright/test';
import {agentRelogin} from '../Utils/initUtils';
import {stationLogout, telephonyLogin} from '../Utils/stationLoginUtils';
import {
  changeUserState,
  checkCallbackSequence,
  getCurrentState,
  getStateElapsedTime,
  validateConsoleStateChange,
  verifyCurrentState,
} from '../Utils/userStateUtils';
import {LOGIN_MODE, THEME_COLORS, USER_STATES} from '../constants';
import {TestManager} from '../test-manager';

export default function createUserStateTests() {
  let testManager: TestManager;

  test.beforeAll(async ({browser}, testInfo) => {
    testManager = new TestManager(testInfo.project.name);
    await testManager.basicSetup(browser);

    const loginVisible = await testManager.agent1Page
      .locator('#loginAgent')
      .isVisible()
      .catch(() => false);
    if (loginVisible) {
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
    await testManager.cleanup();
  });

  test('should verify initial state is Meeting', async () => {
    const state = await getCurrentState(testManager.agent1Page);
    expect(state.toLowerCase()).toBe(USER_STATES.MEETING.toLowerCase());
  });

  test('should verify Meeting state theme color', async () => {
    const color = await testManager.agent1Page
      .locator('#idleCodesDropdown')
      .evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(color).toBe(THEME_COLORS.MEETING);
  });

  test('should change state to Available and verify theme and timer reset', async () => {
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
    await testManager.agent1Page.waitForTimeout(10000);

    const timerBefore = await getStateElapsedTime(testManager.agent1Page);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    const timerAfter = await getStateElapsedTime(testManager.agent1Page);

    const toSeconds = (value: string) => {
      const parts = value
        .split(' / ')[0]
        .split(':')
        .map((part) => Number.parseInt(part, 10) || 0);
      const [hh, mm, ss] = parts.length === 3 ? parts : [0, parts[0], parts[1]];

      return hh * 3600 + mm * 60 + ss;
    };

    expect(toSeconds(timerAfter)).toBeLessThan(toSeconds(timerBefore));

    const color = await testManager.agent1Page
      .locator('#idleCodesDropdown')
      .evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(color).toBe(THEME_COLORS.AVAILABLE);
  });

  test('should verify callback sequence for Available state', async () => {
    await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
    await testManager.agent1Page.waitForTimeout(3000);

    testManager.consoleMessages.length = 0;
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(3000);

    const ok = await checkCallbackSequence(
      testManager.agent1Page,
      USER_STATES.AVAILABLE,
      testManager.consoleMessages
    );
    expect(ok).toBe(true);
  });

  test('should verify state persistence after page reload', async () => {
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);

    testManager.consoleMessages.length = 0;
    await agentRelogin(testManager.agent1Page);

    const visible = await testManager.agent1Page.locator('#idleCodesDropdown').isVisible();
    expect(visible).toBe(true);

    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    const callbackTriggered = await validateConsoleStateChange(
      testManager.agent1Page,
      USER_STATES.AVAILABLE,
      testManager.consoleMessages
    );
    expect(callbackTriggered).toBe(true);
  });

  test('should test multi-session synchronization', async () => {
    if (!testManager.multiSessionAgent1Page) {
      await testManager.setupMultiSessionPage();
    }

    const multiSessionPage = testManager.multiSessionAgent1Page;
    expect(multiSessionPage).toBeTruthy();
    if (!multiSessionPage) {
      return;
    }

    await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
    await multiSessionPage.waitForTimeout(3000);
    await verifyCurrentState(multiSessionPage, USER_STATES.MEETING);

    const [timer1, timer2] = await Promise.all([
      getStateElapsedTime(testManager.agent1Page),
      getStateElapsedTime(multiSessionPage),
    ]);

    const parse = (timer: string) => {
      const normalized = timer
        .split(' / ')[0]
        .split(':')
        .map((part) => Number.parseInt(part, 10) || 0);
      const [hh, mm, ss] = normalized.length === 3 ? normalized : [0, normalized[0], normalized[1]];

      return hh * 3600 + mm * 60 + ss;
    };

    expect(Math.abs(parse(timer1) - parse(timer2))).toBeLessThanOrEqual(2);
  });

  test('should test idle state transition and dual timer', async () => {
    await testManager.agent1Page.keyboard.press('Escape');
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);

    testManager.consoleMessages.length = 0;
    await changeUserState(testManager.agent1Page, USER_STATES.LUNCH);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.LUNCH);

    const found = await validateConsoleStateChange(
      testManager.agent1Page,
      USER_STATES.LUNCH,
      testManager.consoleMessages
    );
    expect(found).toBe(true);

    await testManager.agent1Page.waitForTimeout(5000);
    const dualTimer = await getStateElapsedTime(testManager.agent1Page);
    const parts = dualTimer.split(' / ');
    expect(parts.length).toBe(2);
    expect(parts.every((part) => /^\d{2}:\d{2}:\d{2}$/.test(part))).toBe(true);

    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
  });
}
