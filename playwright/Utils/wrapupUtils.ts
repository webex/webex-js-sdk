/* eslint-disable import/no-extraneous-dependencies */
import {Page} from '@playwright/test';
import {AWAIT_TIMEOUT, UI_SETTLE_TIMEOUT, WRAPUP_TIMEOUT, WrapupReason} from '../constants';

// eslint-disable-next-line import/prefer-default-export
export async function submitWrapup(page: Page, reason: WrapupReason): Promise<void> {
  if (!reason || !reason.trim()) {
    throw new Error('Wrapup reason is required');
  }

  await page.bringToFront();
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(UI_SETTLE_TIMEOUT);

  const wrapupButton = page.locator('#wrapup');
  const wrapupSelect = page.locator('#wrapupCodesDropdown');

  await wrapupButton.waitFor({state: 'visible', timeout: WRAPUP_TIMEOUT});
  await wrapupSelect.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});

  if (!(await wrapupButton.isEnabled().catch(() => false))) {
    throw new Error('Wrapup button is not enabled');
  }

  if (!(await wrapupSelect.isEnabled().catch(() => false))) {
    throw new Error('Wrapup select is not enabled');
  }

  const selected = await wrapupSelect.selectOption({label: reason}).catch(() => []);
  if (selected.length === 0) {
    await wrapupSelect.selectOption({index: 0});
  }

  await wrapupButton.click({timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(UI_SETTLE_TIMEOUT);
}
