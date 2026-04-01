/* eslint-disable no-await-in-loop, no-plusplus, no-continue, no-console */
import {expect, Page} from '@playwright/test';
import {WrapupReason, AWAIT_TIMEOUT, UI_SETTLE_TIMEOUT, WRAPUP_TIMEOUT} from '../constants';

async function findFirstVisibleWrapupIndex(page: Page): Promise<number> {
  const wrapupButtons = page.getByTestId('call-control:wrapup-button');
  const count = await wrapupButtons.count().catch(() => 0);

  for (let i = 0; i < count; i++) {
    const button = wrapupButtons.nth(i);
    if (await button.isVisible().catch(() => false)) {
      return i;
    }
  }

  return -1;
}

export async function waitForWrapupAfterCallEnd(page: Page): Promise<void> {
  await page.bringToFront();

  await expect
    .poll(
      async () => {
        const endControls = page.getByTestId('call-control:end-call');
        const endCount = await endControls.count().catch(() => 0);
        let hasVisibleEndControl = false;

        for (let i = 0; i < endCount; i++) {
          if (
            await endControls
              .nth(i)
              .isVisible()
              .catch(() => false)
          ) {
            hasVisibleEndControl = true;
            break;
          }
        }

        const wrapupIndex = await findFirstVisibleWrapupIndex(page);

        return {
          hasVisibleEndControl,
          hasVisibleWrapup: wrapupIndex !== -1,
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

  // Sample app: wait for wrapup dropdown to be enabled after call ends
  const wrapupDropdown = page.locator('#wrapupCodesDropdown');
  await expect(wrapupDropdown).toBeEnabled({timeout: WRAPUP_TIMEOUT});

  // Select the wrapup reason from dropdown
  await wrapupDropdown.selectOption({label: reason}, {timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(UI_SETTLE_TIMEOUT);

  // Click wrapup button to submit
  const wrapupButton = page.locator('#wrapup');
  await expect(wrapupButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await wrapupButton.click({timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(UI_SETTLE_TIMEOUT);
}
