import {Page, expect} from '@playwright/test';
import {CALLING_SELECTORS, AWAIT_TIMEOUT, REGISTRATION_TIMEOUT} from '../constants';

export const registerLine = async (page: Page): Promise<void> => {
  await page.locator(CALLING_SELECTORS.REGISTER_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
    'Registered, deviceId:',
    {
      timeout: REGISTRATION_TIMEOUT,
    }
  );
};

export const verifyLineRegistered = async (page: Page): Promise<void> => {
  await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
    'Registered, deviceId:',
    {
      timeout: REGISTRATION_TIMEOUT,
    }
  );
  await expect(page.locator(CALLING_SELECTORS.REGISTER_BTN)).toBeDisabled({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(CALLING_SELECTORS.UNREGISTER_BTN)).toBeEnabled({
    timeout: AWAIT_TIMEOUT,
  });
};

export const unregisterLine = async (page: Page): Promise<void> => {
  await page.locator(CALLING_SELECTORS.UNREGISTER_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
    'Un registering',
    {
      timeout: REGISTRATION_TIMEOUT,
    }
  );
};
