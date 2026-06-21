/* eslint-disable no-await-in-loop, no-plusplus */
import {expect, Page} from '@playwright/test';
import {WrapupReason, AWAIT_TIMEOUT, UI_SETTLE_TIMEOUT, WRAPUP_TIMEOUT} from '../constants';
import {clickDomButton, dismissAgentStatePopupIfPresent, isTaskCleared} from './controlUtils';

async function isWrapupVisible(page: Page): Promise<boolean> {
  const wrapupButton = page.locator('#wrapup');

  return wrapupButton.isVisible().catch(() => false);
}

export async function waitForWrapupAfterCallEnd(page: Page): Promise<void> {
  await page.bringToFront();

  await expect
    .poll(
      async () => {
        // Sample app has single #end button
        const endButton = page.locator('#end');
        const hasVisibleEndControl = await endButton.isVisible().catch(() => false);

        const hasVisibleWrapup = await isWrapupVisible(page);

        return {
          hasVisibleEndControl,
          hasVisibleWrapup,
        };
      },
      {timeout: WRAPUP_TIMEOUT, intervals: [250, 500, 1000, 2000]}
    )
    .toMatchObject({
      hasVisibleEndControl: false,
      hasVisibleWrapup: true,
    });
}

/**
 * Submits the wrap-up for a task in the sample app.
 * Sample app uses plain HTML: #wrapupCodesDropdown (select) and #wrapup (button).
 *
 * @param page Playwright Page object
 * @param reason The wrap-up reason to select (string, case-insensitive)
 * @throws Error if the wrap-up reason is not found or not provided
 */
export async function submitWrapup(page: Page, reason: WrapupReason): Promise<void> {
  if (!reason || reason.trim() === '') {
    throw new Error('Wrapup reason is required');
  }
  await page.bringToFront();

  const wrapupDropdown = page.locator('#wrapupCodesDropdown');
  const wrapupButton = page.locator('#wrapup');

  const canWrapup = await expect
    .poll(
      async () => {
        const dropdownEnabled = await wrapupDropdown.isEnabled().catch(() => false);
        const buttonEnabled = await wrapupButton.isEnabled().catch(() => false);
        const taskCompleted = await isTaskCleared(page);

        return taskCompleted || (dropdownEnabled && buttonEnabled);
      },
      {timeout: WRAPUP_TIMEOUT, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy()
    .then(async () => {
      const taskCompleted = await isTaskCleared(page);

      return !taskCompleted;
    })
    .catch(() => false);

  if (!canWrapup) {
    return;
  }

  await dismissAgentStatePopupIfPresent(page);

  // Select the wrapup reason from dropdown
  await wrapupDropdown.selectOption({label: reason}, {timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(UI_SETTLE_TIMEOUT);

  // Click wrapup button to submit
  await expect
    .poll(
      async () => {
        const buttonEnabled = await wrapupButton.isEnabled().catch(() => false);
        const taskCompleted = await isTaskCleared(page);

        return buttonEnabled || taskCompleted;
      },
      {timeout: AWAIT_TIMEOUT, intervals: [500, 1000, 2000]}
    )
    .toBeTruthy();

  const buttonEnabled = await wrapupButton.isEnabled().catch(() => false);
  if (!buttonEnabled) {
    return;
  }

  await dismissAgentStatePopupIfPresent(page);

  try {
    await wrapupButton.click({timeout: AWAIT_TIMEOUT});
  } catch {
    await dismissAgentStatePopupIfPresent(page);
    await clickDomButton(page, '#wrapup');
  }
  await page.waitForTimeout(UI_SETTLE_TIMEOUT);
}
