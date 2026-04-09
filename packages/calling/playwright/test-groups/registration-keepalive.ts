import {test, expect} from '@playwright/test';
import {getToken, getUserSet, isIntProject} from '../test-data';
import {
  navigateToCallingApp,
  initializeCallingSDK,
  verifySDKInitialized,
  setServiceIndicator,
  setEnvironmentToInt,
} from '../utils/setup';
import {registerLine, verifyLineRegistered, isLineRegistered} from '../utils/registration';
import {CALLING_SELECTORS, REGISTRATION_TIMEOUT} from '../constants';

/**
 * Keepalive tests: REG-003, REG-004, REG-005.
 * Each test needs custom routes set up BEFORE registration (to shorten keepalive
 * interval), so they cannot share post-registration state. They run serially
 * to avoid account contention, each with a fresh page/context.
 */
export function registrationKeepaliveTests() {
  test.describe('Keepalive Flows', () => {
    test('REG-003: Keepalive requests are sent after registration', async ({
      page,
      context,
    }, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      const role = getUserSet(testInfo.project.name).accounts[0];
      test.setTimeout(120000);

      let keepaliveCount = 0;

      await context.route(/\/calling\/web\/device$/, async (route) => {
        if (route.request().method() === 'POST') {
          const response = await route.fetch();
          const body = await response.json();
          body.keepaliveInterval = 5;
          await route.fulfill({response, body: JSON.stringify(body)});
        } else {
          await route.continue();
        }
      });

      await context.route(/\/devices\/[^/]+\/status$/, async (route) => {
        if (route.request().method() === 'POST') {
          keepaliveCount += 1;
        }
        await route.continue();
      });

      await navigateToCallingApp(page);
      if (isInt) await setEnvironmentToInt(page);
      await setServiceIndicator(page, 'calling');
      await initializeCallingSDK(page, getToken(role, isInt));
      await verifySDKInitialized(page);
      await registerLine(page);
      await verifyLineRegistered(page);

      await expect
        .poll(() => keepaliveCount, {
          message: 'Expected at least one keepalive request within 20s',
          timeout: 20000,
          intervals: [1000],
        })
        .toBeGreaterThan(0);

      expect(await isLineRegistered(page)).toBe(true);
    });

    test('REG-004: Keepalive 404 triggers re-registration', async ({page, context}, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      const role = getUserSet(testInfo.project.name).accounts[0];
      test.setTimeout(180000);

      let registrationCount = 0;
      let failKeepalive = false;
      let postReRegKeepaliveCount = 0;
      let trackPostReRegKeepalive = false;

      await context.route(/\/calling\/web\/device$/, async (route) => {
        if (route.request().method() === 'POST') {
          registrationCount += 1;
          const response = await route.fetch();
          const body = await response.json();
          body.keepaliveInterval = 5;
          await route.fulfill({response, body: JSON.stringify(body)});
        } else {
          await route.continue();
        }
      });

      await context.route(/\/devices\/[^/]+\/status$/, async (route) => {
        if (route.request().method() === 'POST') {
          if (failKeepalive) {
            await route.fulfill({
              status: 404,
              contentType: 'application/json',
              body: JSON.stringify({message: 'Device not found'}),
            });
          } else {
            if (trackPostReRegKeepalive) {
              postReRegKeepaliveCount += 1;
            }
            await route.continue();
          }
        } else {
          await route.continue();
        }
      });

      await navigateToCallingApp(page);
      if (isInt) await setEnvironmentToInt(page);
      await setServiceIndicator(page, 'calling');
      await initializeCallingSDK(page, getToken(role, isInt));
      await verifySDKInitialized(page);
      await registerLine(page);
      await verifyLineRegistered(page);

      const initialRegCount = registrationCount;

      failKeepalive = true;

      await expect
        .poll(() => registrationCount, {
          message: 'Expected re-registration after keepalive 404',
          timeout: 90000,
          intervals: [2000],
        })
        .toBeGreaterThan(initialRegCount);

      failKeepalive = false;
      trackPostReRegKeepalive = true;

      await expect
        .poll(() => isLineRegistered(page), {
          message: 'Expected SDK to report registered after re-registration',
          timeout: 60000,
          intervals: [2000],
        })
        .toBe(true);

      await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
        'Registered, deviceId:',
        {timeout: REGISTRATION_TIMEOUT}
      );

      await expect
        .poll(() => postReRegKeepaliveCount, {
          message:
            'Expected keepalive to resume after re-registration (proves deregister→register cycle)',
          timeout: 20000,
          intervals: [1000],
        })
        .toBeGreaterThan(0);

      await context.unrouteAll({behavior: 'ignoreErrors'});
    });

    test('REG-005: 429 Retry-After is honored on keepalive', async ({page, context}, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      const role = getUserSet(testInfo.project.name).accounts[0];
      test.setTimeout(180000);

      const RETRY_AFTER_SECONDS = 10;
      let keepaliveCount = 0;
      let firstKeepaliveTime = 0;
      let resumedKeepaliveTime = 0;

      await context.route(/\/calling\/web\/device$/, async (route) => {
        if (route.request().method() === 'POST') {
          const response = await route.fetch();
          const body = await response.json();
          body.keepaliveInterval = 5;
          await route.fulfill({response, body: JSON.stringify(body)});
        } else {
          await route.continue();
        }
      });

      await context.route(/\/devices\/[^/]+\/status$/, async (route) => {
        if (route.request().method() === 'POST') {
          keepaliveCount += 1;

          if (keepaliveCount === 1) {
            firstKeepaliveTime = Date.now();
            await route.fulfill({
              status: 429,
              headers: {
                'Retry-After': String(RETRY_AFTER_SECONDS),
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({message: 'Too Many Requests'}),
            });
          } else {
            if (resumedKeepaliveTime === 0) {
              resumedKeepaliveTime = Date.now();
            }
            await route.continue();
          }
        } else {
          await route.continue();
        }
      });

      await navigateToCallingApp(page);
      if (isInt) await setEnvironmentToInt(page);
      await setServiceIndicator(page, 'calling');
      await initializeCallingSDK(page, getToken(role, isInt));
      await verifySDKInitialized(page);
      await registerLine(page);
      await verifyLineRegistered(page);

      await expect
        .poll(() => keepaliveCount, {
          message: 'Expected keepalive to resume after 429 Retry-After delay',
          timeout: 60000,
          intervals: [1000],
        })
        .toBeGreaterThanOrEqual(2);

      if (firstKeepaliveTime > 0 && resumedKeepaliveTime > 0) {
        const gap = resumedKeepaliveTime - firstKeepaliveTime;
        expect(gap).toBeGreaterThanOrEqual((RETRY_AFTER_SECONDS - 1) * 1000);
      }

      expect(await isLineRegistered(page)).toBe(true);
    });
  });
}
