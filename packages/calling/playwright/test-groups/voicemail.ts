import {test, expect, Page} from '@playwright/test';
import {TestManager} from '../test-manager';
import {getPhoneNumber} from '../test-data';
import {
  cleanupActiveCalls,
  endCallerIfStillActive,
  makeCall,
  waitForCallDisconnect,
  waitForCallEstablished,
  waitForCallerOutboundCall,
} from '../utils/call';
import {
  loadSettings,
  saveVoicemailSettings,
  setVoicemailSendAllCalls,
  setVoicemailSendBusyCalls,
  setVoicemailSendUnansweredCalls,
} from '../utils/call-settings';
import {
  attachVoicemailSummary,
  deleteVoicemail,
  expectVoicemailVisibleInCurrentUi,
  expectVoicemailVisibleInUi,
  fetchVoicemailPageFromUi,
  getVoicemailMessageId,
  getVoicemailRecords,
  markVoicemailUnread,
  openVoicemailList,
  playVoicemailFromUi,
  waitForVoicemailFromCaller,
} from '../utils/voicemail';
import {CALLING_SELECTORS} from '../constants';

const VOICEMAIL_FORWARD_TIMEOUT = 60000;
const VOICEMAIL_RECORDING_DURATION_MS = 15000;
const VOICEMAIL_SETTINGS_PROPAGATION_MS = 5000;
const VOICEMAIL_PLAYBACK_TIMEOUT_MS = 60000;

const ensureVoicemailEnabled = async (calleePage: Page) => {
  const enabled = calleePage.locator(CALLING_SELECTORS.VM_ENABLED_CB);

  if (!(await enabled.isChecked())) {
    await enabled.check();
    await saveVoicemailSettings(calleePage);
  }
};

const configureVoicemailForUnansweredCalls = async (calleePage: Page) => {
  await loadSettings(calleePage);
  await ensureVoicemailEnabled(calleePage);
  await loadSettings(calleePage);
  await setVoicemailSendAllCalls(calleePage, false);
  await setVoicemailSendBusyCalls(calleePage, false);
  await setVoicemailSendUnansweredCalls(calleePage, true, '2');
  await loadSettings(calleePage);

  await expect(calleePage.locator(CALLING_SELECTORS.VM_ENABLED_CB)).toBeChecked();
  await expect(calleePage.locator(CALLING_SELECTORS.VM_SEND_ALL_CB)).not.toBeChecked();
  await expect(calleePage.locator(CALLING_SELECTORS.VM_SEND_BUSY_CB)).not.toBeChecked();
  await expect(calleePage.locator(CALLING_SELECTORS.VM_UNANSWERED_CB)).toBeChecked();
  await expect(calleePage.locator(CALLING_SELECTORS.VM_UNANSWERED_RINGS)).toHaveValue('2');
  await calleePage.waitForTimeout(VOICEMAIL_SETTINGS_PROPAGATION_MS);
};

export function voicemailTests() {
  test.describe('Voicemail', () => {
    test.describe.configure({mode: 'serial', timeout: 900000});

    let tm: TestManager;
    let callerNumber: string;
    let calleeNumber: string;

    test.beforeAll(async ({browser}, testInfo) => {
      tm = new TestManager(testInfo.project.name);
      await tm.setupContext(browser, 0, {
        initSDK: true,
        service: 'calling',
        register: true,
        media: true,
      });
      await tm.setupContext(browser, 1, {
        initSDK: true,
        service: 'calling',
        register: true,
        media: true,
      });
      callerNumber = getPhoneNumber(tm.userSet.accounts[0], tm.isInt);
      calleeNumber = getPhoneNumber(tm.userSet.accounts[1], tm.isInt);
    });

    test.afterEach(async () => {
      await Promise.all([
        cleanupActiveCalls(tm.getPage(tm.userSet.accounts[0])),
        cleanupActiveCalls(tm.getPage(tm.userSet.accounts[1])),
      ]);
      if (!tm.page.isClosed()) {
        await tm.page.waitForTimeout(3000);
      }
    });

    test.afterAll(async () => {
      await tm.cleanup();
    });

    /* eslint-disable no-empty-pattern */
    test('VM-CALL-001: Unanswered call creates voicemail that can be listed, played, marked read, and paginated', async ({}, testInfo) => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);
      let messageId: string | undefined;

      await configureVoicemailForUnansweredCalls(calleePage);
      const existingMessageIds = await getVoicemailRecords(calleePage, {
        offset: 0,
        limit: 50,
        refresh: true,
      }).then((records) => records.map(getVoicemailMessageId).filter(Boolean));
      const startedAt = new Date(Date.now() - 5000);

      try {
        await makeCall(callerPage, calleeNumber);
        await waitForCallerOutboundCall(callerPage);

        await expect(calleePage.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN)).toBeEnabled({
          timeout: 30000,
        });
        await expect(calleePage.locator(CALLING_SELECTORS.INCOMING_ANSWER_BTN)).toBeDisabled({
          timeout: VOICEMAIL_FORWARD_TIMEOUT,
        });

        await waitForCallEstablished(callerPage, VOICEMAIL_FORWARD_TIMEOUT);
        await callerPage.waitForTimeout(VOICEMAIL_RECORDING_DURATION_MS);
        await endCallerIfStillActive(callerPage);
        await waitForCallDisconnect(callerPage, VOICEMAIL_FORWARD_TIMEOUT).catch(() => {});

        const voicemailRecord = await waitForVoicemailFromCaller(
          calleePage,
          callerNumber,
          startedAt,
          existingMessageIds
        );
        messageId = getVoicemailMessageId(voicemailRecord);
        await attachVoicemailSummary(testInfo, 'created', voicemailRecord);

        await markVoicemailUnread(calleePage, messageId);
        await openVoicemailList(calleePage);
        await expectVoicemailVisibleInUi(calleePage, voicemailRecord);

        await playVoicemailFromUi(calleePage, messageId, VOICEMAIL_PLAYBACK_TIMEOUT_MS);
        const readRecord = await getVoicemailRecords(calleePage, {offset: 0, limit: 20}).then(
          (records) => records.find((record) => getVoicemailMessageId(record) === messageId)
        );
        if (!readRecord) {
          throw new Error(`Expected voicemail ${messageId} after play`);
        }
        await attachVoicemailSummary(testInfo, 'read-after-play', readRecord);

        const firstPageRecords = await getVoicemailRecords(calleePage, {
          offset: 0,
          limit: 1,
          refresh: true,
        });

        expect(firstPageRecords.length).toBe(1);
        const paginationRows = await fetchVoicemailPageFromUi(calleePage, 0, 1);

        expect(paginationRows.length).toBe(1);
        await expectVoicemailVisibleInCurrentUi(calleePage, firstPageRecords[0]);
        await playVoicemailFromUi(
          calleePage,
          getVoicemailMessageId(firstPageRecords[0]),
          VOICEMAIL_PLAYBACK_TIMEOUT_MS
        );
      } finally {
        await cleanupActiveCalls(callerPage);
        await loadSettings(calleePage).catch(() => {});
        await setVoicemailSendUnansweredCalls(calleePage, false).catch(() => {});

        if (messageId) {
          await deleteVoicemail(calleePage, messageId);
        }
      }
    });
  });
}
