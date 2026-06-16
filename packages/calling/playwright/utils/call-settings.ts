import {Page, expect} from '@playwright/test';
import {CALLING_SELECTORS, AWAIT_TIMEOUT, OPERATION_TIMEOUT} from '../constants';

// ---------------------------------------------------------------------------
// DND helpers
// ---------------------------------------------------------------------------

// Click "Get Settings" and wait until the DND button shows "DND Enabled" or "DND Disabled" (ignores loading/placeholder states).
export async function loadSettings(page: Page): Promise<void> {
  // Register both response listeners BEFORE clicking so they capture the GETs
  // that the "Get Settings" button click triggers.
  const cfResponsePromise = page.waitForResponse(
    (r) => r.url().includes('callForwarding') && r.request().method() === 'GET' && r.ok(),
    {timeout: OPERATION_TIMEOUT}
  );
  const vmResponsePromise = page.waitForResponse(
    (r) => r.url().includes('voicemail') && r.request().method() === 'GET' && r.ok(),
    {timeout: OPERATION_TIMEOUT}
  );
  await page.locator(CALLING_SELECTORS.FETCH_SETTINGS_BTN).click({timeout: AWAIT_TIMEOUT});
  // Wait for both forms to be populated from the server before returning.
  await Promise.all([cfResponsePromise, vmResponsePromise]);
  // Wait for DND to settle as a final confirmation that all settings loaded.
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
      (r) => r.url().includes('doNotDisturb') && r.request().method() === 'PUT' && r.ok(),
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
      (r) => r.url().includes('callForwarding') && r.request().method() === 'PUT' && r.ok(),
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
  } else if (enable && isChecked && destination) {
    await dest.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
    await dest.fill(destination);
  }

  await saveCfSettings(page);
}

/**
 * Ensure the Call Forward "When No Answer" checkbox is in the requested state
 * and save.  Does nothing if already in the desired state.
 */
export async function setCallForwardNoAnswer(
  page: Page,
  enable: boolean,
  destination?: string
): Promise<void> {
  const cb = page.locator(CALLING_SELECTORS.CF_NO_ANSWER_CB);
  const dest = page.locator(CALLING_SELECTORS.CF_NO_ANSWER_DEST);
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
  } else if (enable && isChecked && destination) {
    await dest.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
    await dest.fill(destination);
  }

  await saveCfSettings(page);
}

/**
 * Ensure the Call Forward "When Not Reachable" checkbox is in the requested
 * state and save.  Does nothing if already in the desired state.
 */
export async function setCallForwardNotReachable(
  page: Page,
  enable: boolean,
  destination?: string
): Promise<void> {
  const cb = page.locator(CALLING_SELECTORS.CF_NOT_REACHABLE_CB);
  const dest = page.locator(CALLING_SELECTORS.CF_NOT_REACHABLE_DEST);
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
  } else if (enable && isChecked && destination) {
    await dest.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
    await dest.fill(destination);
  }

  await saveCfSettings(page);
}

/**
 * Enable or disable "Send all calls to voicemail" and save.
 */
export async function setVoicemailSendAllCalls(page: Page, enable: boolean): Promise<void> {
  const cb = page.locator(CALLING_SELECTORS.VM_SEND_ALL_CB);
  const isChecked = await cb.isChecked();
  if (enable && !isChecked) {
    await cb.check({timeout: AWAIT_TIMEOUT});
  } else if (!enable && isChecked) {
    await cb.uncheck({timeout: AWAIT_TIMEOUT});
  }
  await saveVoicemailSettings(page);
}

/**
 * Enable or disable "Send busy calls to voicemail" and save.
 */
export async function setVoicemailSendBusyCalls(page: Page, enable: boolean): Promise<void> {
  const cb = page.locator(CALLING_SELECTORS.VM_SEND_BUSY_CB);
  const isChecked = await cb.isChecked();
  if (enable && !isChecked) {
    await cb.check({timeout: AWAIT_TIMEOUT});
  } else if (!enable && isChecked) {
    await cb.uncheck({timeout: AWAIT_TIMEOUT});
  }
  await saveVoicemailSettings(page);
}

/**
 * Enable or disable "Send unanswered calls to voicemail" with an optional
 * numberOfRings value, and save.
 */
export async function setVoicemailSendUnansweredCalls(
  page: Page,
  enable: boolean,
  numberOfRings?: string
): Promise<void> {
  const cb = page.locator(CALLING_SELECTORS.VM_UNANSWERED_CB);
  const rings = page.locator(CALLING_SELECTORS.VM_UNANSWERED_RINGS);
  const isChecked = await cb.isChecked();

  if (enable && !isChecked) {
    await cb.check({timeout: AWAIT_TIMEOUT});
    await rings.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
    if (numberOfRings) {
      await rings.fill(numberOfRings);
    }
  } else if (!enable && isChecked) {
    await cb.uncheck({timeout: AWAIT_TIMEOUT});
  } else if (enable && isChecked && numberOfRings) {
    await rings.fill(numberOfRings);
  }
  await saveVoicemailSettings(page);
}

/**
 * Click the Voicemail save button and wait for the PUT to be acknowledged.
 */
export async function saveVoicemailSettings(page: Page): Promise<void> {
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('voicemail') && r.request().method() === 'PUT' && r.ok(),
      {timeout: OPERATION_TIMEOUT}
    ),
    page.locator(CALLING_SELECTORS.VM_SAVE_BTN).click({timeout: AWAIT_TIMEOUT}),
  ]);
}

/**
 * Ensure the Call Forward "When Busy" checkbox is in the requested state and
 * save.  Does nothing if already in the desired state.
 */
export async function setCallForwardBusy(
  page: Page,
  enable: boolean,
  destination?: string
): Promise<void> {
  const cb = page.locator(CALLING_SELECTORS.CF_BUSY_CB);
  const dest = page.locator(CALLING_SELECTORS.CF_BUSY_DEST);
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
  } else if (enable && isChecked && destination) {
    await dest.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
    await dest.fill(destination);
  }

  await saveCfSettings(page);
}
