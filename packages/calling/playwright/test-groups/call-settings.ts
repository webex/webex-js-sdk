import {test, expect, Page} from '@playwright/test';
import {TestManager} from '../test-manager';
import {getPhoneNumber} from '../test-data';
import {
  CALLING_SELECTORS,
  AWAIT_TIMEOUT,
  OPERATION_TIMEOUT,
  POST_ACTION_SETTLE_MS,
} from '../constants';
import {
  loadSettings,
  getDndText,
  clickDnd,
  ensureDndState,
  saveCfSettings,
  saveVoicemailSettings,
  setCallForwardAlways,
  setCallForwardNoAnswer,
  setCallForwardNotReachable,
  setCallForwardBusy,
  setVoicemailSendAllCalls,
  setVoicemailSendBusyCalls,
  setVoicemailSendUnansweredCalls,
} from '../utils/call-settings';
import {
  makeCall,
  cleanupActiveCalls,
  waitForCallerOutboundCall,
  answerCall,
  waitForCallEstablished,
} from '../utils/call';

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
    // CS-GET-001: All UI settles after Get Settings
    // -----------------------------------------------------------------------

    test('CS-GET-001: Get Settings — all UI fields settle and become enabled', async () => {
      // Buttons must be visible before clicking
      await expect(page.locator(CALLING_SELECTORS.FETCH_SETTINGS_BTN)).toBeVisible({
        timeout: AWAIT_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.DND_BTN)).toBeVisible({timeout: AWAIT_TIMEOUT});
      await expect(page.locator(CALLING_SELECTORS.CALL_WAITING_BTN)).toBeVisible({
        timeout: AWAIT_TIMEOUT,
      });

      await page.locator(CALLING_SELECTORS.FETCH_SETTINGS_BTN).click({timeout: AWAIT_TIMEOUT});

      // DND settles to a real state
      await expect(page.locator(CALLING_SELECTORS.DND_BTN)).toHaveText(
        /^(DND Enabled|DND Disabled)$/,
        {timeout: OPERATION_TIMEOUT}
      );

      // Call Waiting settles (not stuck on loading text)
      await expect(page.locator(CALLING_SELECTORS.CALL_WAITING_BTN)).not.toHaveText(
        'Fetching Call Waiting Status',
        {timeout: OPERATION_TIMEOUT}
      );

      // CF form checkboxes become enabled
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

      // Voicemail checkboxes become enabled
      await expect(page.locator(CALLING_SELECTORS.VM_ENABLED_CB)).toBeEnabled({
        timeout: OPERATION_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.VM_SEND_BUSY_CB)).toBeEnabled({
        timeout: OPERATION_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.VM_UNANSWERED_CB)).toBeEnabled({
        timeout: OPERATION_TIMEOUT,
      });
    });

    // -----------------------------------------------------------------------
    // CS-DND-002: DND toggle round-trip
    // -----------------------------------------------------------------------

    test('CS-DND-002: DND toggle — enable, verify, disable, verify', async () => {
      await loadSettings(page);

      // Toggle ON
      await ensureDndState(page, 'DND Disabled');
      const afterOn = await clickDnd(page);
      expect(afterOn).toBe('DND Enabled');

      // Toggle OFF
      const afterOff = await clickDnd(page);
      expect(afterOff).toBe('DND Disabled');

      // Leave DND off for subsequent tests
      await ensureDndState(page, 'DND Disabled');
    });

    // -----------------------------------------------------------------------
    // CS-CF-003 to CS-CF-006: Call Forward enable/disable round-trips
    // -----------------------------------------------------------------------

    test('CS-CF-003: CF Always — enable with destination, verify, disable, verify', async () => {
      await loadSettings(page);
      const originalChecked = await page.locator(CALLING_SELECTORS.CF_ALWAYS_CB).isChecked();

      // Ensure disabled first
      if (originalChecked) {
        await setCallForwardAlways(page, false);
        await loadSettings(page);
      }

      // Enable and verify
      await setCallForwardAlways(page, true, cfDestination);
      await loadSettings(page);
      await expect(page.locator(CALLING_SELECTORS.CF_ALWAYS_CB)).toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });

      // Disable and verify
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

    test('CS-CF-004: CF When Busy — enable with destination, verify, disable, verify', async () => {
      await loadSettings(page);
      const originalChecked = await page.locator(CALLING_SELECTORS.CF_BUSY_CB).isChecked();

      // Ensure disabled first
      if (originalChecked) {
        await setCallForwardBusy(page, false);
        await loadSettings(page);
      }

      // Enable and verify
      await setCallForwardBusy(page, true, cfDestination);
      await loadSettings(page);
      await expect(page.locator(CALLING_SELECTORS.CF_BUSY_CB)).toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });

      // Disable and verify
      await setCallForwardBusy(page, false);
      await loadSettings(page);
      await expect(page.locator(CALLING_SELECTORS.CF_BUSY_CB)).not.toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });

      // Restore
      if (originalChecked) {
        await setCallForwardBusy(page, true, cfDestination);
      }
    });

    test('CS-CF-005: CF No Answer — enable with destination and numberOfRings, verify, disable, verify', async () => {
      await loadSettings(page);
      const originalChecked = await page.locator(CALLING_SELECTORS.CF_NO_ANSWER_CB).isChecked();

      // Ensure disabled first
      if (originalChecked) {
        await setCallForwardNoAnswer(page, false);
        await loadSettings(page);
      }

      // Enable, set destination and numberOfRings, save
      await page.locator(CALLING_SELECTORS.CF_NO_ANSWER_CB).check({timeout: AWAIT_TIMEOUT});
      await page
        .locator(CALLING_SELECTORS.CF_NO_ANSWER_DEST)
        .waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
      await page.locator(CALLING_SELECTORS.CF_NO_ANSWER_DEST).fill(cfDestination);
      const targetRings = '4';
      await page.locator(CALLING_SELECTORS.CF_NO_ANSWER_RINGS).fill(targetRings);
      await saveCfSettings(page);

      // Reload and verify enabled + numberOfRings persisted
      await loadSettings(page);
      await expect(page.locator(CALLING_SELECTORS.CF_NO_ANSWER_CB)).toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.CF_NO_ANSWER_RINGS)).toHaveValue(targetRings, {
        timeout: OPERATION_TIMEOUT,
      });

      // Disable and verify
      await setCallForwardNoAnswer(page, false);
      await loadSettings(page);
      await expect(page.locator(CALLING_SELECTORS.CF_NO_ANSWER_CB)).not.toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });

      // Restore
      if (originalChecked) {
        await setCallForwardNoAnswer(page, true, cfDestination);
      }
    });

    test('CS-CF-006: CF Not Reachable — enable with destination, verify, disable, verify', async () => {
      await loadSettings(page);
      const originalChecked = await page.locator(CALLING_SELECTORS.CF_NOT_REACHABLE_CB).isChecked();

      // Ensure disabled first
      if (originalChecked) {
        await setCallForwardNotReachable(page, false);
        await loadSettings(page);
      }

      // Enable and verify
      await setCallForwardNotReachable(page, true, cfDestination);
      await loadSettings(page);
      await expect(page.locator(CALLING_SELECTORS.CF_NOT_REACHABLE_CB)).toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });

      // Disable and verify
      await setCallForwardNotReachable(page, false);
      await loadSettings(page);
      await expect(page.locator(CALLING_SELECTORS.CF_NOT_REACHABLE_CB)).not.toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });

      // Restore
      if (originalChecked) {
        await setCallForwardNotReachable(page, true, cfDestination);
      }
    });

    // -----------------------------------------------------------------------
    // CS-CFA-007: Get CF Always by directory number
    // -----------------------------------------------------------------------

    test('CS-CFA-007: Get CF Always — lookup returns callForwarding.always from API', async () => {
      const directoryNumber = getPhoneNumber('USER_1');

      await page
        .locator(CALLING_SELECTORS.CF_DIRECTORY_NUMBER)
        .fill(directoryNumber, {timeout: AWAIT_TIMEOUT});

      const cfGetResponse = page.waitForResponse(
        (r) => r.url().includes('callForwarding') && r.request().method() === 'GET' && r.ok(),
        {timeout: OPERATION_TIMEOUT}
      );

      await page.locator(CALLING_SELECTORS.CF_ALWAYS_BTN).click({timeout: AWAIT_TIMEOUT});

      const response = await cfGetResponse;
      const body = await response.json();

      expect(body.callForwarding?.always).toBeDefined();
      expect(typeof body.callForwarding.always.enabled).toBe('boolean');
    });

    // -----------------------------------------------------------------------
    // CS-ERR-008: DND save failure — button reverts
    // -----------------------------------------------------------------------

    test('CS-ERR-008: DND save 500 failure — button text reverts to original', async () => {
      await loadSettings(page);
      const original = await getDndText(page);

      const routeHandler = async (route) => {
        if (route.request().method() === 'PUT') {
          await route.fulfill({status: 500, body: 'Internal Server Error'});
        } else {
          await route.continue();
        }
      };

      await page.route('**/features/doNotDisturb*', routeHandler);
      try {
        await page.locator(CALLING_SELECTORS.DND_BTN).click({timeout: AWAIT_TIMEOUT});
        await expect(page.locator(CALLING_SELECTORS.DND_BTN)).toHaveText(original, {
          timeout: OPERATION_TIMEOUT,
        });
      } finally {
        await page.unroute('**/features/doNotDisturb*', routeHandler);
      }
    });

    // -----------------------------------------------------------------------
    // CS-VM-009: Voicemail — load, sendBusyCalls toggle, numberOfRings persist
    // -----------------------------------------------------------------------

    test('CS-VM-009: Voicemail — form loads, sendBusyCalls toggle and numberOfRings persist', async () => {
      await loadSettings(page);

      // Step 1 — verify all voicemail fields unlocked after load
      await expect(page.locator(CALLING_SELECTORS.VM_SEND_ALL_CB)).toBeEnabled({
        timeout: OPERATION_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.VM_SEND_BUSY_CB)).toBeEnabled({
        timeout: OPERATION_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.VM_UNANSWERED_CB)).toBeEnabled({
        timeout: OPERATION_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.VM_MWI_CB)).toBeEnabled({
        timeout: OPERATION_TIMEOUT,
      });

      // Step 2 — toggle sendBusyCalls to opposite state, save, reload, verify
      const originalBusy = await page.locator(CALLING_SELECTORS.VM_SEND_BUSY_CB).isChecked();
      if (originalBusy) {
        await page.locator(CALLING_SELECTORS.VM_SEND_BUSY_CB).uncheck({timeout: AWAIT_TIMEOUT});
      } else {
        await page.locator(CALLING_SELECTORS.VM_SEND_BUSY_CB).check({timeout: AWAIT_TIMEOUT});
      }
      await saveVoicemailSettings(page);
      await loadSettings(page);

      if (originalBusy) {
        await expect(page.locator(CALLING_SELECTORS.VM_SEND_BUSY_CB)).not.toBeChecked({
          timeout: OPERATION_TIMEOUT,
        });
      } else {
        await expect(page.locator(CALLING_SELECTORS.VM_SEND_BUSY_CB)).toBeChecked({
          timeout: OPERATION_TIMEOUT,
        });
      }

      // Restore sendBusyCalls
      if (originalBusy) {
        await page.locator(CALLING_SELECTORS.VM_SEND_BUSY_CB).check({timeout: AWAIT_TIMEOUT});
      } else {
        await page.locator(CALLING_SELECTORS.VM_SEND_BUSY_CB).uncheck({timeout: AWAIT_TIMEOUT});
      }
      await saveVoicemailSettings(page);

      // Step 3 — set numberOfRings for sendUnansweredCalls, save, reload, verify
      await loadSettings(page);
      const originalUnanswered = await page.locator(CALLING_SELECTORS.VM_UNANSWERED_CB).isChecked();
      const originalRings = await page.locator(CALLING_SELECTORS.VM_UNANSWERED_RINGS).inputValue();

      try {
        if (!originalUnanswered) {
          await page.locator(CALLING_SELECTORS.VM_UNANSWERED_CB).check({timeout: AWAIT_TIMEOUT});
        }

        const targetRings = '4';
        await page.locator(CALLING_SELECTORS.VM_UNANSWERED_RINGS).fill(targetRings, {force: true});
        await saveVoicemailSettings(page);

        await loadSettings(page);
        await expect(page.locator(CALLING_SELECTORS.VM_UNANSWERED_RINGS)).toHaveValue(targetRings, {
          timeout: OPERATION_TIMEOUT,
        });
      } finally {
        await setVoicemailSendUnansweredCalls(page, originalUnanswered, originalRings);
      }
    });

    // -----------------------------------------------------------------------
    // CS-VM-010: sendAllCalls toggle persists
    // -----------------------------------------------------------------------

    test('CS-VM-010: Voicemail — sendAllCalls toggle saves and reloads correctly', async () => {
      await loadSettings(page);
      const original = await page.locator(CALLING_SELECTORS.VM_SEND_ALL_CB).isChecked();

      if (original) {
        await page.locator(CALLING_SELECTORS.VM_SEND_ALL_CB).uncheck({timeout: AWAIT_TIMEOUT});
      } else {
        await page.locator(CALLING_SELECTORS.VM_SEND_ALL_CB).check({timeout: AWAIT_TIMEOUT});
      }
      await saveVoicemailSettings(page);
      await loadSettings(page);

      if (original) {
        await expect(page.locator(CALLING_SELECTORS.VM_SEND_ALL_CB)).not.toBeChecked({
          timeout: OPERATION_TIMEOUT,
        });
      } else {
        await expect(page.locator(CALLING_SELECTORS.VM_SEND_ALL_CB)).toBeChecked({
          timeout: OPERATION_TIMEOUT,
        });
      }

      // Restore
      if (original) {
        await page.locator(CALLING_SELECTORS.VM_SEND_ALL_CB).check({timeout: AWAIT_TIMEOUT});
      } else {
        await page.locator(CALLING_SELECTORS.VM_SEND_ALL_CB).uncheck({timeout: AWAIT_TIMEOUT});
      }
      await saveVoicemailSettings(page);
    });

    // -----------------------------------------------------------------------
    // CS-VM-011: sendUnansweredCalls toggle persists
    // -----------------------------------------------------------------------

    test('CS-VM-011: Voicemail — sendUnansweredCalls toggle saves and reloads correctly', async () => {
      await loadSettings(page);
      const original = await page.locator(CALLING_SELECTORS.VM_UNANSWERED_CB).isChecked();

      if (original) {
        await page.locator(CALLING_SELECTORS.VM_UNANSWERED_CB).uncheck({timeout: AWAIT_TIMEOUT});
      } else {
        await page.locator(CALLING_SELECTORS.VM_UNANSWERED_CB).check({timeout: AWAIT_TIMEOUT});
      }
      await saveVoicemailSettings(page);
      await loadSettings(page);

      if (original) {
        await expect(page.locator(CALLING_SELECTORS.VM_UNANSWERED_CB)).not.toBeChecked({
          timeout: OPERATION_TIMEOUT,
        });
      } else {
        await expect(page.locator(CALLING_SELECTORS.VM_UNANSWERED_CB)).toBeChecked({
          timeout: OPERATION_TIMEOUT,
        });
      }

      // Restore
      if (original) {
        await page.locator(CALLING_SELECTORS.VM_UNANSWERED_CB).check({timeout: AWAIT_TIMEOUT});
      } else {
        await page.locator(CALLING_SELECTORS.VM_UNANSWERED_CB).uncheck({timeout: AWAIT_TIMEOUT});
      }
      await saveVoicemailSettings(page);
    });

    // -----------------------------------------------------------------------
    // CS-VM-012: MWI notification badge toggle persists
    // -----------------------------------------------------------------------

    test('CS-VM-012: Voicemail — MWI notification badge toggle saves and reloads correctly', async () => {
      await loadSettings(page);
      const original = await page.locator(CALLING_SELECTORS.VM_MWI_CB).isChecked();

      if (original) {
        await page.locator(CALLING_SELECTORS.VM_MWI_CB).uncheck({timeout: AWAIT_TIMEOUT});
      } else {
        await page.locator(CALLING_SELECTORS.VM_MWI_CB).check({timeout: AWAIT_TIMEOUT});
      }
      await saveVoicemailSettings(page);
      await loadSettings(page);

      if (original) {
        await expect(page.locator(CALLING_SELECTORS.VM_MWI_CB)).not.toBeChecked({
          timeout: OPERATION_TIMEOUT,
        });
      } else {
        await expect(page.locator(CALLING_SELECTORS.VM_MWI_CB)).toBeChecked({
          timeout: OPERATION_TIMEOUT,
        });
      }

      // Restore
      if (original) {
        await page.locator(CALLING_SELECTORS.VM_MWI_CB).check({timeout: AWAIT_TIMEOUT});
      } else {
        await page.locator(CALLING_SELECTORS.VM_MWI_CB).uncheck({timeout: AWAIT_TIMEOUT});
      }
      await saveVoicemailSettings(page);
    });

    // -----------------------------------------------------------------------
    // CS-VM-013: Overall voicemail enabled toggle persists
    // -----------------------------------------------------------------------

    test('CS-VM-013: Voicemail — overall enabled toggle saves and reloads correctly', async () => {
      await loadSettings(page);
      const original = await page.locator(CALLING_SELECTORS.VM_ENABLED_CB).isChecked();

      if (original) {
        await page.locator(CALLING_SELECTORS.VM_ENABLED_CB).uncheck({timeout: AWAIT_TIMEOUT});
      } else {
        await page.locator(CALLING_SELECTORS.VM_ENABLED_CB).check({timeout: AWAIT_TIMEOUT});
      }
      await saveVoicemailSettings(page);
      await loadSettings(page);

      if (original) {
        await expect(page.locator(CALLING_SELECTORS.VM_ENABLED_CB)).not.toBeChecked({
          timeout: OPERATION_TIMEOUT,
        });
      } else {
        await expect(page.locator(CALLING_SELECTORS.VM_ENABLED_CB)).toBeChecked({
          timeout: OPERATION_TIMEOUT,
        });
      }

      // Restore
      if (original) {
        await page.locator(CALLING_SELECTORS.VM_ENABLED_CB).check({timeout: AWAIT_TIMEOUT});
      } else {
        await page.locator(CALLING_SELECTORS.VM_ENABLED_CB).uncheck({timeout: AWAIT_TIMEOUT});
      }
      await saveVoicemailSettings(page);
    });

    // -----------------------------------------------------------------------
    // CS-VM-014: Get notifications via email — toggle and email ID persist
    // -----------------------------------------------------------------------

    test('CS-VM-014: Voicemail — email notification toggle and email ID save and reload correctly', async () => {
      await loadSettings(page);
      const originalChecked = await page.locator(CALLING_SELECTORS.VM_NOTIF_EMAIL_CB).isChecked();
      const originalEmail = await page.locator(CALLING_SELECTORS.VM_NOTIF_EMAIL_ID).inputValue();

      try {
        // Enable the checkbox so the email input is accessible.
        if (!originalChecked) {
          await page.locator(CALLING_SELECTORS.VM_NOTIF_EMAIL_CB).check({timeout: AWAIT_TIMEOUT});
        }

        // Fill a test email. The input may be hidden until the checkbox is checked;
        // force:true bypasses the visibility check (same pattern as vmNotAnsweredRings).
        const testEmail = 'autotest-notification@example.com';
        await page.locator(CALLING_SELECTORS.VM_NOTIF_EMAIL_ID).fill(testEmail, {force: true});
        await saveVoicemailSettings(page);
        await loadSettings(page);

        await expect(page.locator(CALLING_SELECTORS.VM_NOTIF_EMAIL_CB)).toBeChecked({
          timeout: OPERATION_TIMEOUT,
        });
        await expect(page.locator(CALLING_SELECTORS.VM_NOTIF_EMAIL_ID)).toHaveValue(testEmail, {
          timeout: OPERATION_TIMEOUT,
        });
      } finally {
        if (originalChecked) {
          await page
            .locator(CALLING_SELECTORS.VM_NOTIF_EMAIL_ID)
            .fill(originalEmail, {force: true});
        } else {
          await page.locator(CALLING_SELECTORS.VM_NOTIF_EMAIL_CB).uncheck({timeout: AWAIT_TIMEOUT});
        }
        await saveVoicemailSettings(page);
      }
    });

    // -----------------------------------------------------------------------
    // CS-VM-015: Get voice messages via email — toggle and email ID persist
    // -----------------------------------------------------------------------

    test('CS-VM-015: Voicemail — email copy toggle and email ID save and reload correctly', async () => {
      await loadSettings(page);
      const originalChecked = await page.locator(CALLING_SELECTORS.VM_EMAIL_COPY_CB).isChecked();
      const originalEmail = await page.locator(CALLING_SELECTORS.VM_EMAIL_COPY_ID).inputValue();

      try {
        // Enable the checkbox so the email input is accessible.
        if (!originalChecked) {
          await page.locator(CALLING_SELECTORS.VM_EMAIL_COPY_CB).check({timeout: AWAIT_TIMEOUT});
        }

        const testEmail = 'autotest-emailcopy@example.com';
        await page.locator(CALLING_SELECTORS.VM_EMAIL_COPY_ID).fill(testEmail, {force: true});
        await saveVoicemailSettings(page);
        await loadSettings(page);

        await expect(page.locator(CALLING_SELECTORS.VM_EMAIL_COPY_CB)).toBeChecked({
          timeout: OPERATION_TIMEOUT,
        });
        await expect(page.locator(CALLING_SELECTORS.VM_EMAIL_COPY_ID)).toHaveValue(testEmail, {
          timeout: OPERATION_TIMEOUT,
        });
      } finally {
        if (originalChecked) {
          await page.locator(CALLING_SELECTORS.VM_EMAIL_COPY_ID).fill(originalEmail, {force: true});
        } else {
          await page.locator(CALLING_SELECTORS.VM_EMAIL_COPY_CB).uncheck({timeout: AWAIT_TIMEOUT});
        }
        await saveVoicemailSettings(page);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// 3-user live call behavior tests
// Requires SET_CALL_SETTINGS to have 3 accounts:
//   accounts[0] = USER_3 — settings owner / callee
//   accounts[1] = USER_2 — primary caller (first call / busy-state setup)
//   accounts[2] = USER_1 — second caller (places call while USER_3 is already busy)
// ---------------------------------------------------------------------------

/**
 * How long to wait to confirm that an incoming call does NOT arrive.
 * Must be long enough for the server to have delivered the call if it were
 * going to (typically <5 s), but short enough to keep the suite fast.
 */
const NO_INCOMING_CALL_TIMEOUT = 20000;

export function callSettingsCallTests() {
  test.describe('Call Settings — Live Call Behavior', () => {
    test.describe.configure({mode: 'serial', timeout: 300000});

    let tm: TestManager;
    let calleePage: Page; // USER_3 — settings owner
    let callerPage: Page; // USER_2 — primary caller
    let secondCallerPage: Page; // USER_1 — second caller used while USER_3 is busy
    let calleeNumber: string;
    // Forward destination that is valid but has no active registration in this
    // test session, so forwarded calls reach voicemail rather than looping back.
    let cfDestination: string;

    test.beforeAll(async ({browser}, testInfo) => {
      tm = new TestManager(testInfo.project.name);
      await Promise.all([
        tm.setupContext(browser, 0, {
          initSDK: true,
          service: 'calling',
          register: true,
          media: true,
        }),
        tm.setupContext(browser, 1, {
          initSDK: true,
          service: 'calling',
          register: true,
          media: true,
        }),
        tm.setupContext(browser, 2, {
          initSDK: true,
          service: 'calling',
          register: true,
          media: true,
        }),
      ]);
      calleePage = tm.getPage(tm.userSet.accounts[0]);
      callerPage = tm.getPage(tm.userSet.accounts[1]);
      secondCallerPage = tm.getPage(tm.userSet.accounts[2]);
      calleeNumber = getPhoneNumber(tm.userSet.accounts[0]);
      // USER_4 is the CF forward destination. SET_CALL_SETTINGS depends on
      // SET_CALL (which owns/registers USER_4), so USER_4 is already deregistered
      // by the time these CF tests run — forwarded calls reach voicemail instead
      // of ringing a live device in another suite.
      cfDestination = getPhoneNumber('USER_4');

      // -----------------------------------------------------------------------
      // Reset all settings that could block incoming calls.
      // A previous test run may have crashed before its finally-block cleanup,
      // leaving settings (e.g. sendAllCalls, CF Always, DND) active on the
      // server.  This guarantees a clean baseline regardless of prior state.
      // -----------------------------------------------------------------------
      await loadSettings(calleePage);
      await setCallForwardAlways(calleePage, false);
      await setCallForwardBusy(calleePage, false);
      await setCallForwardNoAnswer(calleePage, false);
      await setCallForwardNotReachable(calleePage, false);
      await ensureDndState(calleePage, 'DND Disabled');
      await setVoicemailSendAllCalls(calleePage, false);
      await setVoicemailSendBusyCalls(calleePage, false);
      await setVoicemailSendUnansweredCalls(calleePage, false);
      // Allow the server to process all the resets before the first test runs.
      await calleePage.waitForTimeout(3000);
    });

    test.afterEach(async () => {
      await Promise.all([
        cleanupActiveCalls(callerPage),
        cleanupActiveCalls(calleePage),
        cleanupActiveCalls(secondCallerPage),
      ]);
      if (!callerPage.isClosed()) {
        await callerPage.waitForTimeout(3000);
      }
    });

    test.afterAll(async () => {
      await tm.cleanup();
    });

    // -----------------------------------------------------------------------
    // Call Forward Always — callee must not ring
    // -----------------------------------------------------------------------

    test('CS-CALL-101: CF Always enabled — callee does not receive the incoming call', async () => {
      await loadSettings(calleePage);
      await setCallForwardAlways(calleePage, true, cfDestination);
      // Allow the CF setting to propagate to the server before placing the call.
      await calleePage.waitForTimeout(5000);

      try {
        await makeCall(callerPage, calleeNumber);
        await waitForCallerOutboundCall(callerPage);

        // Wait the observation window, then assert the callee's answer button is
        // still disabled — it only becomes enabled when a line:incoming_call event
        // fires, so staying disabled confirms the call was forwarded before ringing.
        await calleePage.waitForTimeout(NO_INCOMING_CALL_TIMEOUT);
        await expect(calleePage.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN)).toBeDisabled();
      } finally {
        await cleanupActiveCalls(callerPage);
        await loadSettings(calleePage).catch(() => {});
        await setCallForwardAlways(calleePage, false);
        await calleePage.waitForTimeout(3000);
      }
    });

    // -----------------------------------------------------------------------
    // DND — callee must not ring
    // -----------------------------------------------------------------------

    test('CS-CALL-102: DND enabled — callee does not receive the incoming call', async () => {
      await loadSettings(calleePage);
      await ensureDndState(calleePage, 'DND Enabled');

      try {
        await makeCall(callerPage, calleeNumber);
        await waitForCallerOutboundCall(callerPage);

        // Wait the observation window, then assert the callee's answer button is
        // still disabled — DND prevents the line:incoming_call event from firing.
        await calleePage.waitForTimeout(NO_INCOMING_CALL_TIMEOUT);
        await expect(calleePage.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN)).toBeDisabled();
      } finally {
        await cleanupActiveCalls(callerPage);
        await loadSettings(calleePage).catch(() => {});
        await ensureDndState(calleePage, 'DND Disabled');
        await calleePage.waitForTimeout(3000);
      }
    });
    test('CS-CALL-103: CF When Busy — first call rings, second call is forwarded while callee is busy', async () => {
      test.setTimeout(360000);
      await loadSettings(calleePage);
      await setCallForwardBusy(calleePage, true, cfDestination);

      // Reload and verify the setting was persisted on the server.
      await loadSettings(calleePage);
      await expect(calleePage.locator(CALLING_SELECTORS.CF_BUSY_CB)).toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });
      await expect(calleePage.locator(CALLING_SELECTORS.CF_BUSY_DEST)).toHaveValue(cfDestination, {
        timeout: OPERATION_TIMEOUT,
      });
      // Allow the CF Busy setting to propagate before placing calls.
      await calleePage.waitForTimeout(5000);

      const callWaitingText = await calleePage
        .locator(CALLING_SELECTORS.CALL_WAITING_BTN)
        .innerText();
      const callWaitingEnabled = callWaitingText.includes('Enabled');

      try {
        // CF Busy only activates when the callee is already on a connected call.
        await makeCall(callerPage, calleeNumber);
        await waitForCallerOutboundCall(callerPage);
        await expect(calleePage.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN)).toBeEnabled({
          timeout: 30000,
        });
        await answerCall(calleePage);
        await Promise.all([waitForCallEstablished(callerPage), waitForCallEstablished(calleePage)]);
        await calleePage.waitForTimeout(POST_ACTION_SETTLE_MS);
        await calleePage.waitForFunction(
          () => {
            const connected = (window as any).callingClient?.getConnectedCall();

            return connected?.isConnected() === true;
          },
          {timeout: 30000}
        );

        // Second call while callee is busy.
        await makeCall(secondCallerPage, calleeNumber);
        await waitForCallerOutboundCall(secondCallerPage);

        // The first leg must remain established on both sides while the second call is handled.
        await expect
          .poll(
            async () =>
              calleePage.evaluate(() => {
                const connected = (window as any).callingClient?.getConnectedCall();

                return connected?.isConnected() === true;
              }),
            {timeout: NO_INCOMING_CALL_TIMEOUT}
          )
          .toBe(true);
        await expect
          .poll(
            async () =>
              callerPage.evaluate(() => {
                const calls = Object.values((window as any).callingClient.getActiveCalls()).flat();

                return calls.some((c: {isConnected: () => boolean}) => c.isConnected());
              }),
            {timeout: 5000}
          )
          .toBe(true);

        if (callWaitingEnabled) {
          // Call waiting presents the second leg locally; decline it and keep the active call up.
          await expect(calleePage.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN)).toBeEnabled({
            timeout: 30000,
          });
          await expect(calleePage.locator(CALLING_SELECTORS.END_BTN)).toBeEnabled({
            timeout: AWAIT_TIMEOUT,
          });
          await calleePage.locator(CALLING_SELECTORS.END_BTN).click({timeout: AWAIT_TIMEOUT});
          await calleePage.waitForFunction(
            () => {
              const connected = (window as any).callingClient?.getConnectedCall();

              return connected?.isConnected() === true;
            },
            {timeout: 30000}
          );
          await expect(calleePage.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN)).toBeDisabled({
            timeout: 30000,
          });
        } else {
          // Without call waiting, CF Busy should forward before the device rings.
          await expect
            .poll(
              async () => calleePage.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN).isDisabled(),
              {timeout: NO_INCOMING_CALL_TIMEOUT, intervals: [1000]}
            )
            .toBe(true);
        }
      } finally {
        await Promise.all([cleanupActiveCalls(callerPage), cleanupActiveCalls(secondCallerPage)]);
        await loadSettings(calleePage).catch(() => {});
        await setCallForwardBusy(calleePage, false);
        await calleePage.waitForTimeout(3000);
      }
    });

    // -----------------------------------------------------------------------
    // Call Forward No Answer — call arrives, then gets forwarded after timeout
    // -----------------------------------------------------------------------

    test('CS-CALL-104: CF No Answer — call is forwarded when callee does not answer', async () => {
      await loadSettings(calleePage);
      // Ensure CF Busy from CS-CALL-103 is fully cleared before enabling CF No Answer.
      await expect(calleePage.locator(CALLING_SELECTORS.CF_BUSY_CB)).not.toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });
      await setCallForwardNoAnswer(calleePage, true, cfDestination);

      // Reload and verify the setting was persisted on the server.
      await loadSettings(calleePage);
      await expect(calleePage.locator(CALLING_SELECTORS.CF_NO_ANSWER_CB)).toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });
      await expect(calleePage.locator(CALLING_SELECTORS.CF_NO_ANSWER_DEST)).toHaveValue(
        cfDestination,
        {timeout: OPERATION_TIMEOUT}
      );
      // Allow the CF No Answer setting to propagate before placing the call.
      await calleePage.waitForTimeout(5000);

      try {
        await makeCall(callerPage, calleeNumber);
        await waitForCallerOutboundCall(callerPage);

        // CF No Answer still lets the call ring on the device first.
        // Verify the incoming call arrives at the callee.
        await expect(calleePage.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN)).toBeEnabled({
          timeout: 30000,
        });

        // Don't answer — the server's no-answer timer fires and forwards the call.
        // Wait up to 45 s for the answer button to go back to disabled, confirming
        // the call left the device (was forwarded).
        await expect(calleePage.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN)).toBeDisabled({
          timeout: 45000,
        });
      } finally {
        await cleanupActiveCalls(callerPage);
        await loadSettings(calleePage).catch(() => {});
        await setCallForwardNoAnswer(calleePage, false);
        await calleePage.waitForTimeout(3000);
      }
    });

    // -----------------------------------------------------------------------
    // Voicemail sendAllCalls — callee must not ring
    // -----------------------------------------------------------------------

    test('CS-CALL-105: VM sendAllCalls enabled — callee does not receive the incoming call', async () => {
      await loadSettings(calleePage);
      await setVoicemailSendAllCalls(calleePage, true);
      // Allow the setting to propagate before placing the call.
      await calleePage.waitForTimeout(5000);

      try {
        await makeCall(callerPage, calleeNumber);
        await waitForCallerOutboundCall(callerPage);

        // sendAllCalls routes every call straight to voicemail before ringing.
        // The answer button must stay disabled for the full observation window.
        await calleePage.waitForTimeout(NO_INCOMING_CALL_TIMEOUT);
        await expect(calleePage.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN)).toBeDisabled();
      } finally {
        await cleanupActiveCalls(callerPage);
        await loadSettings(calleePage).catch(() => {});
        await setVoicemailSendAllCalls(calleePage, false);
        await calleePage.waitForTimeout(3000);
      }
    });

    // -----------------------------------------------------------------------
    // Voicemail sendUnansweredCalls — call rings then goes to voicemail
    // -----------------------------------------------------------------------

    test('CS-CALL-106: VM sendUnansweredCalls — call rings on device then goes to voicemail', async () => {
      await loadSettings(calleePage);
      // Use a low ring count so the test does not wait too long for the handoff.
      await setVoicemailSendUnansweredCalls(calleePage, true, '2');

      // Reload and verify the setting was persisted on the server.
      await loadSettings(calleePage);
      await expect(calleePage.locator(CALLING_SELECTORS.VM_UNANSWERED_CB)).toBeChecked({
        timeout: OPERATION_TIMEOUT,
      });
      await expect(calleePage.locator(CALLING_SELECTORS.VM_UNANSWERED_RINGS)).toHaveValue('2', {
        timeout: OPERATION_TIMEOUT,
      });
      await calleePage.waitForTimeout(5000);

      try {
        await makeCall(callerPage, calleeNumber);
        await waitForCallerOutboundCall(callerPage);

        // sendUnansweredCalls still lets the call ring first — button must become enabled.
        await expect(calleePage.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN)).toBeEnabled({
          timeout: 30000,
        });

        // Don't answer — after 2 rings the server forwards the call to voicemail.
        // The button goes back to disabled, confirming the call left the device.
        await expect(calleePage.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN)).toBeDisabled({
          timeout: 45000,
        });
      } finally {
        await cleanupActiveCalls(callerPage);
        await loadSettings(calleePage).catch(() => {});
        await setVoicemailSendUnansweredCalls(calleePage, false);
        await calleePage.waitForTimeout(3000);
      }
    });
  });
}
