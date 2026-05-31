import {expect} from '@playwright/test';
import type {Page, TestInfo} from '@playwright/test';
import {
  CALLING_SELECTORS,
  CALL_HISTORY_ANSWERED_DISPOSITIONS,
  CALL_HISTORY_COUNTERPART_MATCH_MIN_DIGITS,
  CALL_HISTORY_MISSED_CALLER_DISPOSITIONS,
  CALL_HISTORY_RECENT_RECORD_TOLERANCE_MS,
  CALL_HISTORY_REJECTED_CALLEE_DISPOSITIONS,
  CALL_HISTORY_REJECTED_CALLER_DISPOSITIONS,
  CALL_HISTORY_TIME_LOOKBACK_MS,
} from '../constants';
import {
  cleanupActiveCalls,
  endCall,
  establishCall,
  makeCall,
  rejectCall,
  waitForCallDisconnect,
  waitForIncomingCall,
} from './call';
import {
  expectHistoryTiming,
  expectUiShowsHistoryRecords,
  getCallHistoryDurationSeconds,
  getCallHistoryRecords,
  normalizeDirection,
  normalizeDisposition,
  phoneMatchesRecord,
  waitForCallHistoryRecord,
} from './call-history';
import type {
  BidirectionalHistoryJourneyOptions,
  BidirectionalHistoryJourneyResult,
  CallHistoryRecord,
  CallHistoryDisposition,
  CallJourneyLeg,
  CallJourneyOutcome,
  HistoryDebugRecord,
  HistoryMatcherOptions,
  UserLabel,
} from './call-history-types';

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

const isRecentRecord = (record: CallHistoryRecord, startedAt: Date): boolean => {
  const startTime = Date.parse(record.startTime ?? '');

  return (
    !Number.isNaN(startTime) &&
    startTime >= startedAt.getTime() - CALL_HISTORY_RECENT_RECORD_TOLERANCE_MS
  );
};

export const recordMatchesCallCase = (
  record: CallHistoryRecord,
  options: HistoryMatcherOptions
): boolean => {
  const disposition = normalizeDisposition(record.disposition);

  return (
    phoneMatchesRecord(
      record,
      options.counterpartNumber,
      CALL_HISTORY_COUNTERPART_MATCH_MIN_DIGITS
    ) &&
    normalizeDirection(record.direction) === options.direction &&
    isRecentRecord(record, options.startedAt) &&
    (!options.dispositions || options.dispositions.includes(disposition))
  );
};

export const waitForCallHistoryCase = async (
  page: Page,
  options: HistoryMatcherOptions,
  description: string
): Promise<CallHistoryRecord> =>
  waitForCallHistoryRecord(page, (record) => recordMatchesCallCase(record, options), description);

export const expectDisposition = (record: CallHistoryRecord, expected: string[]): void => {
  expect(expected).toContain(normalizeDisposition(record.disposition));
};

const getHistoryRecordKey = (record: CallHistoryRecord): string =>
  record.sessionId ??
  [
    record.direction,
    record.disposition,
    record.startTime,
    record.endTime,
    record.sessionType,
    record.other?.phoneNumber,
    record.other?.callbackAddress,
    record.links?.callbackAddress,
    record.other?.name,
  ].join('|');

const rememberCurrentHistoryRecords = async (page: Page, seenKeys: Set<string>): Promise<void> => {
  const records = await getCallHistoryRecords(page).catch(() => []);

  records.forEach((record) => seenKeys.add(getHistoryRecordKey(record)));
};

export const endCallerIfStillActive = async (page: Page): Promise<void> => {
  const endButton = page.locator(CALLING_SELECTORS.END_CALL_BTN);
  const canEndCall = await endButton.isEnabled().catch(() => false);

  if (canEndCall) {
    await endCall(page);
  }
};

const waitForNewHistoryRecord = async (
  page: Page,
  seenHistoryKeys: Set<string>,
  matcherOptions: HistoryMatcherOptions,
  description: string
): Promise<CallHistoryRecord> => {
  const record = await waitForCallHistoryRecord(
    page,
    (candidate) =>
      !seenHistoryKeys.has(getHistoryRecordKey(candidate)) &&
      recordMatchesCallCase(candidate, matcherOptions),
    description
  );

  seenHistoryKeys.add(getHistoryRecordKey(record));

  return record;
};

const getIncomingDispositionsForOutcome = (outcome: CallJourneyOutcome): string[] => {
  if (outcome === 'ANSWERED') {
    return CALL_HISTORY_ANSWERED_DISPOSITIONS;
  }

  if (outcome === 'REJECTED') {
    return CALL_HISTORY_REJECTED_CALLEE_DISPOSITIONS;
  }

  return ['MISSED'];
};

const getOutgoingDispositionsForOutcome = (outcome: CallJourneyOutcome): string[] => {
  if (outcome === 'ANSWERED') {
    return CALL_HISTORY_ANSWERED_DISPOSITIONS;
  }

  if (outcome === 'REJECTED') {
    return CALL_HISTORY_REJECTED_CALLER_DISPOSITIONS;
  }

  return CALL_HISTORY_MISSED_CALLER_DISPOSITIONS;
};

const getExpectedDispositionForOutcome = (
  outcome: CallJourneyOutcome,
  callSide: 'origin' | 'target'
): CallHistoryDisposition => {
  if (outcome === 'ANSWERED') {
    return 'ANSWERED';
  }

  if (callSide === 'origin') {
    return 'CANCELED';
  }

  return outcome;
};

export const getDisplayHistoryRecords = (
  records: HistoryDebugRecord[],
  user: UserLabel
): CallHistoryRecord[] =>
  records.filter((debugRecord) => debugRecord.user === user).map(({record}) => record);

const executeCallJourneyLeg = async (
  leg: CallJourneyLeg,
  testInfo: TestInfo
): Promise<HistoryDebugRecord[]> => {
  await Promise.all([
    rememberCurrentHistoryRecords(leg.originPage, leg.originSeenHistoryKeys),
    rememberCurrentHistoryRecords(leg.targetPage, leg.targetSeenHistoryKeys),
  ]);

  const startedAt = new Date(Date.now() - CALL_HISTORY_TIME_LOOKBACK_MS);

  if (leg.outcome === 'ANSWERED') {
    await establishCall(leg.originPage, leg.targetPage, leg.targetNumber);
    await leg.originPage.waitForTimeout(2000);
    await endCall(leg.originPage);
  } else {
    await makeCall(leg.originPage, leg.targetNumber);
    await leg.targetPage.bringToFront().catch(() => {});
    await waitForIncomingCall(leg.targetPage);

    if (leg.outcome === 'REJECTED') {
      await rejectCall(leg.targetPage);
      await endCallerIfStillActive(leg.originPage);
    } else {
      await leg.originPage.waitForTimeout(5000);
      await endCall(leg.originPage);
    }
  }

  await Promise.all([waitForCallDisconnect(leg.originPage), waitForCallDisconnect(leg.targetPage)]);
  const endedAt = new Date();

  const originRecord = await waitForNewHistoryRecord(
    leg.originPage,
    leg.originSeenHistoryKeys,
    {
      counterpartNumber: leg.targetNumber,
      direction: 'OUTGOING',
      startedAt,
      dispositions: getOutgoingDispositionsForOutcome(leg.outcome),
    },
    `${leg.label} ${leg.originLabel} outgoing ${leg.outcome.toLowerCase()} call`
  );
  const targetRecord = await waitForNewHistoryRecord(
    leg.targetPage,
    leg.targetSeenHistoryKeys,
    {
      counterpartNumber: leg.originNumber,
      direction: 'INCOMING',
      startedAt,
      dispositions: getIncomingDispositionsForOutcome(leg.outcome),
    },
    `${leg.label} ${leg.targetLabel} incoming ${leg.outcome.toLowerCase()} call`
  );

  if (leg.outcome === 'MISSED') {
    expectDisposition(targetRecord, ['MISSED']);
  }

  expectHistoryTiming(originRecord, {notBefore: startedAt, notAfter: endedAt});
  expectHistoryTiming(targetRecord, {notBefore: startedAt, notAfter: endedAt});

  const records: HistoryDebugRecord[] = [
    {
      user: leg.originLabel,
      expectedDisposition: getExpectedDispositionForOutcome(leg.outcome, 'origin'),
      record: originRecord,
    },
    {
      user: leg.targetLabel,
      expectedDisposition: getExpectedDispositionForOutcome(leg.outcome, 'target'),
      record: targetRecord,
    },
  ];

  await attachCallHistorySummary(testInfo, leg.label, records);

  return records;
};

export const runBidirectionalHistoryJourney = async (
  options: BidirectionalHistoryJourneyOptions,
  testInfo: TestInfo
): Promise<BidirectionalHistoryJourneyResult> => {
  const user1SeenHistoryKeys = new Set<string>();
  const user2SeenHistoryKeys = new Set<string>();
  const user1JourneyRecords: CallHistoryRecord[] = [];
  const user2JourneyRecords: CallHistoryRecord[] = [];
  const journeyDebugRecords: HistoryDebugRecord[] = [];

  const addJourneyRecords = (records: HistoryDebugRecord[]) => {
    records.forEach(({user, record}) => {
      if (user === 'user1') {
        user1JourneyRecords.push(record);
      }

      if (user === 'user2') {
        user2JourneyRecords.push(record);
      }
    });
  };

  const callJourneyLegs: CallJourneyLeg[] = [
    {
      label: 'user1-to-user2-answered',
      originLabel: 'user1',
      originPage: options.user1Page,
      originNumber: options.user1Number,
      targetLabel: 'user2',
      targetPage: options.user2Page,
      targetNumber: options.user2Number,
      outcome: 'ANSWERED',
      originSeenHistoryKeys: user1SeenHistoryKeys,
      targetSeenHistoryKeys: user2SeenHistoryKeys,
    },
    {
      label: 'user1-to-user2-rejected',
      originLabel: 'user1',
      originPage: options.user1Page,
      originNumber: options.user1Number,
      targetLabel: 'user2',
      targetPage: options.user2Page,
      targetNumber: options.user2Number,
      outcome: 'REJECTED',
      originSeenHistoryKeys: user1SeenHistoryKeys,
      targetSeenHistoryKeys: user2SeenHistoryKeys,
    },
    {
      label: 'user1-to-user2-missed',
      originLabel: 'user1',
      originPage: options.user1Page,
      originNumber: options.user1Number,
      targetLabel: 'user2',
      targetPage: options.user2Page,
      targetNumber: options.user2Number,
      outcome: 'MISSED',
      originSeenHistoryKeys: user1SeenHistoryKeys,
      targetSeenHistoryKeys: user2SeenHistoryKeys,
    },
    {
      label: 'user2-to-user1-answered',
      originLabel: 'user2',
      originPage: options.user2Page,
      originNumber: options.user2Number,
      targetLabel: 'user1',
      targetPage: options.user1Page,
      targetNumber: options.user1Number,
      outcome: 'ANSWERED',
      originSeenHistoryKeys: user2SeenHistoryKeys,
      targetSeenHistoryKeys: user1SeenHistoryKeys,
    },
    {
      label: 'user2-to-user1-rejected',
      originLabel: 'user2',
      originPage: options.user2Page,
      originNumber: options.user2Number,
      targetLabel: 'user1',
      targetPage: options.user1Page,
      targetNumber: options.user1Number,
      outcome: 'REJECTED',
      originSeenHistoryKeys: user2SeenHistoryKeys,
      targetSeenHistoryKeys: user1SeenHistoryKeys,
    },
    {
      label: 'user2-to-user1-missed',
      originLabel: 'user2',
      originPage: options.user2Page,
      originNumber: options.user2Number,
      targetLabel: 'user1',
      targetPage: options.user1Page,
      targetNumber: options.user1Number,
      outcome: 'MISSED',
      originSeenHistoryKeys: user2SeenHistoryKeys,
      targetSeenHistoryKeys: user1SeenHistoryKeys,
    },
  ];

  /* eslint-disable no-await-in-loop */
  for (const leg of callJourneyLegs) {
    const records = await executeCallJourneyLeg(leg, testInfo);
    addJourneyRecords(records);
    journeyDebugRecords.push(...records);
    await Promise.all([
      expectUiShowsHistoryRecords(
        options.user1Page,
        getDisplayHistoryRecords(journeyDebugRecords, 'user1')
      ),
      expectUiShowsHistoryRecords(
        options.user2Page,
        getDisplayHistoryRecords(journeyDebugRecords, 'user2')
      ),
    ]);
    await Promise.all([
      cleanupActiveCalls(options.user1Page),
      cleanupActiveCalls(options.user2Page),
    ]);
    await options.user1Page.waitForTimeout(2000);
  }
  /* eslint-enable no-await-in-loop */

  expect(user1JourneyRecords).toHaveLength(callJourneyLegs.length);
  expect(user2JourneyRecords).toHaveLength(callJourneyLegs.length);

  await attachCallHistorySummary(testInfo, 'two-user-call-history-journey', journeyDebugRecords);

  return {
    user1Records: user1JourneyRecords,
    user2Records: user2JourneyRecords,
    debugRecords: journeyDebugRecords,
  };
};
