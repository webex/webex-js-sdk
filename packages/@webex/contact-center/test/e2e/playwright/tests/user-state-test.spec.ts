import {test, expect} from '@playwright/test';
import {agentRelogin} from '../Utils/initUtils';
import {stationLogout, telephonyLogin} from '../Utils/stationLoginUtils';
import {
  getCurrentState,
  changeUserState,
  verifyCurrentState,
  getStateElapsedTime,
  validateConsoleStateChange,
  checkCallbackSequence,
} from '../Utils/userStateUtils';
import {USER_STATES, THEME_COLORS, LOGIN_MODE} from '../constants';
import {TestManager} from '../test-manager';

// Shared login and setup before all tests

export default function createUserStateTests() {
  let testManager: TestManager;

  test.beforeAll(async ({browser}, testInfo) => {
    const projectName = testInfo.project.name;
    testManager = new TestManager(projectName);
    await testManager.basicSetup(browser);
    // Handle the station login manually like in the original
    const loginButtonExists = await testManager.agent1Page
      .getByTestId('login-button')
      .isVisible()
      .catch(() => false);
    if (loginButtonExists) {
      await telephonyLogin(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );
    } else {
      await stationLogout(testManager.agent1Page);
      await telephonyLogin(
        testManager.agent1Page,
        LOGIN_MODE.EXTENSION,
        process.env[`${testManager.projectName}_AGENT1_EXTENSION_NUMBER`]
      );
    }
    await expect(testManager.agent1Page.getByTestId('state-select')).toBeVisible();
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

  test('should verify Meeting state theme color', async () => {
    const meetingThemeElement = testManager.agent1Page.getByTestId('state-select');
    const meetingThemeColor = await meetingThemeElement.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(meetingThemeColor).toBe(THEME_COLORS.MEETING);
  });

  test('should change state to Available and verify theme and timer reset', async () => {
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
    await testManager.agent1Page.waitForTimeout(5000);
    const timerBefore = await getStateElapsedTime(testManager.agent1Page);
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(3000);
    const timerAfter = await getStateElapsedTime(testManager.agent1Page);

    const parseTimer = (timer: string) => {
      const parts = timer.split(':');
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };

    expect(parseTimer(timerAfter)).toBeLessThan(parseTimer(timerBefore));

    const themeElement = testManager.agent1Page.getByTestId('state-select');
    const themeColor = await themeElement.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(themeColor).toBe(THEME_COLORS.AVAILABLE);
  });

  test('should verify existence and order in which callback and API success are logged for Available state', async () => {
    await changeUserState(testManager.agent1Page, USER_STATES.MEETING);
    await testManager.agent1Page.waitForTimeout(3000);
    testManager.consoleMessages.length = 0;
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(3000);
    const isCallbackSuccessful = await checkCallbackSequence(
      testManager.agent1Page,
      USER_STATES.AVAILABLE,
      testManager.consoleMessages
    );
    if (!isCallbackSuccessful) throw new Error('Callback for Available state not successful');
  });

  test('should verify state persistence after page reload', async () => {
    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    await testManager.agent1Page.waitForTimeout(3000);

    testManager.consoleMessages.length = 0;
    await agentRelogin(testManager.agent1Page);

    const visible = await testManager.agent1Page.getByTestId('state-select').isVisible();
    if (!visible) throw new Error('State select not visible after reload');

    await verifyCurrentState(testManager.agent1Page, USER_STATES.AVAILABLE);
    const callbackTriggered = await validateConsoleStateChange(
      testManager.agent1Page,
      USER_STATES.AVAILABLE,
      testManager.consoleMessages
    );
    if (!callbackTriggered) throw new Error('Callback not triggered after reload');

    const state = await getCurrentState(testManager.agent1Page);
    if (state !== USER_STATES.AVAILABLE) throw new Error('State is not Available after reload');
  });

  test.skip('should test multi-session synchronization', async () => {
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

    //Parse the timers to compare
    const parseTimer = (timer: string) => {
      const parts = timer.split(':');
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    };
    const timer1Parsed = parseTimer(timer1);
    const timer2Parsed = parseTimer(timer2);

    if (Math.abs(timer1Parsed - timer2Parsed) > 1) {
      throw new Error(`Multi-session timer synchronization failed: Primary=${timer1Parsed}, Secondary=${timer2Parsed}`);
    }
  });

  test('should test idle state transition and dual timer', async () => {
    await verifyCurrentState(testManager.agent1Page, USER_STATES.MEETING);
    await testManager.agent1Page.waitForTimeout(2000);
    testManager.consoleMessages.length = 0;

    await changeUserState(testManager.agent1Page, USER_STATES.LUNCH);
    await verifyCurrentState(testManager.agent1Page, USER_STATES.LUNCH);
    await testManager.agent1Page.waitForTimeout(3000);

    const found = await validateConsoleStateChange(
      testManager.agent1Page,
      USER_STATES.LUNCH,
      testManager.consoleMessages
    );
    if (!found) throw new Error('Callback for Lunch state not successful');

    await testManager.agent1Page.waitForTimeout(5000);
    const dualTimer = await getStateElapsedTime(testManager.agent1Page);

    const timerParts = dualTimer.split(' / ');
    if (timerParts.length !== 2) throw new Error('Dual timer format is incorrect');

    const isValidFormat = timerParts.every((part) => /^(\d{1,2}:\d{2}(:\d{2})?)$/.test(part));
    if (!isValidFormat) throw new Error('Dual timer format is not valid');

    const [firstTimer, secondTimer] = timerParts.map((part) => part.split(':').map(Number));
    if (firstTimer.length < 2 || secondTimer.length < 2) {
      throw new Error('Dual timer does not have enough parts');
    }

    expect(firstTimer[0]).toBeGreaterThanOrEqual(0);
    expect(firstTimer[1]).toBeGreaterThanOrEqual(0);
    expect(secondTimer[0]).toBeGreaterThanOrEqual(0);
    expect(secondTimer[1]).toBeGreaterThanOrEqual(0);
    expect(firstTimer.length === 2 || firstTimer.length === 3).toBe(true);
    expect(secondTimer.length === 2 || secondTimer.length === 3).toBe(true);

    await changeUserState(testManager.agent1Page, USER_STATES.AVAILABLE);
  });
}
