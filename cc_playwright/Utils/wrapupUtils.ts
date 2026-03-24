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
 * Submits the wrap-up popup for a task in the UI.
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

  // Dismiss any open popovers that might be blocking interactions
  await page.keyboard.press('Escape');
  await page.waitForTimeout(UI_SETTLE_TIMEOUT);

  await expect
    .poll(() => findFirstVisibleWrapupIndex(page), {
      timeout: WRAPUP_TIMEOUT,
      intervals: [250, 500, 1000, 2000],
    })
    .not.toBe(-1);

  const wrapupIndex = await findFirstVisibleWrapupIndex(page);
  const wrapupBox = page.getByTestId('call-control:wrapup-button').nth(wrapupIndex);

  // Check if dropdown is already open (aria-expanded="true")
  const isAlreadyOpen = (await wrapupBox.getAttribute('aria-expanded')) === 'true';
  if (!isAlreadyOpen) {
    await wrapupBox.click({timeout: AWAIT_TIMEOUT});
    await page.waitForTimeout(UI_SETTLE_TIMEOUT);
  }
  await expect(page.getByTestId('call-control:wrapup-select').first()).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });
  await page.getByTestId('call-control:wrapup-select').first().click({timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(UI_SETTLE_TIMEOUT);
  const optionLocator = page
    .getByTestId(`call-control:wrapup-reason-${reason.toLowerCase()}`)
    .filter({hasText: reason.toString()});
  try {
    await expect(optionLocator.first()).toBeVisible({timeout: AWAIT_TIMEOUT});
  } catch (error) {
    await page.waitForTimeout(UI_SETTLE_TIMEOUT);
    await expect(page.getByTestId('call-control:wrapup-select').first()).toBeVisible({
      timeout: AWAIT_TIMEOUT,
    });
    await page.getByTestId('call-control:wrapup-select').first().click({timeout: AWAIT_TIMEOUT});
  }
  await expect(optionLocator.first()).toBeVisible({timeout: AWAIT_TIMEOUT});
  await optionLocator.first().click({timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(UI_SETTLE_TIMEOUT);
  await expect(page.getByTestId(`call-control:wrapup-submit`).first()).toBeVisible({
    timeout: AWAIT_TIMEOUT,
  });
  await page.getByTestId(`call-control:wrapup-submit`).first().click({timeout: AWAIT_TIMEOUT});
  await page.waitForTimeout(UI_SETTLE_TIMEOUT);
}
