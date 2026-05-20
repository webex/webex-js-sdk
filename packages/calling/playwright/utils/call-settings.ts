import {Page, expect} from '@playwright/test';
import {CALLING_SELECTORS, AWAIT_TIMEOUT, OPERATION_TIMEOUT} from '../constants';

// ---------------------------------------------------------------------------
// DND helpers
// ---------------------------------------------------------------------------

// Click "Get Settings" and wait until the DND button shows "DND Enabled" or "DND Disabled" (ignores loading/placeholder states).
export async function loadSettings(page: Page): Promise<void> {
  await page.locator(CALLING_SELECTORS.FETCH_SETTINGS_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(CALLING_SELECTORS.DND_BTN)).toHaveText(/^(DND Enabled|DND Disabled)$/, {
    timeout: OPERATION_TIMEOUT,
  });
}

/** Return the current inner text of the DND toggle button. */
export async function getDndText(page: Page): Promise<string> {
  return page.locator(CALLING_SELECTORS.DND_BTN).innerText();
}

// Click the DND button and wait for the toggle to settle on the opposite state on the server.
// Polls loadSettings until the GET reflects the flipped value, avoiding eventual-consistency races
// between the PUT and the subsequent read.
export async function clickDnd(page: Page): Promise<string> {
  const before = await getDndText(page);
  const expectedAfter = before === 'DND Enabled' ? 'DND Disabled' : 'DND Enabled';

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('doNotDisturb') && r.request().method() === 'PUT',
      {timeout: OPERATION_TIMEOUT}
    ),
    page.locator(CALLING_SELECTORS.DND_BTN).click({timeout: AWAIT_TIMEOUT}),
  ]);

  await expect
    .poll(
      async () => {
        await loadSettings(page);

        return getDndText(page);
      },
      {timeout: OPERATION_TIMEOUT, intervals: [500, 1000, 2000]}
    )
    .toBe(expectedAfter);

  return expectedAfter;
}

/**
 * Ensure DND is in `targetText` ('DND Enabled' | 'DND Disabled').
 * Clicks the button once if the current state differs from the target.
 */
export async function ensureDndState(page: Page, targetText: string): Promise<void> {
  const current = await getDndText(page);
  if (current !== targetText) {
    // clickDnd calls loadSettings internally, so the returned text already
    // reflects the authoritative server state.
    const after = await clickDnd(page);
    if (after !== targetText) {
      throw new Error(`DND did not settle on "${targetText}" after toggle. Got: "${after}"`);
    }
  }
}

// ---------------------------------------------------------------------------
// Call Forward helpers
// ---------------------------------------------------------------------------

/**
 * Click the Call Forward save button and block until the PUT is acknowledged
 * by the server.  More reliable than a fixed waitForTimeout.
 */
export async function saveCfSettings(page: Page): Promise<void> {
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('callForwarding') && r.request().method() === 'PUT',
      {timeout: OPERATION_TIMEOUT}
    ),
    page.locator(CALLING_SELECTORS.CF_SAVE_BTN).click({timeout: AWAIT_TIMEOUT}),
  ]);
}

/**
 * Ensure the Call Forward "Always" checkbox is in the requested state and
 * save.  Does nothing if already in the desired state.
 */
export async function setCallForwardAlways(
  page: Page,
  enable: boolean,
  destination?: string
): Promise<void> {
  const cb = page.locator(CALLING_SELECTORS.CF_ALWAYS_CB);
  const dest = page.locator(CALLING_SELECTORS.CF_ALWAYS_DEST);
  const isChecked = await cb.isChecked();

  if (enable && !isChecked) {
    await cb.check({timeout: AWAIT_TIMEOUT});
    await dest.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
    if (destination) {
      await dest.fill(destination);
    }
  } else if (!enable && isChecked) {
    await cb.uncheck({timeout: AWAIT_TIMEOUT});
    await dest.waitFor({state: 'hidden', timeout: AWAIT_TIMEOUT});
  }

  await saveCfSettings(page);
}
