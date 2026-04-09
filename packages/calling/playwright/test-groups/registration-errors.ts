import {test, expect} from '@playwright/test';
import {navigateToCallingApp, setServiceIndicator} from '../utils/setup';
import {isLineRegistered} from '../utils/registration';
import {CALLING_SELECTORS, AWAIT_TIMEOUT, SDK_INIT_TIMEOUT} from '../constants';

/**
 * Registration error/edge-case tests: REG-011, REG-012, REG-013.
 * No valid account needed — these test invalid/missing tokens.
 */
export function registrationErrorTests() {
  test.describe('Registration Error Cases', () => {
    test('REG-011: Registration fails with invalid token', async ({page, context}) => {
      let registrationPosts = 0;
      let registrationStatus = 0;

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

      await navigateToCallingApp(page);
      await setServiceIndicator(page, 'calling');

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
        await page.waitForTimeout(15000);
      }

      const hasCallingClient = await page.evaluate(() => !!(window as any).callingClient);
      if (hasCallingClient) {
        expect(await isLineRegistered(page)).toBe(false);
      }

      if (registrationPosts > 0) {
        expect(registrationStatus).toBe(401);
      }

      const status = await page.locator(CALLING_SELECTORS.REGISTRATION_STATUS).textContent();
      expect(status).not.toMatch(/Registered, deviceId:/);
    });

    test('REG-012: SDK init fails with empty token', async ({page}) => {
      await navigateToCallingApp(page);
      await setServiceIndicator(page, 'calling');

      await page.locator(CALLING_SELECTORS.INITIALIZE_CALLING_BTN).click({timeout: AWAIT_TIMEOUT});

      await page.waitForTimeout(10000);

      const hasCallingClient = await page.evaluate(() => !!(window as any).callingClient);
      expect(hasCallingClient).toBe(false);

      await expect(page.locator(CALLING_SELECTORS.REGISTER_BTN)).toBeDisabled({
        timeout: AWAIT_TIMEOUT,
      });
    });

    test('REG-013: Registration not possible before SDK init', async ({page}) => {
      await navigateToCallingApp(page);

      const hasCallingClient = await page.evaluate(() => !!(window as any).callingClient);
      expect(hasCallingClient).toBe(false);

      await expect(page.locator(CALLING_SELECTORS.REGISTER_BTN)).toBeDisabled({
        timeout: AWAIT_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.UNREGISTER_BTN)).toBeDisabled({
        timeout: AWAIT_TIMEOUT,
      });
    });
  });
}
