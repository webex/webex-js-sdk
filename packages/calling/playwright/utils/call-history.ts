import {expect} from '@playwright/test';
import type {Page, Route, TestInfo} from '@playwright/test';
import {
  AWAIT_TIMEOUT,
  CALLING_SELECTORS,
  CALL_HISTORY_COUNTERPART_MATCH_MIN_DIGITS,
  CALL_HISTORY_DURATION_TOLERANCE_SECONDS,
  CALL_HISTORY_EVENTUAL_CONSISTENCY_TIMEOUT,
  CALL_HISTORY_POLL_INTERVALS,
  CALL_HISTORY_RECENT_RECORD_TOLERANCE_MS,
  CALL_HISTORY_TIMING_TOLERANCE_MS,
  CALL_HISTORY_URL_PATTERN,
} from '../constants';
import type {
  CallHistoryQuery,
  CallHistoryRecord,
  CallHistoryRow,
  CallHistoryWaitOptions,
  HistoryDebugRecord,
  HistoryMatcherOptions,
  HistoryTimeBounds,
} from './call-history-types';

export type {CallHistoryRecord, CallHistoryRow} from './call-history-types';

const DEFAULT_HISTORY_QUERY: Required<CallHistoryQuery> = {
  days: 1,
  limit: 20,
  sort: 'DESC',
  sortBy: 'endTime',
};

const normalizePhoneNumber = (value?: string): string => (value ?? '').replace(/\D/g, '');

/**
 * Compares a record's available counterpart fields with the expected phone number.
 */
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

/**
 * Reads the duration from the API record, or derives it from start and end timestamps.
 */
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

const isRecentRecord = (record: CallHistoryRecord, startedAt: Date): boolean => {
  const startTime = Date.parse(record.startTime ?? '');

  return (
    !Number.isNaN(startTime) &&
    startTime >= startedAt.getTime() - CALL_HISTORY_RECENT_RECORD_TOLERANCE_MS
  );
};

/**
 * Checks whether a history record belongs to a specific call attempt.
 */
export const recordMatchesCallCase = (
  record: CallHistoryRecord,
  options: HistoryMatcherOptions
): boolean => {
  const disposition = (record.disposition ?? '').toUpperCase();

  return (
    phoneMatchesRecord(
      record,
      options.counterpartNumber,
      CALL_HISTORY_COUNTERPART_MATCH_MIN_DIGITS
    ) &&
    (record.direction ?? '').toUpperCase() === options.direction &&
    isRecentRecord(record, options.startedAt) &&
    (!options.dispositions || options.dispositions.includes(disposition))
  );
};

/**
 * Fetches call-history records from the sample app's initialized Calling SDK instance.
 */
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

/**
 * Polls the SDK until the expected call-history record is eventually available.
 */
export const waitForCallHistoryRecord = async (
  page: Page,
  matcher: (record: CallHistoryRecord) => boolean,
  description: string,
  options: CallHistoryWaitOptions = {}
): Promise<CallHistoryRecord> => {
  const {timeout = CALL_HISTORY_EVENTUAL_CONSISTENCY_TIMEOUT, ...queryOptions} = options;
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
        intervals: CALL_HISTORY_POLL_INTERVALS,
        message: `Expected call history record: ${description}`,
      }
    )
    .toBe(true);

  return matchingRecord as CallHistoryRecord;
};

/**
 * Waits for a call-history record matching one user side of a call.
 */
export const waitForCallHistoryCase = async (
  page: Page,
  options: HistoryMatcherOptions,
  description: string
): Promise<CallHistoryRecord> =>
  waitForCallHistoryRecord(page, (record) => recordMatchesCallCase(record, options), description);

/**
 * Attaches compact call-history details to the Playwright report.
 */
export const attachCallHistorySummary = async (
  testInfo: TestInfo,
  label: string,
  records: HistoryDebugRecord[]
): Promise<void> => {
  const summary = records.map(({user, expectedDisposition, record}) => ({
    user,
    expectedDisposition,
    direction: record.direction,
    rawDisposition: record.disposition,
    displayDisposition: expectedDisposition,
    startTime: record.startTime,
    endTime: record.endTime,
    durationSeconds: getCallHistoryDurationSeconds(record),
    sessionType: record.sessionType,
    counterpart:
      record.other?.phoneNumber ??
      record.other?.callbackAddress ??
      record.links?.callbackAddress ??
      record.other?.name,
  }));
  const oneLineSummary = summary
    .map(
      (record) =>
        `${record.user}:${record.expectedDisposition}:${record.direction}/${record.rawDisposition}:${record.durationSeconds}s`
    )
    .join('; ');

  testInfo.annotations.push({type: 'call-history', description: `${label}: ${oneLineSummary}`});
  await testInfo.attach(`${label}-call-history-summary.json`, {
    body: JSON.stringify(summary, null, 2),
    contentType: 'application/json',
  });
};

/**
 * Returns records for one logical user from journey debug records.
 */
export const getDisplayHistoryRecords = (
  records: HistoryDebugRecord[],
  user: string
): CallHistoryRecord[] =>
  records.filter((debugRecord) => debugRecord.user === user).map(({record}) => record);

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

const readCallHistoryRowsFromUi = async (page: Page): Promise<CallHistoryRow[]> => {
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
    {timeout: CALL_HISTORY_EVENTUAL_CONSISTENCY_TIMEOUT}
  );

  return readCallHistoryRowsFromUi(page);
};

const openCallHistoryListWithRecords = async (
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
  await page.route(CALL_HISTORY_URL_PATTERN, routeHandler);

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
    await page.unroute(CALL_HISTORY_URL_PATTERN, routeHandler).catch(() => {});
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
    expect(start).toBeGreaterThanOrEqual(
      bounds.notBefore.getTime() - CALL_HISTORY_TIMING_TOLERANCE_MS
    );
  }

  if (bounds.notAfter) {
    expect(end).toBeLessThanOrEqual(bounds.notAfter.getTime() + CALL_HISTORY_TIMING_TOLERANCE_MS);
  }

  const duration = getCallHistoryDurationSeconds(record);

  if (typeof duration === 'number') {
    const elapsedSeconds = Math.max(0, Math.round((end - start) / 1000));

    expect(duration).toBeGreaterThanOrEqual(0);
    expect(Math.abs(duration - elapsedSeconds)).toBeLessThanOrEqual(
      CALL_HISTORY_DURATION_TOLERANCE_SECONDS
    );
  }
};
