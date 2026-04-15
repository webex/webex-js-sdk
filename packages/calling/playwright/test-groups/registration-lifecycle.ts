import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {
  registerLine,
  verifyLineRegistered,
  unregisterLine,
  isLineRegistered,
  getActiveMobiusUrl,
  getDeviceInfo,
} from '../utils/registration';
import {isIntProject} from '../test-data';
import {
  CALLING_SELECTORS,
  AWAIT_TIMEOUT,
  REGISTRATION_TIMEOUT,
  PRIMARY_MOBIUS_URL,
} from '../constants';

/**
 * Registration lifecycle tests: REG-001, REG-003, REG-008, REG-010.
 * Run serially in a shared browser context to save setup time.
 * REG-003 (basic keepalive) lives here because it only needs to observe
 * keepalive traffic after a normal registration — no pre-registration
 * route setup required, so it piggybacks on the shared context.
 */
export function registrationLifecycleTests() {
  test.describe('Registration Lifecycle', () => {
    test.describe.configure({mode: 'serial'});

    let tm: TestManager;
    let registrationPosts = 0;
    let deletePosts = 0;
    let keepaliveCount = 0;
    let expectedPrimaryUrl: string;

    test.beforeAll(async ({browser}, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      expectedPrimaryUrl = isInt ? PRIMARY_MOBIUS_URL.INT : PRIMARY_MOBIUS_URL.PROD;
      tm = new TestManager(testInfo.project.name);
      const {context, page} = await tm.setupContext(browser, 0, {
        initSDK: true,
        service: 'calling',
      });

      // Track Mobius registration and delete requests across all tests,
      // and shorten keepalive interval so REG-003 completes quickly.
      await context.route(/\/calling\/web\/device$/, async (route) => {
        if (route.request().method() === 'POST') {
          registrationPosts += 1;
          const response = await route.fetch();
          const body = await response.json();
          body.keepaliveInterval = 5;
          await route.fulfill({response, body: JSON.stringify(body)});
        } else {
          await route.continue();
        }
      });

      // Track keepalive status requests for REG-003
      await context.route(/\/devices\/[^/]+\/status$/, async (route) => {
        if (route.request().method() === 'POST') {
          keepaliveCount += 1;
        }
        await route.continue();
      });

      await context.route(/\/calling\/web\/devices\/[^/]+$/, async (route) => {
        if (route.request().method() === 'DELETE') {
          deletePosts += 1;
        }
        await route.continue();
      });

      await registerLine(page);
      await verifyLineRegistered(page);
    });

    test.afterAll(async () => {
      await tm.cleanup();
    });

    test('REG-001: Initial registration success', async () => {
      const page = tm.page;

      expect(registrationPosts).toBe(1);

      const statusText = await page.locator(CALLING_SELECTORS.REGISTRATION_STATUS).textContent();
      expect(statusText).toMatch(/Registered, deviceId: .+/);

      expect(await isLineRegistered(page)).toBe(true);

      const activeMobiusUrl = await getActiveMobiusUrl(page);
      expect(activeMobiusUrl).toBe(expectedPrimaryUrl);

      const deviceInfo = await getDeviceInfo(page);
      expect(deviceInfo.device).toBeTruthy();
      expect(deviceInfo.device.deviceId).toBeTruthy();

      // Register button should be disabled after successful registration
      await expect(page.locator(CALLING_SELECTORS.REGISTER_BTN)).toBeDisabled({
        timeout: AWAIT_TIMEOUT,
      });
    });

    test('REG-003: Keepalive requests are sent after registration', async () => {
      const page = tm.page;

      await expect
        .poll(() => keepaliveCount, {
          message: 'Expected at least one keepalive request within 20s',
          timeout: 20000,
          intervals: [1000],
        })
        .toBeGreaterThan(0);

      expect(await isLineRegistered(page)).toBe(true);
    });

    test('REG-008: Connection restoration re-registers when no active calls', async () => {
      test.setTimeout(240000);

      const page = tm.page;
      const context = tm.context;
      const initialRegCount = registrationPosts;
      const initialDeleteCount = deletePosts;

      const mobiusUrlBefore = await getActiveMobiusUrl(page);

      await context.setOffline(true);
      await page.waitForTimeout(45000);
      await context.setOffline(false);

      await expect
        .poll(() => registrationPosts, {
          message: 'Expected re-registration after network restoration',
          timeout: 120000,
          intervals: [2000],
        })
        .toBeGreaterThan(initialRegCount);

      await expect
        .poll(() => isLineRegistered(page), {
          message: 'Expected SDK to report registered after connection restoration',
          timeout: 60000,
          intervals: [2000],
        })
        .toBe(true);

      await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
        'Registered, deviceId:',
        {timeout: REGISTRATION_TIMEOUT}
      );

      expect(deletePosts).toBeGreaterThan(initialDeleteCount);

      const mobiusUrlAfter = await getActiveMobiusUrl(page);
      expect(mobiusUrlAfter).toBe(mobiusUrlBefore);
    });

    test('REG-010: Deregistration success and cleanup', async () => {
      const page = tm.page;

      await unregisterLine(page);

      await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
        'Unregistered',
        {
          timeout: REGISTRATION_TIMEOUT,
        }
      );

      expect(deletePosts).toBeGreaterThanOrEqual(1);

      await expect(async () => {
        expect(await isLineRegistered(page)).toBe(false);
      }).toPass({timeout: AWAIT_TIMEOUT});

      await expect(page.locator(CALLING_SELECTORS.REGISTER_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.UNREGISTER_BTN)).toBeDisabled({
        timeout: AWAIT_TIMEOUT,
      });
    });
  });
}
