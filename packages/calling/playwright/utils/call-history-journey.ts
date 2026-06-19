import {expect} from '@playwright/test';
import type {Page, TestInfo} from '@playwright/test';
import {
  CALL_HISTORY_ANSWERED_DISPOSITIONS,
  CALL_HISTORY_MISSED_CALLER_DISPOSITIONS,
  CALL_HISTORY_REJECTED_CALLEE_DISPOSITIONS,
  CALL_HISTORY_REJECTED_CALLER_DISPOSITIONS,
  CALL_HISTORY_TIME_LOOKBACK_MS,
} from '../constants';
import {
  cleanupActiveCalls,
  endCall,
  endCallerIfStillActive,
  establishCall,
  makeCall,
  rejectCall,
  waitForCallDisconnect,
  waitForIncomingCall,
} from './call';
import {
  attachCallHistorySummary,
  expectHistoryTiming,
  expectUiShowsHistoryRecords,
  getCallHistoryRecords,
  getDisplayHistoryRecords,
  recordMatchesCallCase,
  waitForCallHistoryRecord,
} from './call-history';
import type {
  BidirectionalHistoryJourneyOptions,
  BidirectionalHistoryJourneyResult,
  CallHistoryRecord,
  CallJourneyLeg,
  HistoryDebugRecord,
  HistoryMatcherOptions,
} from './call-history-types';

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

const getIncomingDispositionsForOutcome = (outcome: CallJourneyLeg['outcome']): string[] => {
  if (outcome === 'ANSWERED') {
    return CALL_HISTORY_ANSWERED_DISPOSITIONS;
  }

  if (outcome === 'REJECTED') {
    return CALL_HISTORY_REJECTED_CALLEE_DISPOSITIONS;
  }

  return ['MISSED'];
};

const getOutgoingDispositionsForOutcome = (outcome: CallJourneyLeg['outcome']): string[] => {
  if (outcome === 'ANSWERED') {
    return CALL_HISTORY_ANSWERED_DISPOSITIONS;
  }

  if (outcome === 'REJECTED') {
    return CALL_HISTORY_REJECTED_CALLER_DISPOSITIONS;
  }

  return CALL_HISTORY_MISSED_CALLER_DISPOSITIONS;
};

const getExpectedDispositionForOutcome = (
  outcome: CallJourneyLeg['outcome'],
  callSide: 'origin' | 'target'
): HistoryDebugRecord['expectedDisposition'] => {
  if (outcome === 'ANSWERED') {
    return 'ANSWERED';
  }

  if (callSide === 'origin') {
    return 'CANCELED';
  }

  return outcome;
};

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
