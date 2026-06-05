import {test, expect} from '@playwright/test';
import {navigateToCallingApp, setServiceIndicator, setMobiusWebSocket} from '../utils/setup';
import {isLineRegistered} from '../utils/registration';
import {CALLING_SELECTORS, AWAIT_TIMEOUT, SDK_INIT_TIMEOUT} from '../constants';
import {isMobiusWsMode} from '../test-data';

/**
 * Registration error tests: REG-011.
 * No valid account needed — tests invalid token registration.
 */
export function registrationErrorTests() {
  test.describe('Registration Error Cases', () => {
    test('REG-011: Registration fails with invalid token', async ({page, context}) => {
      let registrationPosts = 0;
      let registrationStatus = 0;
      const mobiusWsMode = isMobiusWsMode();

      // In WS mode the SDK fails at HTTP service discovery (invalid token → 401 on
      // region/server lookup) before ever opening a WebSocket. No WS interceptor is
      // needed — the test still validates the end state: "not registered".
      if (!mobiusWsMode) {
        await context.route(/\/calling\/web\/device$/, async (route) => {
          if (route.request().method() === 'POST') {
            registrationPosts += 1;
            const response = await route.fetch();
            registrationStatus = response.status();
            await route.fulfill({response});
          } else {
            await route.continue();
          }
        });
      }

      await navigateToCallingApp(page);
      await setServiceIndicator(page, 'calling');

      if (mobiusWsMode) {
        await setMobiusWebSocket(page, true);
      }

      await page.locator(CALLING_SELECTORS.ACCESS_TOKEN_INPUT).fill('invalid-token-12345', {
        timeout: AWAIT_TIMEOUT,
      });
      await page.locator(CALLING_SELECTORS.INITIALIZE_CALLING_BTN).click({timeout: AWAIT_TIMEOUT});

      await expect(page.locator(CALLING_SELECTORS.AUTH_STATUS)).toHaveText('Saved access token!', {
        timeout: SDK_INIT_TIMEOUT,
      });

      const registerBtn = page.locator(CALLING_SELECTORS.REGISTER_BTN);
      const isEnabled = await registerBtn.isEnabled({timeout: SDK_INIT_TIMEOUT}).catch(() => false);

      if (isEnabled) {
        await registerBtn.click({timeout: AWAIT_TIMEOUT});
        await page.waitForTimeout(5000);
      }

      const hasCallingClient = await page.evaluate(() => !!(window as any).callingClient);
      if (hasCallingClient) {
        expect(await isLineRegistered(page)).toBe(false);
      }

      if (!mobiusWsMode && registrationPosts > 0) {
        expect(registrationStatus).toBe(401);
      }

      const status = await page.locator(CALLING_SELECTORS.REGISTRATION_STATUS).textContent();
      expect(status).not.toMatch(/Registered, deviceId:/);
    });
  });
}
