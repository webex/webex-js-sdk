import {expect} from '@playwright/test';
import type {Page, Route} from '@playwright/test';
import {AWAIT_TIMEOUT, CALLING_SELECTORS} from '../constants';

type SortOrder = 'ASC' | 'DESC';
type SortBy = 'startTime' | 'endTime';

type CallHistoryQuery = {
  days?: number;
  limit?: number;
  sort?: SortOrder;
  sortBy?: SortBy;
};

type CallHistoryWaitOptions = CallHistoryQuery & {
  timeout?: number;
};

type HistoryTimeBounds = {
  notBefore?: Date;
  notAfter?: Date;
};

export type CallHistoryRecord = {
  sessionId?: string;
  direction?: string;
  disposition?: string;
  startTime?: string;
  endTime?: string;
  durationSeconds?: number;
  durationSecs?: number;
  sessionType?: string;
  other?: {
    name?: string;
    callbackAddress?: string;
    phoneNumber?: string;
    primaryDisplayString?: string;
    secondaryDisplayString?: string;
  };
  links?: {
    callbackAddress?: string;
  };
};

export type CallHistoryRow = {
  id: string;
  name: string;
  direction: string;
  disposition: string;
  startTime: string;
  endTime: string;
  sessionType: string;
  callbackAddress: string;
  redirectionReason: string;
  forwardedBy: string;
};

const DEFAULT_HISTORY_QUERY: Required<CallHistoryQuery> = {
  days: 1,
  limit: 20,
  sort: 'DESC',
  sortBy: 'endTime',
};

const HISTORY_URL_PATTERN = '**/history/userSessions**';
const HISTORY_EVENTUAL_CONSISTENCY_TIMEOUT = 150000;
const HISTORY_POLL_INTERVALS = [5000, 5000, 10000, 10000, 15000];
const TIMING_TOLERANCE_MS = 120000;
const DURATION_TOLERANCE_SECONDS = 120;

export const normalizeDisposition = (disposition?: string): string =>
  (disposition ?? '').toUpperCase();

export const normalizeDirection = (direction?: string): string => (direction ?? '').toUpperCase();

const normalizePhoneNumber = (value?: string): string => (value ?? '').replace(/\D/g, '');

export const phoneMatchesRecord = (
  record: CallHistoryRecord,
  phoneNumber: string,
  minDigits = 7
): boolean => {
  const expectedDigits = normalizePhoneNumber(phoneNumber);
  const expectedTail = expectedDigits.slice(-minDigits);

  if (!expectedTail) {
    return false;
  }

  const candidates = [
    record.other?.phoneNumber,
    record.other?.callbackAddress,
    record.other?.primaryDisplayString,
    record.other?.secondaryDisplayString,
    record.other?.name,
    record.links?.callbackAddress,
  ];

  return candidates.some((candidate) => normalizePhoneNumber(candidate).endsWith(expectedTail));
};

export const getCallHistoryDurationSeconds = (record: CallHistoryRecord): number | undefined => {
  const apiDuration = record.durationSeconds ?? record.durationSecs;

  if (typeof apiDuration === 'number') {
    return apiDuration;
  }

  const start = Date.parse(record.startTime ?? '');
  const end = Date.parse(record.endTime ?? '');

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return undefined;
  }

  return Math.max(0, Math.round((end - start) / 1000));
};

export const getCallHistoryRecords = async (
  page: Page,
  options: CallHistoryQuery = {}
): Promise<CallHistoryRecord[]> => {
  const query = {...DEFAULT_HISTORY_QUERY, ...options};

  return page.evaluate(async ({days, limit, sort, sortBy}) => {
    const callHistory = (window as any).callHistory;

    if (!callHistory) {
      throw new Error('window.callHistory is not available');
    }

    const response = await callHistory.getCallHistoryData(days, limit, sort, sortBy);

    return JSON.parse(JSON.stringify(response?.data?.userSessions ?? []));
  }, query);
};

export const waitForCallHistoryRecord = async (
  page: Page,
  matcher: (record: CallHistoryRecord) => boolean,
  description: string,
  options: CallHistoryWaitOptions = {}
): Promise<CallHistoryRecord> => {
  const {timeout = HISTORY_EVENTUAL_CONSISTENCY_TIMEOUT, ...queryOptions} = options;
  let matchingRecord: CallHistoryRecord | undefined;

  await expect
    .poll(
      async () => {
        const records = await getCallHistoryRecords(page, queryOptions);
        matchingRecord = records.find(matcher);

        return Boolean(matchingRecord);
      },
      {
        timeout,
        intervals: HISTORY_POLL_INTERVALS,
        message: `Expected call history record: ${description}`,
      }
    )
    .toBe(true);

  return matchingRecord as CallHistoryRecord;
};

const clearCallHistoryTable = async (page: Page): Promise<void> => {
  await page.evaluate(
    ({buttonSelector, headerSelector, bodySelector}) => {
      const button = document.querySelector<HTMLButtonElement>(buttonSelector);
      const header = document.querySelector<HTMLElement>(headerSelector);
      const body = document.querySelector<HTMLElement>(bodySelector);

      if (button) {
        button.disabled = false;
      }
      if (header) {
        header.innerHTML = '';
      }
      if (body) {
        body.innerHTML = '';
      }
    },
    {
      buttonSelector: CALLING_SELECTORS.CALL_HISTORY_BTN,
      headerSelector: CALLING_SELECTORS.CALL_HISTORY_HEADER,
      bodySelector: CALLING_SELECTORS.CALL_HISTORY_TABLE_BODY,
    }
  );
};

export const readCallHistoryRowsFromUi = async (page: Page): Promise<CallHistoryRow[]> => {
  const rows = await page
    .locator(`${CALLING_SELECTORS.CALL_HISTORY_TABLE_BODY} tr`)
    .evaluateAll((rowElements) =>
      rowElements.map((row) =>
        Array.from(row.querySelectorAll('td')).map((cell) => cell.textContent?.trim() ?? '')
      )
    );

  return rows.map((cells) => ({
    id: cells[0] ?? '',
    name: cells[1] ?? '',
    direction: cells[2] ?? '',
    disposition: cells[3] ?? '',
    startTime: cells[4] ?? '',
    endTime: cells[5] ?? '',
    sessionType: cells[6] ?? '',
    callbackAddress: cells[7] ?? '',
    redirectionReason: cells[8] ?? '',
    forwardedBy: cells[9] ?? '',
  }));
};

export const openCallHistoryList = async (page: Page): Promise<CallHistoryRow[]> => {
  await clearCallHistoryTable(page);
  await page.locator(CALLING_SELECTORS.CALL_HISTORY_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(`${CALLING_SELECTORS.CALL_HISTORY_HEADER} th`)).toHaveCount(10, {
    timeout: AWAIT_TIMEOUT,
  });
  await expect(page.locator(`${CALLING_SELECTORS.CALL_HISTORY_TABLE_BODY} tr`).first()).toBeVisible(
    {timeout: HISTORY_EVENTUAL_CONSISTENCY_TIMEOUT}
  );

  return readCallHistoryRowsFromUi(page);
};

export const openCallHistoryListWithRecords = async (
  page: Page,
  records: CallHistoryRecord[]
): Promise<CallHistoryRow[]> => {
  const routeHandler = async (route: Route): Promise<void> => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        statusCode: 200,
        userSessions: records,
      }),
    });
  };

  await clearCallHistoryTable(page);
  await page.route(HISTORY_URL_PATTERN, routeHandler);

  try {
    await page.locator(CALLING_SELECTORS.CALL_HISTORY_BTN).click({timeout: AWAIT_TIMEOUT});
    await expect(page.locator(`${CALLING_SELECTORS.CALL_HISTORY_HEADER} th`)).toHaveCount(10, {
      timeout: AWAIT_TIMEOUT,
    });
    await expect(page.locator(`${CALLING_SELECTORS.CALL_HISTORY_TABLE_BODY} tr`)).toHaveCount(
      records.length,
      {timeout: AWAIT_TIMEOUT}
    );

    return await readCallHistoryRowsFromUi(page);
  } finally {
    await page.unroute(HISTORY_URL_PATTERN, routeHandler).catch(() => {});
  }
};

export const expectUiShowsHistoryRecord = async (
  page: Page,
  record: CallHistoryRecord
): Promise<CallHistoryRow> => {
  const rows = await openCallHistoryListWithRecords(page, [record]);
  const matchingRow = rows.find(
    (row) =>
      row.startTime === record.startTime &&
      row.endTime === record.endTime &&
      row.direction === record.direction &&
      row.disposition === record.disposition
  );

  expect(
    matchingRow,
    `Expected Call History UI to show ${record.direction} ${record.disposition} record from ${record.startTime}`
  ).toBeTruthy();

  const row = matchingRow as CallHistoryRow;

  if (record.sessionType) {
    expect(row.sessionType).toBe(record.sessionType);
  }

  return row;
};

const rowMatchesHistoryRecord = (row: CallHistoryRow, record: CallHistoryRecord): boolean =>
  row.startTime === record.startTime &&
  row.endTime === record.endTime &&
  row.direction === record.direction &&
  row.disposition === record.disposition;

export const expectUiContainsHistoryRecords = async (
  page: Page,
  records: CallHistoryRecord[]
): Promise<CallHistoryRow[]> => {
  const rows = await openCallHistoryList(page);

  records.forEach((record) => {
    expect(
      rows.some((row) => rowMatchesHistoryRecord(row, record)),
      `Expected Call History UI to contain ${record.direction} ${record.disposition} record from ${record.startTime}`
    ).toBe(true);
  });

  return rows;
};

export const expectUiShowsHistoryRecords = async (
  page: Page,
  records: CallHistoryRecord[]
): Promise<CallHistoryRow[]> => {
  const rows = await openCallHistoryListWithRecords(page, records);

  records.forEach((record) => {
    expect(
      rows.some((row) => rowMatchesHistoryRecord(row, record)),
      `Expected Call History UI to show ${record.direction} ${record.disposition} record from ${record.startTime}`
    ).toBe(true);
  });

  return rows;
};

export const expectHistoryTiming = (
  record: CallHistoryRecord,
  bounds: HistoryTimeBounds = {}
): void => {
  const start = Date.parse(record.startTime ?? '');
  const end = Date.parse(record.endTime ?? '');

  expect(Number.isNaN(start), 'Call history startTime should be a valid ISO date').toBe(false);
  expect(Number.isNaN(end), 'Call history endTime should be a valid ISO date').toBe(false);
  expect(end, 'Call history endTime should not precede startTime').toBeGreaterThanOrEqual(start);

  if (bounds.notBefore) {
    expect(start).toBeGreaterThanOrEqual(bounds.notBefore.getTime() - TIMING_TOLERANCE_MS);
  }

  if (bounds.notAfter) {
    expect(end).toBeLessThanOrEqual(bounds.notAfter.getTime() + TIMING_TOLERANCE_MS);
  }

  const duration = getCallHistoryDurationSeconds(record);

  if (typeof duration === 'number') {
    const elapsedSeconds = Math.max(0, Math.round((end - start) / 1000));

    expect(duration).toBeGreaterThanOrEqual(0);
    expect(Math.abs(duration - elapsedSeconds)).toBeLessThanOrEqual(DURATION_TOLERANCE_SECONDS);
  }
};
