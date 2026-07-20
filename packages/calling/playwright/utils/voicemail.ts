import {expect, Page, TestInfo} from '@playwright/test';
import {AWAIT_TIMEOUT, CALLING_SELECTORS} from '../constants';

export type VoicemailQuery = {
  offset?: number;
  limit?: number;
  sort?: 'ASC' | 'DESC';
  refresh?: boolean;
};

export type VoicemailRecord = {
  duration?: {$?: string | number};
  callingPartyInfo?: {
    name?: {$?: string};
    userId?: {$?: string};
    address?: {$?: string};
    userExternalId?: {$?: string};
  };
  time?: {$?: string | number};
  messageId?: {$?: string};
  read?: {$?: string} | Record<string, never> | string | boolean;
  Read?: string | boolean;
};

export type VoicemailRow = {
  callerName: string;
  duration: string;
  dateTime: string;
};

const DEFAULT_VOICEMAIL_QUERY: Required<VoicemailQuery> = {
  offset: 0,
  limit: 20,
  sort: 'DESC',
  refresh: true,
};

const VOICEMAIL_EVENTUAL_CONSISTENCY_TIMEOUT = 240000;
const VOICEMAIL_POLL_INTERVALS = [5000, 10000, 15000];
const VOICEMAIL_RECENT_RECORD_TOLERANCE_MS = 120000;

const normalizePhoneNumber = (value?: string): string => (value ?? '').replace(/\D/g, '');

const textField = (value?: {$?: string | number}): string => {
  if (value?.$ === undefined || value.$ === null) {
    return '';
  }

  return String(value.$);
};

export const ensureVoicemailInitialized = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    const win = window as any;
    const voicemail = win.voicemail;

    if (!voicemail) {
      throw new Error('window.voicemail is not available');
    }

    if (!win.__voicemailInitPromise) {
      win.__voicemailInitPromise = Promise.resolve(voicemail.init()).catch((error) => {
        delete win.__voicemailInitPromise;
        throw error;
      });
    }

    await win.__voicemailInitPromise;
  });
};

export const getVoicemailMessageId = (record: VoicemailRecord): string =>
  textField(record.messageId);

export const getVoicemailTimestamp = (record: VoicemailRecord): number => {
  const timestamp = Number(record.time?.$);

  return Number.isNaN(timestamp) ? 0 : timestamp;
};

export const isVoicemailRead = (record: VoicemailRecord): boolean => {
  if (typeof record.Read === 'boolean') {
    return record.Read;
  }

  if (typeof record.Read === 'string') {
    return record.Read === 'true';
  }

  const {read} = record;

  if (typeof read === 'boolean') {
    return read;
  }

  if (typeof read === 'string') {
    return read === 'true';
  }

  if (read && '$' in read) {
    return read.$ === 'true';
  }

  if (read && Object.keys(read).length === 0) {
    return true;
  }

  // Missing read markers mean unread.
  return false;
};

export const voicemailMatchesCaller = (
  record: VoicemailRecord,
  phoneNumber: string,
  minDigits = 7
): boolean => {
  const expectedTail = normalizePhoneNumber(phoneNumber).slice(-minDigits);

  if (!expectedTail) {
    return false;
  }

  const candidates = [
    record.callingPartyInfo?.address?.$,
    record.callingPartyInfo?.name?.$,
    record.callingPartyInfo?.userId?.$,
    record.callingPartyInfo?.userExternalId?.$,
  ];

  return candidates.some((candidate) => normalizePhoneNumber(candidate).endsWith(expectedTail));
};

export const getVoicemailRecords = async (
  page: Page,
  options: VoicemailQuery = {}
): Promise<VoicemailRecord[]> => {
  const query = {...DEFAULT_VOICEMAIL_QUERY, ...options};

  await ensureVoicemailInitialized(page);

  return page.evaluate(async ({offset, limit, sort, refresh}) => {
    const voicemail = (window as any).voicemail;

    if (!voicemail) {
      throw new Error('window.voicemail is not available');
    }

    const response = await voicemail.getVoicemailList(offset, limit, sort, refresh);

    if (response?.statusCode >= 400) {
      const error = response?.data?.error ?? response?.message ?? 'unknown error';

      throw new Error(`getVoicemailList failed with status ${response.statusCode}: ${error}`);
    }

    return JSON.parse(JSON.stringify(response?.data?.voicemailList ?? []));
  }, query);
};

export const waitForVoicemailFromCaller = async (
  page: Page,
  callerNumber: string,
  startedAt: Date,
  existingMessageIds: string[] = []
): Promise<VoicemailRecord> => {
  const existingMessages = new Set(existingMessageIds);
  let matchingRecord: VoicemailRecord | undefined;

  await expect
    .poll(
      async () => {
        const records = await getVoicemailRecords(page, {refresh: true});

        matchingRecord = records.find((record) => {
          const messageId = getVoicemailMessageId(record);
          const timestamp = getVoicemailTimestamp(record);

          return (
            !existingMessages.has(messageId) &&
            voicemailMatchesCaller(record, callerNumber) &&
            timestamp >= startedAt.getTime() - VOICEMAIL_RECENT_RECORD_TOLERANCE_MS
          );
        });

        return Boolean(matchingRecord);
      },
      {
        timeout: VOICEMAIL_EVENTUAL_CONSISTENCY_TIMEOUT,
        intervals: VOICEMAIL_POLL_INTERVALS,
        message: `Expected new voicemail from caller ${callerNumber}`,
      }
    )
    .toBe(true);

  return matchingRecord as VoicemailRecord;
};

export const readVoicemailRowsFromUi = async (page: Page): Promise<VoicemailRow[]> => {
  const rows = await page
    .locator(CALLING_SELECTORS.VOICEMAIL_TABLE_ROWS)
    .evaluateAll((rowElements) =>
      rowElements.map((row) =>
        Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? '')
      )
    );

  return rows.map((cells) => ({
    callerName: cells[0] ?? '',
    duration: cells[1] ?? '',
    dateTime: cells[2] ?? '',
  }));
};

export const openVoicemailList = async (page: Page): Promise<VoicemailRow[]> => {
  await expect(page.locator(CALLING_SELECTORS.VOICEMAIL_BTN)).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await page.locator(CALLING_SELECTORS.VOICEMAIL_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(`${CALLING_SELECTORS.VOICEMAIL_TABLE} th`)).toHaveCount(4, {
    timeout: AWAIT_TIMEOUT,
  });
  await expect(page.locator(CALLING_SELECTORS.VOICEMAIL_TABLE_ROWS).first()).toBeVisible({
    timeout: VOICEMAIL_EVENTUAL_CONSISTENCY_TIMEOUT,
  });

  return readVoicemailRowsFromUi(page);
};

const findVoicemailRowIndexByMessageId = async (page: Page, messageId: string): Promise<number> =>
  page.evaluate(
    ({tableSelector, targetMessageId}) => {
      const rows = Array.from(
        document.querySelectorAll<HTMLTableRowElement>(`${tableSelector} tbody tr`)
      );

      return rows.findIndex((row) =>
        Array.from(row.querySelectorAll<HTMLAudioElement>('audio')).some(
          (audio) => audio.id === targetMessageId
        )
      );
    },
    {tableSelector: CALLING_SELECTORS.VOICEMAIL_TABLE, targetMessageId: messageId}
  );

export const expectVoicemailVisibleInUi = async (
  page: Page,
  record: VoicemailRecord
): Promise<VoicemailRow> => {
  const messageId = getVoicemailMessageId(record);
  let rowIndex = await findVoicemailRowIndexByMessageId(page, messageId);

  if (rowIndex === -1) {
    await openVoicemailList(page);
    rowIndex = await findVoicemailRowIndexByMessageId(page, messageId);
  }

  expect(rowIndex, `Expected voicemail row for message ${messageId}`).toBeGreaterThanOrEqual(0);

  const rows = await readVoicemailRowsFromUi(page);

  return rows[rowIndex];
};

export const expectVoicemailVisibleInCurrentUi = async (
  page: Page,
  record: VoicemailRecord
): Promise<VoicemailRow> => {
  const messageId = getVoicemailMessageId(record);
  const rowIndex = await findVoicemailRowIndexByMessageId(page, messageId);

  expect(rowIndex, `Expected voicemail row for message ${messageId}`).toBeGreaterThanOrEqual(0);

  const rows = await readVoicemailRowsFromUi(page);

  return rows[rowIndex];
};

export const markVoicemailUnread = async (page: Page, messageId: string): Promise<void> => {
  await ensureVoicemailInitialized(page);

  const statusCode = await page.evaluate(async (id) => {
    const response = await (window as any).voicemail.voicemailMarkAsUnread(id);

    return response?.statusCode;
  }, messageId);

  expect([200, 204]).toContain(statusCode);
};

export const waitForVoicemailReadState = async (
  page: Page,
  messageId: string,
  expectedRead: boolean
): Promise<VoicemailRecord> => {
  let matchingRecord: VoicemailRecord | undefined;

  await expect
    .poll(
      async () => {
        const records = await getVoicemailRecords(page, {refresh: true});

        matchingRecord = records.find((record) => getVoicemailMessageId(record) === messageId);

        return matchingRecord ? isVoicemailRead(matchingRecord) : undefined;
      },
      {
        timeout: VOICEMAIL_EVENTUAL_CONSISTENCY_TIMEOUT,
        intervals: VOICEMAIL_POLL_INTERVALS,
        message: `Expected voicemail ${messageId} read=${expectedRead}`,
      }
    )
    .toBe(expectedRead);

  return matchingRecord as VoicemailRecord;
};

export const waitForVoicemailPlaybackToEnd = async (
  page: Page,
  messageId: string,
  timeoutMs: number
): Promise<void> => {
  await expect
    .poll(
      () =>
        page.evaluate((id) => {
          const audio = document.getElementById(id) as HTMLAudioElement | null;

          if (!audio) {
            return false;
          }

          const duration = Number.isFinite(audio.duration) ? audio.duration : 0;

          return audio.ended || (duration > 0 && audio.currentTime >= duration);
        }, messageId),
      {
        timeout: timeoutMs,
        intervals: [1000],
        message: `Expected voicemail audio ${messageId} to finish playback`,
      }
    )
    .toBe(true);
};

const expectVoicemailReadInUi = async (page: Page, rowIndex: number): Promise<void> => {
  await expect(page.locator(`#read${rowIndex}`)).toBeHidden({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(`#unread${rowIndex}`)).toBeVisible({timeout: AWAIT_TIMEOUT});
};

export const playVoicemailFromUi = async (
  page: Page,
  messageId: string,
  playbackTimeoutMs = 120000
): Promise<void> => {
  const rowIndex = await findVoicemailRowIndexByMessageId(page, messageId);

  expect(rowIndex, `Expected voicemail row for message ${messageId}`).toBeGreaterThanOrEqual(0);

  const row = page.locator(CALLING_SELECTORS.VOICEMAIL_TABLE_ROWS).nth(rowIndex);

  await row.locator('input[value="Play"]').click({timeout: AWAIT_TIMEOUT});
  await waitForVoicemailPlaybackToEnd(page, messageId, playbackTimeoutMs);
  await expectVoicemailReadInUi(page, rowIndex);
};

export const deleteVoicemail = async (page: Page, messageId: string): Promise<void> => {
  if (process.env.KEEP_TEST_VOICEMAIL === 'true') {
    return;
  }

  if (page.isClosed()) {
    return;
  }

  await ensureVoicemailInitialized(page).catch(() => {});

  await page
    .evaluate(async (id) => {
      await (window as any).voicemail.deleteVoicemail(id);
    }, messageId)
    .catch(() => {});
};

export const attachVoicemailSummary = async (
  testInfo: TestInfo,
  label: string,
  record: VoicemailRecord
): Promise<void> => {
  const summary = {
    messageId: getVoicemailMessageId(record),
    callerName: record.callingPartyInfo?.name?.$,
    callerAddress: record.callingPartyInfo?.address?.$,
    timestamp: getVoicemailTimestamp(record),
    read: isVoicemailRead(record),
    duration: record.duration?.$,
  };

  testInfo.annotations.push({
    type: 'voicemail',
    description: `${label}: ${summary.callerAddress ?? summary.callerName ?? 'unknown caller'}`,
  });
  await testInfo.attach(`${label}-voicemail-summary.json`, {
    body: JSON.stringify(summary, null, 2),
    contentType: 'application/json',
  });
};
