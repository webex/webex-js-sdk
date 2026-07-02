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
import {isIntProject, isMobiusWsMode} from '../test-data';
import {
  CALLING_SELECTORS,
  AWAIT_TIMEOUT,
  REGISTRATION_TIMEOUT,
  PRIMARY_MOBIUS_URL,
} from '../constants';
import {
  getDiscoveredMobiusWsUrls,
  isKnownWsUrl,
  isMobiusWsActive,
  MOBIUS_WS_MESSAGE,
  MobiusWsInterceptor,
} from '../utils/mobius-ws';

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

    let testManager: TestManager;
    let registrationPosts = 0;
    let deletePosts = 0;
    let keepaliveCount = 0;
    let expectedPrimaryUrl: string;
    let mobiusWsInterceptor: MobiusWsInterceptor | undefined;
    const mobiusWsMode = isMobiusWsMode();

    test.beforeAll(async ({browser}, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      expectedPrimaryUrl = isInt ? PRIMARY_MOBIUS_URL.INT : PRIMARY_MOBIUS_URL.PROD;
      testManager = new TestManager(testInfo.project.name);
      if (mobiusWsMode) {
        mobiusWsInterceptor = new MobiusWsInterceptor({
          onResponse: (frame) => {
            if (frame.subtype === MOBIUS_WS_MESSAGE.REGISTER && frame.statusCode === 200) {
              return {
                ...frame,
                data: {
                  ...(frame.data || {}),
                  keepaliveInterval: 5,
                },
              };
            }

            return undefined;
          },
        });
      }
      const {context, page} = await testManager.setupContext(browser, 0, {
        initSDK: true,
        service: 'calling',
        beforeInit: mobiusWsInterceptor
          ? (browserContext) => mobiusWsInterceptor!.install(browserContext)
          : undefined,
      });

      if (!mobiusWsMode) {
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
      }

      await registerLine(page);
      await verifyLineRegistered(page);
    });

    test.afterAll(async () => {
      await testManager.cleanup();
    });

    test('REG-001: Initial registration success', async () => {
      const page = testManager.page;

      if (mobiusWsMode) {
        expect(mobiusWsInterceptor?.getRequestCount(MOBIUS_WS_MESSAGE.REGISTER)).toBe(1);
      } else {
        expect(registrationPosts).toBe(1);
      }

      const statusText = await page.locator(CALLING_SELECTORS.REGISTRATION_STATUS).textContent();
      expect(statusText).toMatch(/Registered, deviceId: .+/);

      expect(await isLineRegistered(page)).toBe(true);

      const activeMobiusUrl = await getActiveMobiusUrl(page);
      if (mobiusWsMode) {
        const discovered = await getDiscoveredMobiusWsUrls(page);

        expect(isMobiusWsActive(activeMobiusUrl)).toBe(true);
        expect(isKnownWsUrl(activeMobiusUrl, [...discovered.primary, ...discovered.backup])).toBe(
          true
        );
      } else {
        expect(activeMobiusUrl).toBe(expectedPrimaryUrl);
      }

      const deviceInfo = await getDeviceInfo(page);
      expect(deviceInfo.device).toBeTruthy();
      expect(deviceInfo.device.deviceId).toBeTruthy();

      // Register button should be disabled after successful registration
      await expect(page.locator(CALLING_SELECTORS.REGISTER_BTN)).toBeDisabled({
        timeout: AWAIT_TIMEOUT,
      });
    });

    test('REG-003: Keepalive requests are sent after registration', async () => {
      const page = testManager.page;

      await expect
        .poll(
          () =>
            mobiusWsMode
              ? mobiusWsInterceptor?.getRequestCount(MOBIUS_WS_MESSAGE.DEVICE_STATUS) || 0
              : keepaliveCount,
          {
            message: 'Expected at least one keepalive request within 20s',
            timeout: 20000,
            intervals: [1000],
          }
        )
        .toBeGreaterThan(0);

      expect(await isLineRegistered(page)).toBe(true);
    });

    test('REG-008: Connection restoration re-registers when no active calls', async () => {
      test.setTimeout(240000);

      const page = testManager.page;
      const context = testManager.context;
      const initialRegCount = mobiusWsMode
        ? mobiusWsInterceptor?.getRequestCount(MOBIUS_WS_MESSAGE.REGISTER) || 0
        : registrationPosts;
      const initialDeleteCount = mobiusWsMode
        ? mobiusWsInterceptor?.getRequestCount(MOBIUS_WS_MESSAGE.UNREGISTER) || 0
        : deletePosts;

      const mobiusUrlBefore = await getActiveMobiusUrl(page);

      await context.setOffline(true);
      await page.waitForTimeout(45000);
      await context.setOffline(false);

      await expect
        .poll(
          () =>
            mobiusWsMode
              ? mobiusWsInterceptor?.getRequestCount(MOBIUS_WS_MESSAGE.REGISTER) || 0
              : registrationPosts,
          {
            message: 'Expected re-registration after network restoration',
            timeout: 120000,
            intervals: [2000],
          }
        )
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

      const deleteCount = mobiusWsMode
        ? mobiusWsInterceptor?.getRequestCount(MOBIUS_WS_MESSAGE.UNREGISTER) || 0
        : deletePosts;
      expect(deleteCount).toBeGreaterThan(initialDeleteCount);

      const mobiusUrlAfter = await getActiveMobiusUrl(page);
      expect(mobiusUrlAfter).toBe(mobiusUrlBefore);
    });

    test('REG-010: Deregistration success and cleanup', async () => {
      const page = testManager.page;

      await unregisterLine(page);

      await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
        'Unregistered',
        {
          timeout: REGISTRATION_TIMEOUT,
        }
      );

      const deleteCount = mobiusWsMode
        ? mobiusWsInterceptor?.getRequestCount(MOBIUS_WS_MESSAGE.UNREGISTER) || 0
        : deletePosts;
      expect(deleteCount).toBeGreaterThanOrEqual(1);

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
