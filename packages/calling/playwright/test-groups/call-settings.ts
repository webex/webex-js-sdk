import {test, expect, Page} from '@playwright/test';
import {TestManager} from '../test-manager';
import {getPhoneNumber} from '../test-data';
import {CALLING_SELECTORS, AWAIT_TIMEOUT, OPERATION_TIMEOUT} from '../constants';
import {
  loadSettings,
  getDndText,
  clickDnd,
  ensureDndState,
  saveCfSettings,
  setCallForwardAlways,
} from '../utils/call-settings';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

export function callSettingsTests() {
  test.describe('Call Settings — UI', () => {
    test.describe.configure({mode: 'serial', timeout: 180000});

    let tm: TestManager;
    let page: Page;
    let cfDestination: string;

    test.beforeAll(async ({browser}, testInfo) => {
      tm = new TestManager(testInfo.project.name);
      await tm.setupContext(browser, 0, {
        initSDK: true,
        service: 'calling',
        register: true,
      });
      page = tm.page;
      cfDestination = getPhoneNumber('USER_2');
    });

    test.afterAll(async () => {
      await tm.cleanup();
    });

    // -----------------------------------------------------------------------
    // GET tests — verify the UI reflects server state after "Get Settings"
    // -----------------------------------------------------------------------

    test('CS-GET-001: Get Settings — buttons visible, DND and Call Waiting settle to server state', async () => {
      // Step 1: All three buttons must be visible BEFORE clicking Get Settings
      await expect(page.locator(CALLING_SELECTORS.FETCH_SETTINGS_BTN)).toBeVisible({
        timeout: AWAIT_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.DND_BTN)).toBeVisible({
        timeout: AWAIT_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.CALL_WAITING_BTN)).toBeVisible({
        timeout: AWAIT_TIMEOUT,
      });

      // Step 2: Click "Get Settings"
      await page.locator(CALLING_SELECTORS.FETCH_SETTINGS_BTN).click({timeout: AWAIT_TIMEOUT});

      // Step 3: DND button must settle to a real server state — not the
      // "Toggle DND" placeholder or the "Fetching DND Status" intermediate text.
      await expect(page.locator(CALLING_SELECTORS.DND_BTN)).toHaveText(
        /^(DND Enabled|DND Disabled)$/,
        {timeout: OPERATION_TIMEOUT}
      );

      // Step 4: Call Waiting must NOT be stuck on "Fetching Call Waiting Status".
      // It may show "Call Waiting Enabled", "Call Waiting Disabled", or "Call Waiting"
      // (unprovisioned) — all are acceptable settled states.
      await expect(page.locator(CALLING_SELECTORS.CALL_WAITING_BTN)).not.toHaveText(
        'Fetching Call Waiting Status',
        {timeout: OPERATION_TIMEOUT}
      );
    });

    test('CS-GET-002: Get Settings — Call Forward form fields become enabled', async () => {
      await loadSettings(page);

      // The form checkboxes start disabled="true" and are unlocked by the SDK
      // response.  Playwright treats a missing/false disabled as "enabled".
      await expect(page.locator(CALLING_SELECTORS.CF_ALWAYS_CB)).toBeEnabled({
        timeout: OPERATION_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.CF_BUSY_CB)).toBeEnabled({
        timeout: OPERATION_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.CF_NO_ANSWER_CB)).toBeEnabled({
        timeout: OPERATION_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.CF_NOT_REACHABLE_CB)).toBeEnabled({
        timeout: OPERATION_TIMEOUT,
      });
    });

    // -----------------------------------------------------------------------
    // DND toggle tests
    // -----------------------------------------------------------------------

    test('CS-DND-003: Toggle DND on — button shows "DND Enabled" after click', async () => {
      await loadSettings(page);
      await ensureDndState(page, 'DND Disabled');

      const after = await clickDnd(page);
      expect(after).toBe('DND Enabled');

      // Restore
      await ensureDndState(page, 'DND Disabled');
    });

    test('CS-DND-004: Toggle DND off — button shows "DND Disabled" after click', async () => {
      await loadSettings(page);
      await ensureDndState(page, 'DND Enabled');

      const after = await clickDnd(page);
      expect(after).toBe('DND Disabled');

      // Leave DND off for subsequent tests
      await ensureDndState(page, 'DND Disabled');
    });

    test('CS-DND-005: DND round-trip — two consecutive toggles restore original state', async () => {
      await loadSettings(page);

      const original = await getDndText(page);

      const afterFirst = await clickDnd(page);
      expect(afterFirst).not.toBe(original);

      const afterSecond = await clickDnd(page);
      expect(afterSecond).toBe(original);
    });

    // -----------------------------------------------------------------------
    // Call Forward form tests
    // -----------------------------------------------------------------------

    test('CS-CF-006: Enable Call Forward Always — checkbox persists after save and reload', async () => {
      await loadSettings(page);

      const originalChecked = await page.locator(CALLING_SELECTORS.CF_ALWAYS_CB).isChecked();

      if (originalChecked) {
        await setCallForwardAlways(page, false);
        await loadSettings(page);
      }

      await setCallForwardAlways(page, true, cfDestination);

      await loadSettings(page);
      await expect(page.locator(CALLING_SELECTORS.CF_ALWAYS_CB)).toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });

      // Restore
      if (!originalChecked) {
        await setCallForwardAlways(page, false);
      }
    });

    test('CS-CF-007: Disable Call Forward Always — unchecked state persists after save and reload', async () => {
      await loadSettings(page);

      const originalChecked = await page.locator(CALLING_SELECTORS.CF_ALWAYS_CB).isChecked();
      if (!originalChecked) {
        await setCallForwardAlways(page, true, cfDestination);
        await loadSettings(page);
      }

      await setCallForwardAlways(page, false);

      await loadSettings(page);
      await expect(page.locator(CALLING_SELECTORS.CF_ALWAYS_CB)).not.toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });

      // Restore
      if (originalChecked) {
        await setCallForwardAlways(page, true, cfDestination);
      }
    });

    test('CS-CF-008: Enable Call Forward When Busy — checkbox persists after save and reload', async () => {
      await loadSettings(page);

      const originalChecked = await page.locator(CALLING_SELECTORS.CF_BUSY_CB).isChecked();

      if (originalChecked) {
        await page.locator(CALLING_SELECTORS.CF_BUSY_CB).uncheck({timeout: AWAIT_TIMEOUT});
        await saveCfSettings(page);
        await loadSettings(page);
      }

      await page.locator(CALLING_SELECTORS.CF_BUSY_CB).check({timeout: AWAIT_TIMEOUT});
      await page
        .locator(CALLING_SELECTORS.CF_BUSY_DEST)
        .waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
      await page.locator(CALLING_SELECTORS.CF_BUSY_DEST).fill(cfDestination);
      await saveCfSettings(page);

      await loadSettings(page);
      await expect(page.locator(CALLING_SELECTORS.CF_BUSY_CB)).toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });

      // Restore
      if (!originalChecked) {
        await page.locator(CALLING_SELECTORS.CF_BUSY_CB).uncheck({timeout: AWAIT_TIMEOUT});
        await saveCfSettings(page);
      }
    });

    test('CS-CF-009: Enable Call Forward No Answer — checkbox persists after save and reload', async () => {
      await loadSettings(page);

      const originalChecked = await page.locator(CALLING_SELECTORS.CF_NO_ANSWER_CB).isChecked();

      if (originalChecked) {
        await page.locator(CALLING_SELECTORS.CF_NO_ANSWER_CB).uncheck({timeout: AWAIT_TIMEOUT});
        await saveCfSettings(page);
        await loadSettings(page);
      }

      await page.locator(CALLING_SELECTORS.CF_NO_ANSWER_CB).check({timeout: AWAIT_TIMEOUT});
      await page
        .locator(CALLING_SELECTORS.CF_NO_ANSWER_DEST)
        .waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
      await page.locator(CALLING_SELECTORS.CF_NO_ANSWER_DEST).fill(cfDestination);
      await saveCfSettings(page);

      await loadSettings(page);
      await expect(page.locator(CALLING_SELECTORS.CF_NO_ANSWER_CB)).toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });

      // Restore
      if (!originalChecked) {
        await page.locator(CALLING_SELECTORS.CF_NO_ANSWER_CB).uncheck({timeout: AWAIT_TIMEOUT});
        await saveCfSettings(page);
      }
    });

    // -----------------------------------------------------------------------
    // Call Forward Always by directory number
    // -----------------------------------------------------------------------

    test('CS-CFA-010: Get Call Forward Always — result data appears after directory number lookup', async () => {
      const directoryNumber = getPhoneNumber('USER_1');

      await page
        .locator(CALLING_SELECTORS.CF_DIRECTORY_NUMBER)
        .fill(directoryNumber, {timeout: AWAIT_TIMEOUT});
      await page.locator(CALLING_SELECTORS.CF_ALWAYS_BTN).click({timeout: AWAIT_TIMEOUT});

      // The pre element is populated with either the callSetting or an error
      // object — either way it must be non-empty.
      await expect(page.locator(CALLING_SELECTORS.CF_ALWAYS_DATA)).not.toBeEmpty({
        timeout: OPERATION_TIMEOUT,
      });
    });

    // -----------------------------------------------------------------------
    // Error handling
    // -----------------------------------------------------------------------

    test('CS-ERR-011: DND save 500 failure — button text reverts to original', async () => {
      await loadSettings(page);
      const original = await getDndText(page);

      // Intercept only PUT requests so the initial GET (loadSettings) still works.
      await page.route('**/features/doNotDisturb*', async (route) => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({status: 500, body: 'Internal Server Error'});
        } else {
          await route.continue();
        }
      });

      // Click DND — text flips optimistically, then reverts on non-204.
      // toggleDNDSetting() calls toggleButton() again on failure, restoring the
      // original text.
      await page.locator(CALLING_SELECTORS.DND_BTN).click({timeout: AWAIT_TIMEOUT});
      await expect(page.locator(CALLING_SELECTORS.DND_BTN)).toHaveText(original, {
        timeout: OPERATION_TIMEOUT,
      });

      await page.unroute('**/features/doNotDisturb*');
    });
  });
}
