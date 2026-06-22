import {test, expect} from '@playwright/test';
import {getToken, getUserSet, isIntProject, isMobiusWsMode} from '../test-data';
import {
  navigateToCallingApp,
  initializeCallingSDK,
  verifySDKInitialized,
  setServiceIndicator,
  setEnvironmentToInt,
} from '../utils/setup';
import {
  registerLine,
  verifyLineRegistered,
  isLineRegistered,
  getActiveMobiusUrl,
} from '../utils/registration';
import {
  CALLING_SELECTORS,
  REGISTRATION_TIMEOUT,
  AWAIT_TIMEOUT,
  PRIMARY_MOBIUS_URL,
  BACKUP_MOBIUS_URL,
} from '../constants';
import {
  getDiscoveredMobiusWsUrls,
  isKnownWsUrl,
  MOBIUS_WS_MESSAGE,
  MobiusWsInterceptor,
} from '../utils/mobius-ws';

/**
 * Keepalive & registration-retry tests: REG-004, REG-005, REG-015, REG-016.
 * Each test needs custom routes set up BEFORE registration, so they cannot share
 * post-registration state. They run serially to avoid account contention, each
 * with a fresh page/context.
 *
 * REG-003 (basic keepalive observation) lives in registration-lifecycle.ts
 * because it only needs to observe keepalive traffic after a normal registration.
 */
export function registrationKeepaliveTests() {
  test.describe('Keepalive Flows', () => {
    test('REG-004: Keepalive 404 triggers re-registration', async ({page, context}, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      const role = getUserSet(testInfo.project.name).accounts[0];
      const mobiusWsMode = isMobiusWsMode();
      test.setTimeout(180000);

      let registrationCount = 0;
      let failKeepalive = false;
      let postReRegKeepaliveCount = 0;
      let trackPostReRegKeepalive = false;

      if (mobiusWsMode) {
        await new MobiusWsInterceptor({
          onRequest: (frame) => {
            if (frame.type === MOBIUS_WS_MESSAGE.REGISTER) {
              registrationCount += 1;
            }

            if (frame.type === MOBIUS_WS_MESSAGE.DEVICE_STATUS) {
              if (failKeepalive) {
                return {
                  statusCode: 404,
                  statusMessage: 'Not Found',
                  data: {message: 'Device not found'},
                };
              }

              if (trackPostReRegKeepalive) {
                postReRegKeepaliveCount += 1;
              }
            }

            return undefined;
          },
          onResponse: (frame) => {
            if (frame.subtype === MOBIUS_WS_MESSAGE.REGISTER && frame.statusCode === 200) {
              return {
                ...frame,
                data: {...(frame.data || {}), keepaliveInterval: 5},
              };
            }

            return undefined;
          },
        }).install(context);
      } else {
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
      }

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
      const mobiusWsMode = isMobiusWsMode();
      test.setTimeout(180000);

      const RETRY_AFTER_SECONDS = 10;
      let keepaliveCount = 0;
      let firstKeepaliveTime = 0;
      let resumedKeepaliveTime = 0;

      if (mobiusWsMode) {
        await new MobiusWsInterceptor({
          onRequest: (frame) => {
            if (frame.type === MOBIUS_WS_MESSAGE.DEVICE_STATUS) {
              keepaliveCount += 1;

              if (keepaliveCount === 1) {
                firstKeepaliveTime = Date.now();

                return {
                  statusCode: 429,
                  statusMessage: 'Too Many Requests',
                  metadata: {'retry-after': String(RETRY_AFTER_SECONDS)},
                  data: {message: 'Too Many Requests'},
                };
              }

              if (resumedKeepaliveTime === 0) {
                resumedKeepaliveTime = Date.now();
              }
            }

            return undefined;
          },
          onResponse: (frame) => {
            if (frame.subtype === MOBIUS_WS_MESSAGE.REGISTER && frame.statusCode === 200) {
              return {
                ...frame,
                data: {...(frame.data || {}), keepaliveInterval: 5},
              };
            }

            return undefined;
          },
        }).install(context);
      } else {
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
      }

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

    test('REG-015: 429 on initial registration honors Retry-After before retrying', async ({
      page,
      context,
    }, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      const role = getUserSet(testInfo.project.name).accounts[0];
      const mobiusWsMode = isMobiusWsMode();
      test.setTimeout(300000);

      const RETRY_AFTER_SECONDS = 10;
      const MAX_429_RESPONSES = 2;
      let registrationAttempts = 0;
      const attemptTimestamps: number[] = [];

      if (mobiusWsMode) {
        await new MobiusWsInterceptor({
          onRequest: (frame) => {
            if (frame.type === MOBIUS_WS_MESSAGE.REGISTER) {
              registrationAttempts += 1;
              attemptTimestamps.push(Date.now());

              if (registrationAttempts <= MAX_429_RESPONSES) {
                return {
                  statusCode: 429,
                  statusMessage: 'Too Many Requests',
                  metadata: {'retry-after': String(RETRY_AFTER_SECONDS)},
                  data: {message: 'Too Many Requests'},
                };
              }
            }

            return undefined;
          },
        }).install(context);
      } else {
        // Intercept registration POST — first N attempts return 429 with Retry-After
        await context.route(/\/calling\/web\/device$/, async (route) => {
          if (route.request().method() === 'POST') {
            registrationAttempts += 1;
            attemptTimestamps.push(Date.now());

            if (registrationAttempts <= MAX_429_RESPONSES) {
              await route.fulfill({
                status: 429,
                headers: {
                  'Retry-After': String(RETRY_AFTER_SECONDS),
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({message: 'Too Many Requests'}),
              });
            } else {
              await route.continue();
            }
          } else {
            await route.continue();
          }
        });
      }

      await navigateToCallingApp(page);
      if (isInt) await setEnvironmentToInt(page);
      await setServiceIndicator(page, 'calling');
      await initializeCallingSDK(page, getToken(role, isInt));
      await verifySDKInitialized(page);

      // Click register — will get 429s then succeed
      await page.locator(CALLING_SELECTORS.REGISTER_BTN).click({timeout: AWAIT_TIMEOUT});

      await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
        'Registered, deviceId:',
        {timeout: 240000}
      );

      expect(registrationAttempts).toBeGreaterThan(MAX_429_RESPONSES);
      expect(await isLineRegistered(page)).toBe(true);

      // Verify the SDK waited at least Retry-After between the last 429 and the next attempt
      if (attemptTimestamps.length > MAX_429_RESPONSES) {
        const last429Time = attemptTimestamps[MAX_429_RESPONSES - 1];
        const firstSuccessAttemptTime = attemptTimestamps[MAX_429_RESPONSES];
        const gap = firstSuccessAttemptTime - last429Time;

        expect(gap).toBeGreaterThanOrEqual((RETRY_AFTER_SECONDS - 2) * 1000);
      }
    });

    test('REG-016: 429 with high Retry-After triggers immediate backup failover', async ({
      page,
      context,
    }, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      const role = getUserSet(testInfo.project.name).accounts[0];
      const mobiusWsMode = isMobiusWsMode();
      test.setTimeout(300000);

      const expectedPrimaryUrl = isInt ? PRIMARY_MOBIUS_URL.INT : PRIMARY_MOBIUS_URL.PROD;
      const expectedBackupUrl = isInt ? BACKUP_MOBIUS_URL.INT : BACKUP_MOBIUS_URL.PROD;
      let primaryWsUrls: string[] = [];
      let backupWsUrls: string[] = [];
      const HIGH_RETRY_AFTER = 120; // Above RETRY_TIMER_UPPER_LIMIT (60s)
      let primaryAttempts = 0;
      let backupAttempts = 0;
      const testStartTime = Date.now();

      if (mobiusWsMode) {
        await new MobiusWsInterceptor({
          onRequest: (frame, routeContext) => {
            if (frame.type !== MOBIUS_WS_MESSAGE.REGISTER) {
              return undefined;
            }

            if (isKnownWsUrl(routeContext.url, primaryWsUrls)) {
              primaryAttempts += 1;

              return {
                statusCode: 429,
                statusMessage: 'Too Many Requests',
                metadata: {'retry-after': String(HIGH_RETRY_AFTER)},
                data: {message: 'Too Many Requests'},
              };
            }

            backupAttempts += 1;

            return undefined;
          },
        }).install(context);
      } else {
        // Intercept registration POST — 429 on primary, pass-through on backup
        await context.route(/\/calling\/web\/device$/, async (route) => {
          if (route.request().method() === 'POST') {
            const url = route.request().url();

            if (url.startsWith(expectedPrimaryUrl)) {
              primaryAttempts += 1;
              await route.fulfill({
                status: 429,
                headers: {
                  'Retry-After': String(HIGH_RETRY_AFTER),
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({message: 'Too Many Requests'}),
              });
            } else {
              backupAttempts += 1;
              await route.continue();
            }
          } else {
            await route.continue();
          }
        });
      }

      await navigateToCallingApp(page);
      if (isInt) await setEnvironmentToInt(page);
      await setServiceIndicator(page, 'calling');
      await initializeCallingSDK(page, getToken(role, isInt));
      await verifySDKInitialized(page);
      if (mobiusWsMode) {
        const discovered = await getDiscoveredMobiusWsUrls(page);
        primaryWsUrls = discovered.primary;
        backupWsUrls = discovered.backup;
      }

      await page.locator(CALLING_SELECTORS.REGISTER_BTN).click({timeout: AWAIT_TIMEOUT});

      await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
        'Registered, deviceId:',
        {timeout: 240000}
      );

      expect(primaryAttempts).toBeGreaterThanOrEqual(1);
      expect(backupAttempts).toBeGreaterThanOrEqual(1);
      expect(await isLineRegistered(page)).toBe(true);

      // Verify registered on backup, not primary
      const activeMobius = await getActiveMobiusUrl(page);
      if (mobiusWsMode) {
        expect(isKnownWsUrl(activeMobius, backupWsUrls)).toBe(true);
      } else {
        expect(activeMobius).toBe(expectedBackupUrl);
      }

      // Verify failover happened well before the 120s Retry-After would have elapsed
      const elapsed = Date.now() - testStartTime;
      expect(elapsed).toBeLessThan(HIGH_RETRY_AFTER * 1000);
    });
  });
}
