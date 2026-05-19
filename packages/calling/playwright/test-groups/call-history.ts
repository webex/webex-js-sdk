import {test, expect} from '@playwright/test';
import type {Page, TestInfo} from '@playwright/test';
import {TestManager} from '../test-manager';
import {getPhoneNumber} from '../test-data';
import {
  cleanupActiveCalls,
  endCall,
  establishCall,
  getCallDebugSnapshot,
  makeCall,
  rejectCall,
  waitForCallDisconnect,
  waitForIncomingCall,
} from '../utils/call';
import {
  CallHistoryRecord,
  getCallHistoryDurationSeconds,
  getCallHistoryRecords,
  expectHistoryTiming,
  expectUiShowsHistoryRecord,
  expectUiShowsHistoryRecords,
  normalizeDirection,
  normalizeDisposition,
  openCallHistoryList,
  phoneMatchesRecord,
  waitForCallHistoryRecord,
} from '../utils/call-history';
import {CALLING_SELECTORS} from '../constants';

const CALL_HISTORY_AI_SPECS = [
  {
    id: 'CH-LIST-001',
    title: 'Bidirectional call journey renders through the sample UI Call History list',
    preconditions: [
      'Two Webex Calling users are initialized, registered, and media-ready in browser contexts.',
      'Both users use the access tokens loaded from the project-specific environment variables.',
    ],
    steps: [
      'Open the calling kitchen sink sample app for User 1 and User 2.',
      'Initialize Calling, register the line, and grant media access for both users.',
      'Run three User 1 to User 2 outgoing call attempts: missed, rejected, and answered.',
      'Run three User 2 to User 1 outgoing call attempts: missed, rejected, and answered.',
      'Open the sample app Call History list for both users.',
    ],
    expected: [
      'User 1 history contains the three recent outgoing User 1 to User 2 records.',
      'User 2 history contains the three recent outgoing User 2 to User 1 records.',
      'The table header renders the Call History columns and all expected rows are visible.',
    ],
  },
  {
    id: 'CH-CALL-001',
    title: 'Answered call creates exact per-user history records',
    preconditions: ['Caller and callee are registered and can place/answer calls.'],
    steps: [
      'Caller dials callee.',
      'Callee answers and the call reaches established state on both pages.',
      'Caller ends the call.',
      'Poll Call History for caller and callee.',
      'Render each returned record through the Call History UI table.',
    ],
    expected: [
      'Caller history contains a recent OUTGOING record for the callee.',
      'Callee history contains a recent INCOMING record for the caller.',
      'Each UI row shows the exact Janus direction, disposition, start time, end time, and session type.',
      'Call timing is valid: start/end are ISO dates, end is not before start, and duration is plausible.',
    ],
  },
  {
    id: 'CH-CALL-002',
    title: 'Missed call creates exact callee MISSED history',
    preconditions: ['Caller and callee are registered; callee does not answer the incoming call.'],
    steps: [
      'Caller dials callee.',
      'Callee rings and intentionally does not answer.',
      'Caller ends the ringing call.',
      'Poll Call History for caller and callee.',
      'Render the returned records through the Call History UI table.',
    ],
    expected: [
      'Callee history contains a recent INCOMING MISSED record for the caller.',
      'Caller history contains a recent OUTGOING unanswered record for the callee.',
      'The UI reflects the exact backend status and call timing for each user.',
    ],
  },
  {
    id: 'CH-CALL-003',
    title: 'Rejected call creates exact per-user history records',
    preconditions: ['Caller and callee are registered; callee can reject the incoming call.'],
    steps: [
      'Caller dials callee.',
      'Callee rejects the ringing call from the UI.',
      'Wait until both users have no active calls.',
      'Poll Call History for caller and callee.',
      'Render the returned records through the Call History UI table.',
    ],
    expected: [
      'Caller and callee both receive recent history rows for the rejected call.',
      'The UI renders the exact Janus direction, disposition, start time, end time, and session type.',
    ],
  },
  {
    id: 'CH-ALL-001',
    title: 'User 1 login shows missed, rejected, and answered outgoing call history',
    preconditions: ['Both users stay initialized, registered, and media-ready in one browser run.'],
    steps: [
      'User 1 calls User 2 and User 2 does not answer.',
      'User 1 calls User 2 again and User 2 rejects.',
      'User 1 calls User 2 again and User 2 answers.',
      'After both users complete their outgoing call journeys, open Call History for User 1.',
    ],
    expected: [
      'User 1 shows three recent OUTGOING records in one login.',
      'The missed, rejected, and answered attempts show the backend dispositions returned by Call History.',
      'Every record has valid start and end timestamps.',
      'The answered call includes valid non-negative duration derived from the timestamps.',
      'The sample app Call History table renders all three outgoing records for User 1.',
    ],
  },
  {
    id: 'CH-ALL-002',
    title: 'User 2 login shows missed, rejected, and answered outgoing call history',
    preconditions: ['Both users stay initialized, registered, and media-ready in one browser run.'],
    steps: [
      'User 2 calls User 1 and User 1 does not answer.',
      'User 2 calls User 1 again and User 1 rejects.',
      'User 2 calls User 1 again and User 1 answers.',
      'After both users complete their outgoing call journeys, open Call History for User 2.',
    ],
    expected: [
      'User 2 shows three recent OUTGOING records in one login.',
      'The missed, rejected, and answered attempts show the backend dispositions returned by Call History.',
      'Every record has valid start and end timestamps.',
      'The answered call includes valid non-negative duration derived from the timestamps.',
      'The sample app Call History table renders all three outgoing records for User 2.',
    ],
  },
] as const;

const ANSWERED_DISPOSITIONS = ['ANSWERED', 'INITIATED'];
const UNANSWERED_CALLER_DISPOSITIONS = ['CANCELED', 'INITIATED'];
const REJECTED_CALLEE_DISPOSITIONS = ['MISSED', 'CANCELED'];
const HISTORY_TIME_LOOKBACK_MS = 5000;
const RECENT_RECORD_TOLERANCE_MS = 120000;
const COUNTERPART_MATCH_MIN_DIGITS = 4;

type HistoryMatcherOptions = {
  counterpartNumber: string;
  direction: 'INCOMING' | 'OUTGOING';
  startedAt: Date;
  dispositions?: string[];
};

type HistoryDebugRecord = {
  user: 'user1' | 'user2';
  expectedResult: 'PICKED' | 'NOT_PICKED' | 'REJECTED';
  record: CallHistoryRecord;
};

type UserLabel = HistoryDebugRecord['user'];

type CallJourneyLeg = {
  label: string;
  originLabel: UserLabel;
  originPage: Page;
  originNumber: string;
  targetLabel: UserLabel;
  targetPage: Page;
  targetNumber: string;
  outcome: HistoryDebugRecord['expectedResult'];
  originSeenHistoryKeys: Set<string>;
  targetSeenHistoryKeys: Set<string>;
};

type OutgoingHistoryJourneyOptions = {
  labelPrefix: string;
  originLabel: UserLabel;
  originPage: Page;
  originNumber: string;
  targetLabel: UserLabel;
  targetPage: Page;
  targetNumber: string;
};

type OutgoingHistoryJourneyResult = {
  originRecords: CallHistoryRecord[];
  debugRecords: HistoryDebugRecord[];
};

const testTitle = (specIndex: number): string =>
  `${CALL_HISTORY_AI_SPECS[specIndex].id}: ${CALL_HISTORY_AI_SPECS[specIndex].title}`;

const attachCallUiStatus = async (
  testInfo: TestInfo,
  label: string,
  callerPage: Page,
  calleePage: Page
): Promise<void> => {
  const [caller, callee] = await Promise.all([
    getCallDebugSnapshot(callerPage),
    getCallDebugSnapshot(calleePage),
  ]);

  await testInfo.attach(`${label}-call-ui-status.json`, {
    body: JSON.stringify({caller, callee}, null, 2),
    contentType: 'application/json',
  });
};

const attachCallHistorySummary = async (
  testInfo: TestInfo,
  label: string,
  records: HistoryDebugRecord[]
): Promise<void> => {
  const summary = records.map(({user, expectedResult, record}) => ({
    user,
    expectedResult,
    direction: record.direction,
    disposition: record.disposition,
    status: normalizeDisposition(record.disposition),
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
        `${record.user}:${record.expectedResult}:${record.direction}/${record.disposition}:${record.durationSeconds}s`
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

  return !Number.isNaN(startTime) && startTime >= startedAt.getTime() - RECENT_RECORD_TOLERANCE_MS;
};

const recordMatchesCallCase = (
  record: CallHistoryRecord,
  options: HistoryMatcherOptions
): boolean => {
  const disposition = normalizeDisposition(record.disposition);

  return (
    phoneMatchesRecord(record, options.counterpartNumber, COUNTERPART_MATCH_MIN_DIGITS) &&
    normalizeDirection(record.direction) === options.direction &&
    isRecentRecord(record, options.startedAt) &&
    (!options.dispositions || options.dispositions.includes(disposition))
  );
};

const expectDisposition = (record: CallHistoryRecord, expected: string[]): void => {
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

const endCallerIfStillActive = async (page: Page): Promise<void> => {
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

const getIncomingDispositionsForOutcome = (
  outcome: HistoryDebugRecord['expectedResult']
): string[] => {
  if (outcome === 'PICKED') {
    return ANSWERED_DISPOSITIONS;
  }

  if (outcome === 'REJECTED') {
    return REJECTED_CALLEE_DISPOSITIONS;
  }

  return ['MISSED'];
};

const executeCallJourneyLeg = async (
  leg: CallJourneyLeg,
  testInfo: TestInfo
): Promise<HistoryDebugRecord[]> => {
  await Promise.all([
    rememberCurrentHistoryRecords(leg.originPage, leg.originSeenHistoryKeys),
    rememberCurrentHistoryRecords(leg.targetPage, leg.targetSeenHistoryKeys),
  ]);

  const startedAt = new Date(Date.now() - HISTORY_TIME_LOOKBACK_MS);

  if (leg.outcome === 'PICKED') {
    await establishCall(leg.originPage, leg.targetPage, leg.targetNumber);
    await attachCallUiStatus(testInfo, `${leg.label}-established`, leg.originPage, leg.targetPage);
    await leg.originPage.waitForTimeout(2000);
    await endCall(leg.originPage);
  } else {
    await makeCall(leg.originPage, leg.targetNumber);
    await leg.targetPage.bringToFront().catch(() => {});
    await waitForIncomingCall(leg.targetPage);
    await attachCallUiStatus(testInfo, `${leg.label}-ringing`, leg.originPage, leg.targetPage);

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
  await attachCallUiStatus(testInfo, `${leg.label}-disconnected`, leg.originPage, leg.targetPage);

  const originRecord = await waitForNewHistoryRecord(
    leg.originPage,
    leg.originSeenHistoryKeys,
    {
      counterpartNumber: leg.targetNumber,
      direction: 'OUTGOING',
      startedAt,
      dispositions:
        leg.outcome === 'PICKED' ? ANSWERED_DISPOSITIONS : UNANSWERED_CALLER_DISPOSITIONS,
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

  if (leg.outcome === 'NOT_PICKED') {
    expectDisposition(targetRecord, ['MISSED']);
  }

  expectHistoryTiming(originRecord, {notBefore: startedAt, notAfter: endedAt});
  expectHistoryTiming(targetRecord, {notBefore: startedAt, notAfter: endedAt});

  const records: HistoryDebugRecord[] = [
    {user: leg.originLabel, expectedResult: leg.outcome, record: originRecord},
    {user: leg.targetLabel, expectedResult: leg.outcome, record: targetRecord},
  ];

  await attachCallHistorySummary(testInfo, leg.label, records);

  return records;
};

const runOutgoingHistoryJourney = async (
  options: OutgoingHistoryJourneyOptions,
  testInfo: TestInfo
): Promise<OutgoingHistoryJourneyResult> => {
  const originSeenHistoryKeys = new Set<string>();
  const targetSeenHistoryKeys = new Set<string>();
  const originJourneyRecords: CallHistoryRecord[] = [];
  const journeyDebugRecords: HistoryDebugRecord[] = [];

  const addOriginJourneyRecords = (records: HistoryDebugRecord[]) => {
    records.forEach(({user, record}) => {
      if (user === options.originLabel) {
        originJourneyRecords.push(record);
      }
    });
  };

  const callJourneyLegs: CallJourneyLeg[] = [
    {
      label: `${options.labelPrefix}-not-picked`,
      originLabel: options.originLabel,
      originPage: options.originPage,
      originNumber: options.originNumber,
      targetLabel: options.targetLabel,
      targetPage: options.targetPage,
      targetNumber: options.targetNumber,
      outcome: 'NOT_PICKED',
      originSeenHistoryKeys,
      targetSeenHistoryKeys,
    },
    {
      label: `${options.labelPrefix}-rejected`,
      originLabel: options.originLabel,
      originPage: options.originPage,
      originNumber: options.originNumber,
      targetLabel: options.targetLabel,
      targetPage: options.targetPage,
      targetNumber: options.targetNumber,
      outcome: 'REJECTED',
      originSeenHistoryKeys,
      targetSeenHistoryKeys,
    },
    {
      label: `${options.labelPrefix}-picked`,
      originLabel: options.originLabel,
      originPage: options.originPage,
      originNumber: options.originNumber,
      targetLabel: options.targetLabel,
      targetPage: options.targetPage,
      targetNumber: options.targetNumber,
      outcome: 'PICKED',
      originSeenHistoryKeys,
      targetSeenHistoryKeys,
    },
  ];

  /* eslint-disable no-await-in-loop */
  for (const leg of callJourneyLegs) {
    const records = await executeCallJourneyLeg(leg, testInfo);
    addOriginJourneyRecords(records);
    journeyDebugRecords.push(...records);
    await Promise.all([
      cleanupActiveCalls(options.originPage),
      cleanupActiveCalls(options.targetPage),
    ]);
    await options.originPage.waitForTimeout(2000);
  }
  /* eslint-enable no-await-in-loop */

  expect(originJourneyRecords).toHaveLength(callJourneyLegs.length);
  originJourneyRecords.forEach((record) =>
    expect(normalizeDirection(record.direction)).toBe('OUTGOING')
  );

  await attachCallHistorySummary(
    testInfo,
    `${options.labelPrefix}-outgoing-journey`,
    journeyDebugRecords
  );

  return {
    originRecords: originJourneyRecords,
    debugRecords: journeyDebugRecords,
  };
};

export function callHistoryTests() {
  test.describe('Call History', () => {
    test.describe.configure({mode: 'serial', timeout: 300000});

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
      callerNumber = getPhoneNumber(tm.userSet.accounts[0]);
      calleeNumber = getPhoneNumber(tm.userSet.accounts[1]);
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
    test(testTitle(1), async ({}, testInfo) => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);
      const startedAt = new Date(Date.now() - HISTORY_TIME_LOOKBACK_MS);

      await establishCall(callerPage, calleePage, calleeNumber);
      await attachCallUiStatus(testInfo, 'answered-established', callerPage, calleePage);
      await callerPage.waitForTimeout(2000);
      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
      const endedAt = new Date();
      await attachCallUiStatus(testInfo, 'answered-disconnected', callerPage, calleePage);

      const callerRecord = await waitForCallHistoryRecord(
        callerPage,
        (record) =>
          recordMatchesCallCase(record, {
            counterpartNumber: calleeNumber,
            direction: 'OUTGOING',
            startedAt,
            dispositions: ANSWERED_DISPOSITIONS,
          }),
        'caller outgoing answered call'
      );
      const calleeRecord = await waitForCallHistoryRecord(
        calleePage,
        (record) =>
          recordMatchesCallCase(record, {
            counterpartNumber: callerNumber,
            direction: 'INCOMING',
            startedAt,
            dispositions: ANSWERED_DISPOSITIONS,
          }),
        'callee incoming answered call'
      );

      expectHistoryTiming(callerRecord, {notBefore: startedAt, notAfter: endedAt});
      expectHistoryTiming(calleeRecord, {notBefore: startedAt, notAfter: endedAt});
      await attachCallHistorySummary(testInfo, 'answered-picked', [
        {user: 'user1', expectedResult: 'PICKED', record: callerRecord},
        {user: 'user2', expectedResult: 'PICKED', record: calleeRecord},
      ]);

      const callerRows = await openCallHistoryList(callerPage);
      expect(callerRows.length).toBeGreaterThan(0);

      await expectUiShowsHistoryRecord(callerPage, callerRecord);
      await expectUiShowsHistoryRecord(calleePage, calleeRecord);
    });

    test(testTitle(2), async ({}, testInfo) => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);
      const startedAt = new Date(Date.now() - HISTORY_TIME_LOOKBACK_MS);

      await makeCall(callerPage, calleeNumber);
      await waitForIncomingCall(calleePage);
      await attachCallUiStatus(testInfo, 'missed-ringing', callerPage, calleePage);
      await callerPage.waitForTimeout(5000);
      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
      const endedAt = new Date();
      await attachCallUiStatus(testInfo, 'missed-disconnected', callerPage, calleePage);

      const calleeMissedRecord = await waitForCallHistoryRecord(
        calleePage,
        (record) =>
          recordMatchesCallCase(record, {
            counterpartNumber: callerNumber,
            direction: 'INCOMING',
            startedAt,
            dispositions: ['MISSED'],
          }),
        'callee incoming missed call'
      );
      const callerCanceledRecord = await waitForCallHistoryRecord(
        callerPage,
        (record) =>
          recordMatchesCallCase(record, {
            counterpartNumber: calleeNumber,
            direction: 'OUTGOING',
            startedAt,
            dispositions: UNANSWERED_CALLER_DISPOSITIONS,
          }),
        'caller outgoing unanswered call'
      );

      expectDisposition(calleeMissedRecord, ['MISSED']);
      expectHistoryTiming(calleeMissedRecord, {notBefore: startedAt, notAfter: endedAt});
      expectHistoryTiming(callerCanceledRecord, {notBefore: startedAt, notAfter: endedAt});
      await attachCallHistorySummary(testInfo, 'missed-not-picked', [
        {user: 'user1', expectedResult: 'NOT_PICKED', record: callerCanceledRecord},
        {user: 'user2', expectedResult: 'NOT_PICKED', record: calleeMissedRecord},
      ]);

      await expectUiShowsHistoryRecord(calleePage, calleeMissedRecord);
      await expectUiShowsHistoryRecord(callerPage, callerCanceledRecord);
    });

    test(testTitle(3), async ({}, testInfo) => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);
      const startedAt = new Date(Date.now() - HISTORY_TIME_LOOKBACK_MS);

      await makeCall(callerPage, calleeNumber);
      await waitForIncomingCall(calleePage);
      await attachCallUiStatus(testInfo, 'rejected-ringing', callerPage, calleePage);
      await rejectCall(calleePage);
      await endCallerIfStillActive(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
      const endedAt = new Date();
      await attachCallUiStatus(testInfo, 'rejected-disconnected', callerPage, calleePage);

      const callerRecord = await waitForCallHistoryRecord(
        callerPage,
        (record) =>
          recordMatchesCallCase(record, {
            counterpartNumber: calleeNumber,
            direction: 'OUTGOING',
            startedAt,
            dispositions: UNANSWERED_CALLER_DISPOSITIONS,
          }),
        'caller outgoing rejected call'
      );
      const calleeRecord = await waitForCallHistoryRecord(
        calleePage,
        (record) =>
          recordMatchesCallCase(record, {
            counterpartNumber: callerNumber,
            direction: 'INCOMING',
            startedAt,
            dispositions: REJECTED_CALLEE_DISPOSITIONS,
          }),
        'callee incoming rejected call'
      );

      expectHistoryTiming(callerRecord, {notBefore: startedAt, notAfter: endedAt});
      expectHistoryTiming(calleeRecord, {notBefore: startedAt, notAfter: endedAt});
      await attachCallHistorySummary(testInfo, 'rejected', [
        {user: 'user1', expectedResult: 'REJECTED', record: callerRecord},
        {user: 'user2', expectedResult: 'REJECTED', record: calleeRecord},
      ]);

      await expectUiShowsHistoryRecord(callerPage, callerRecord);
      await expectUiShowsHistoryRecord(calleePage, calleeRecord);
    });

    test(`${testTitle(0)} / ${testTitle(4)} / ${testTitle(5)}`, async ({}, testInfo) => {
      test.setTimeout(1800000);

      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      const user1Journey = await runOutgoingHistoryJourney(
        {
          labelPrefix: 'user1-to-user2',
          originLabel: 'user1',
          originPage: callerPage,
          originNumber: callerNumber,
          targetLabel: 'user2',
          targetPage: calleePage,
          targetNumber: calleeNumber,
        },
        testInfo
      );

      const user2Journey = await runOutgoingHistoryJourney(
        {
          labelPrefix: 'user2-to-user1',
          originLabel: 'user2',
          originPage: calleePage,
          originNumber: calleeNumber,
          targetLabel: 'user1',
          targetPage: callerPage,
          targetNumber: callerNumber,
        },
        testInfo
      );

      await attachCallHistorySummary(testInfo, 'both-users-outgoing-journey', [
        ...user1Journey.debugRecords,
        ...user2Journey.debugRecords,
      ]);

      await expectUiShowsHistoryRecords(callerPage, user1Journey.originRecords);
      await expectUiShowsHistoryRecords(calleePage, user2Journey.originRecords);
    });
    /* eslint-enable no-empty-pattern */
  });
}
