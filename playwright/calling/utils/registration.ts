import {Page, expect} from '@playwright/test';
import {SELECTORS, AWAIT_TIMEOUT, REGISTRATION_TIMEOUT} from './constants';

export const registerLine = async (page: Page): Promise<void> => {
  await page.locator(SELECTORS.REGISTER_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.REGISTRATION_STATUS)).toContainText('Registered, deviceId:', {
    timeout: REGISTRATION_TIMEOUT,
  });
};

export const verifyLineRegistered = async (page: Page): Promise<void> => {
  await expect(page.locator(SELECTORS.REGISTRATION_STATUS)).toContainText('Registered, deviceId:', {
    timeout: REGISTRATION_TIMEOUT,
  });
  await expect(page.locator(SELECTORS.REGISTER_BTN)).toBeDisabled({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.UNREGISTER_BTN)).toBeEnabled({timeout: AWAIT_TIMEOUT});
};

export const unregisterLine = async (page: Page): Promise<void> => {
  await page.locator(SELECTORS.UNREGISTER_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.REGISTRATION_STATUS)).toContainText('Un registering', {
    timeout: REGISTRATION_TIMEOUT,
  });
};
