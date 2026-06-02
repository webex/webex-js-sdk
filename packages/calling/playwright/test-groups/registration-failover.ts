import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {isLineRegistered, getActiveMobiusUrl} from '../utils/registration';
import {isIntProject, isMobiusWsMode} from '../test-data';
import {
  CALLING_SELECTORS,
  AWAIT_TIMEOUT,
  REGISTRATION_TIMEOUT,
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
 * Failover & failback tests: REG-006, REG-017, REG-007.
 * Run serially in a shared browser context — each test chains from the
 * previous test's state (REG-006 → backup, REG-017 → still backup after
 * 429 exhaustion, REG-007 → clean failback to primary).
 */
export function registrationFailoverTests() {
  test.describe('Failover & Failback', () => {
    test.describe.configure({mode: 'serial'});

    let testManager: TestManager;
    let registrationAttempts = 0;
    const attemptedUrls: string[] = [];
    let phase: 'failover' | 'failback' | 'failback-429' = 'failover';
    let failbackRegistrationAttempts = 0;
    let failback429Attempts = 0;
    const FAILBACK_RETRY_AFTER_SECONDS = 5;
    const MAX_FAILURES = 6;
    let expectedPrimaryUrl: string;
    let expectedBackupUrl: string;
    let primaryWsUrls: string[] = [];
    let backupWsUrls: string[] = [];
    const mobiusWsMode = isMobiusWsMode();

    test.beforeAll(async ({browser}, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      expectedPrimaryUrl = isInt ? PRIMARY_MOBIUS_URL.INT : PRIMARY_MOBIUS_URL.PROD;
      expectedBackupUrl = isInt ? BACKUP_MOBIUS_URL.INT : BACKUP_MOBIUS_URL.PROD;

      testManager = new TestManager(testInfo.project.name);
      let interceptor: MobiusWsInterceptor | undefined;
      if (mobiusWsMode) {
        interceptor = new MobiusWsInterceptor({
          onRequest: (frame, context) => {
            if (frame.type !== MOBIUS_WS_MESSAGE.REGISTER) {
              return undefined;
            }

            registrationAttempts += 1;
            attemptedUrls.push(context.url);

            if (phase === 'failover' && registrationAttempts <= MAX_FAILURES) {
              return {
                statusCode: 503,
                statusMessage: 'Service Unavailable',
                data: {message: 'Service Unavailable'},
              };
            }

            if (phase === 'failback-429') {
              if (isKnownWsUrl(context.url, primaryWsUrls)) {
                failback429Attempts += 1;

                return {
                  statusCode: 429,
                  statusMessage: 'Too Many Requests',
                  metadata: {'retry-after': String(FAILBACK_RETRY_AFTER_SECONDS)},
                  data: {message: 'Too Many Requests'},
                };
              }

              return undefined;
            }

            if (phase === 'failback') {
              failbackRegistrationAttempts += 1;
            }

            return undefined;
          },
        });
      }
      const {context} = await testManager.setupContext(browser, 0, {
        initSDK: true,
        service: 'calling',
        beforeInit: interceptor
          ? (browserContext) => interceptor!.install(browserContext)
          : undefined,
      });

      if (mobiusWsMode) {
        const discovered = await getDiscoveredMobiusWsUrls(testManager.page);
        primaryWsUrls = discovered.primary;
        backupWsUrls = discovered.backup;
      } else {
        // Intercept registration POST — behavior depends on current phase
        await context.route(/\/calling\/web\/device$/, async (route) => {
          if (route.request().method() === 'POST') {
            registrationAttempts += 1;
            attemptedUrls.push(route.request().url());

            if (phase === 'failover' && registrationAttempts <= MAX_FAILURES) {
              await route.fulfill({
                status: 503,
                contentType: 'application/json',
                body: JSON.stringify({message: 'Service Unavailable'}),
              });
            } else if (phase === 'failback-429') {
              const url = route.request().url();

              if (url.startsWith(expectedPrimaryUrl)) {
                // Primary attempts get 429
                failback429Attempts += 1;
                await route.fulfill({
                  status: 429,
                  headers: {
                    'Retry-After': String(FAILBACK_RETRY_AFTER_SECONDS),
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({message: 'Too Many Requests'}),
                });
              } else {
                // Backup attempts pass through (restorePreviousRegistration)
                await route.continue();
              }
            } else {
              if (phase === 'failback') {
                failbackRegistrationAttempts += 1;
              }
              await route.continue();
            }
          } else {
            await route.continue();
          }
        });
      }
    });

    test.afterAll(async () => {
      await testManager.context.unrouteAll({behavior: 'ignoreErrors'});
      await testManager.cleanup();
    });

    test('REG-006: Primary-to-backup failover on repeated failure', async () => {
      test.setTimeout(300000);

      const page = testManager.page;

      // Click register — will fail on primary, eventually succeed on backup
      await page.locator(CALLING_SELECTORS.REGISTER_BTN).click({timeout: AWAIT_TIMEOUT});

      await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
        'Registered, deviceId:',
        {timeout: 240000}
      );

      expect(registrationAttempts).toBeGreaterThan(MAX_FAILURES);

      expect(await isLineRegistered(page)).toBe(true);

      const failoverValues = await page.evaluate(() => {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith('wxc-failover-state'));

        return keys.map((k) => localStorage.getItem(k));
      });
      failoverValues.forEach((value) => expect(value).toBeNull());

      const uniqueUrls = new Set(attemptedUrls);
      expect(uniqueUrls.size).toBeGreaterThanOrEqual(2);

      // After failover, active Mobius should be the backup server
      const activeMobius = await getActiveMobiusUrl(page);
      if (mobiusWsMode) {
        expect(isKnownWsUrl(activeMobius, backupWsUrls)).toBe(true);
      } else {
        expect(activeMobius).toBe(expectedBackupUrl);
      }
    });

    test('REG-017: 429 during failback exhausts retry budget, stays on backup', async () => {
      test.setTimeout(300000);

      const page = testManager.page;

      // Device is on backup from REG-006
      if (mobiusWsMode) {
        expect(isKnownWsUrl(await getActiveMobiusUrl(page), backupWsUrls)).toBe(true);
      } else {
        expect(await getActiveMobiusUrl(page)).toBe(expectedBackupUrl);
      }

      // Switch to failback-429 phase — primary POSTs get 429, backup POSTs pass through
      phase = 'failback-429';
      failback429Attempts = 0;

      // Clear existing failback timer and trigger failback with short rehoming interval
      await page.evaluate(() => {
        const reg = (Object.values((window as any).callingClient.getLines())[0] as any)
          .registration;
        reg.clearFailbackTimer();
        reg.failbackTimer = undefined;
        reg.scheduled429Retry = false;
        reg.failback429RetryAttempts = 0;
        reg.rehomingIntervalMin = 0.08;
        reg.rehomingIntervalMax = 0.08;
        reg.initiateFailback();
      });

      // Wait for SDK to exhaust its 5-retry budget (REG_FAILBACK_429_MAX_RETRIES)
      await expect
        .poll(
          () =>
            page.evaluate(
              () =>
                (Object.values((window as any).callingClient.getLines())[0] as any).registration
                  .failback429RetryAttempts
            ),
          {
            message: 'Expected failback429RetryAttempts to reach 5 (max budget)',
            timeout: 240000,
            intervals: [3000],
          }
        )
        .toBeGreaterThanOrEqual(5);

      // Verify we actually sent 429 responses to primary attempts
      expect(failback429Attempts).toBeGreaterThanOrEqual(5);

      // Device must still be on backup — failback should have given up
      if (mobiusWsMode) {
        expect(isKnownWsUrl(await getActiveMobiusUrl(page), backupWsUrls)).toBe(true);
      } else {
        expect(await getActiveMobiusUrl(page)).toBe(expectedBackupUrl);
      }
      await expect
        .poll(() => isLineRegistered(page), {
          message: 'Line should remain registered on backup after failback 429 exhaustion',
          timeout: AWAIT_TIMEOUT,
          intervals: [1000],
        })
        .toBe(true);

      // Clean up SDK state so REG-007 can trigger a fresh failback
      await page.evaluate(() => {
        const reg = (Object.values((window as any).callingClient.getLines())[0] as any)
          .registration;
        reg.clearFailbackTimer();
        reg.failbackTimer = undefined;
        reg.scheduled429Retry = false;
        reg.failback429RetryAttempts = 0;
      });
    });

    test('REG-007: Fallback to primary from backup', async () => {
      test.setTimeout(300000);

      const page = testManager.page;

      // Record the backup URL from REG-006
      const backupUrl = await getActiveMobiusUrl(page);
      if (mobiusWsMode) {
        expect(isKnownWsUrl(backupUrl, backupWsUrls)).toBe(true);
      } else {
        expect(backupUrl).toBe(expectedBackupUrl);
      }

      // Switch to failback phase — all registration POSTs now succeed
      phase = 'failback';

      // Clear the existing failback timer (started automatically after REG-006's
      // backup registration), set a short rehoming interval, then re-trigger.
      await page.evaluate(() => {
        const reg = (Object.values((window as any).callingClient.getLines())[0] as any)
          .registration;
        reg.clearFailbackTimer();
        reg.rehomingIntervalMin = 0.08;
        reg.rehomingIntervalMax = 0.08;
        reg.initiateFailback();
      });

      // Wait for failback re-registration
      await expect
        .poll(() => failbackRegistrationAttempts, {
          message: 'Expected failback re-registration attempt to primary',
          timeout: 90000,
          intervals: [2000],
        })
        .toBeGreaterThan(0);

      await expect
        .poll(() => isLineRegistered(page), {
          message: 'Expected SDK to report registered after failback',
          timeout: 60000,
          intervals: [2000],
        })
        .toBe(true);

      await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
        'Registered, deviceId:',
        {timeout: REGISTRATION_TIMEOUT}
      );

      // Verify moved from backup to primary
      const newActiveMobiusUrl = await getActiveMobiusUrl(page);
      if (mobiusWsMode) {
        expect(isKnownWsUrl(newActiveMobiusUrl, primaryWsUrls)).toBe(true);
      } else {
        expect(newActiveMobiusUrl).toBe(expectedPrimaryUrl);
      }
    });
  });
}
