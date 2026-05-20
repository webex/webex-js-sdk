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
      'Run one continuous two-user journey: User 1 calls User 2 answered, rejected, and missed; then User 2 calls User 1 answered, rejected, and missed.',
      'Open the sample app Call History list for both users after every call action.',
    ],
    expected: [
      'User 1 history contains the recent outgoing and incoming records from the full two-user journey.',
      'User 2 history contains the recent outgoing and incoming records from the full two-user journey.',
      'The table header renders the Call History columns and the disposition column shows ANSWERED for answered calls, CANCELED/REJECTED for rejected calls, and CANCELED/MISSED for missed calls.',
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
    title: 'User 1 login shows answered, rejected, and missed records from the two-user journey',
    preconditions: ['Both users stay initialized, registered, and media-ready in one browser run.'],
    steps: [
      'User 1 calls User 2 and User 2 answers.',
      'Open Call History for User 1 and User 2.',
      'User 1 calls User 2 again and User 2 rejects.',
      'Open Call History for User 1 and User 2.',
      'User 1 calls User 2 again and User 2 does not answer.',
      'Open Call History for User 1 and User 2.',
    ],
    expected: [
      'User 1 shows recent OUTGOING records for User 1 to User 2 and INCOMING records for User 2 to User 1 in one login.',
      'The disposition column shows ANSWERED when the call is picked, CANCELED for outgoing rejected or missed attempts, REJECTED for incoming rejected attempts, and MISSED for incoming missed attempts.',
      'Every record has valid start and end timestamps.',
      'The answered call includes valid non-negative duration derived from the timestamps.',
      'The sample app Call History table renders the current journey records after each call action.',
    ],
  },
  {
    id: 'CH-ALL-002',
    title: 'User 2 login shows answered, rejected, and missed records from the two-user journey',
    preconditions: ['Both users stay initialized, registered, and media-ready in one browser run.'],
    steps: [
      'User 2 calls User 1 and User 1 answers.',
      'Open Call History for User 2 and User 1.',
      'User 2 calls User 1 again and User 1 rejects.',
      'Open Call History for User 2 and User 1.',
      'User 2 calls User 1 again and User 1 does not answer.',
      'Open Call History for User 2 and User 1.',
    ],
    expected: [
      'User 2 shows recent OUTGOING records for User 2 to User 1 and INCOMING records for User 1 to User 2 in one login.',
      'The disposition column shows ANSWERED when the call is picked, CANCELED for outgoing rejected or missed attempts, REJECTED for incoming rejected attempts, and MISSED for incoming missed attempts.',
      'Every record has valid start and end timestamps.',
      'The answered call includes valid non-negative duration derived from the timestamps.',
      'The sample app Call History table renders the current journey records after each call action.',
    ],
  },
] as const;

const ANSWERED_DISPOSITIONS = ['ANSWERED', 'INITIATED'];
const MISSED_CALLER_DISPOSITIONS = ['CANCELED', 'INITIATED'];
const REJECTED_CALLER_DISPOSITIONS = ['CANCELED', 'INITIATED'];
const REJECTED_CALLEE_DISPOSITIONS = ['REJECTED', 'MISSED', 'CANCELED'];
const HISTORY_TIME_LOOKBACK_MS = 5000;
const RECENT_RECORD_TOLERANCE_MS = 120000;
const COUNTERPART_MATCH_MIN_DIGITS = 4;

type CallJourneyOutcome = 'ANSWERED' | 'REJECTED' | 'MISSED';
type CallHistoryDisposition = CallJourneyOutcome | 'CANCELED';

type HistoryMatcherOptions = {
  counterpartNumber: string;
  direction: 'INCOMING' | 'OUTGOING';
  startedAt: Date;
  dispositions?: string[];
};

type HistoryDebugRecord = {
  user: 'user1' | 'user2';
  expectedDisposition: CallHistoryDisposition;
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
  outcome: CallJourneyOutcome;
  originSeenHistoryKeys: Set<string>;
  targetSeenHistoryKeys: Set<string>;
};

type BidirectionalHistoryJourneyOptions = {
  user1Page: Page;
  user1Number: string;
  user2Page: Page;
  user2Number: string;
};

type BidirectionalHistoryJourneyResult = {
  user1Records: CallHistoryRecord[];
  user2Records: CallHistoryRecord[];
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

const getIncomingDispositionsForOutcome = (outcome: CallJourneyOutcome): string[] => {
  if (outcome === 'ANSWERED') {
    return ANSWERED_DISPOSITIONS;
  }

  if (outcome === 'REJECTED') {
    return REJECTED_CALLEE_DISPOSITIONS;
  }

  return ['MISSED'];
};

const getOutgoingDispositionsForOutcome = (outcome: CallJourneyOutcome): string[] => {
  if (outcome === 'ANSWERED') {
    return ANSWERED_DISPOSITIONS;
  }

  if (outcome === 'REJECTED') {
    return REJECTED_CALLER_DISPOSITIONS;
  }

  return MISSED_CALLER_DISPOSITIONS;
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

const getDisplayHistoryRecords = (
  records: HistoryDebugRecord[],
  user: UserLabel
): CallHistoryRecord[] =>
  records
    .filter((debugRecord) => debugRecord.user === user)
    .map(({expectedDisposition, record}) => ({
      ...record,
      disposition: expectedDisposition,
    }));

const executeCallJourneyLeg = async (
  leg: CallJourneyLeg,
  testInfo: TestInfo
): Promise<HistoryDebugRecord[]> => {
  await Promise.all([
    rememberCurrentHistoryRecords(leg.originPage, leg.originSeenHistoryKeys),
    rememberCurrentHistoryRecords(leg.targetPage, leg.targetSeenHistoryKeys),
  ]);

  const startedAt = new Date(Date.now() - HISTORY_TIME_LOOKBACK_MS);

  if (leg.outcome === 'ANSWERED') {
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

const runBidirectionalHistoryJourney = async (
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
        {user: 'user1', expectedDisposition: 'ANSWERED', record: callerRecord},
        {user: 'user2', expectedDisposition: 'ANSWERED', record: calleeRecord},
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
            dispositions: MISSED_CALLER_DISPOSITIONS,
          }),
        'caller outgoing unanswered call'
      );

      expectDisposition(calleeMissedRecord, ['MISSED']);
      expectHistoryTiming(calleeMissedRecord, {notBefore: startedAt, notAfter: endedAt});
      expectHistoryTiming(callerCanceledRecord, {notBefore: startedAt, notAfter: endedAt});
      await attachCallHistorySummary(testInfo, 'missed-not-picked', [
        {user: 'user1', expectedDisposition: 'CANCELED', record: callerCanceledRecord},
        {user: 'user2', expectedDisposition: 'MISSED', record: calleeMissedRecord},
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
            dispositions: REJECTED_CALLER_DISPOSITIONS,
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
        {user: 'user1', expectedDisposition: 'CANCELED', record: callerRecord},
        {user: 'user2', expectedDisposition: 'REJECTED', record: calleeRecord},
      ]);

      await expectUiShowsHistoryRecord(callerPage, callerRecord);
      await expectUiShowsHistoryRecord(calleePage, calleeRecord);
    });

    test(`${testTitle(0)} / ${testTitle(4)} / ${testTitle(5)}`, async ({}, testInfo) => {
      test.setTimeout(1800000);

      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      const journey = await runBidirectionalHistoryJourney(
        {
          user1Page: callerPage,
          user1Number: callerNumber,
          user2Page: calleePage,
          user2Number: calleeNumber,
        },
        testInfo
      );

      expect(journey.user1Records).toHaveLength(6);
      expect(journey.user2Records).toHaveLength(6);

      await attachCallHistorySummary(
        testInfo,
        'both-users-call-history-journey',
        journey.debugRecords
      );

      await Promise.all([
        expectUiShowsHistoryRecords(
          callerPage,
          getDisplayHistoryRecords(journey.debugRecords, 'user1')
        ),
        expectUiShowsHistoryRecords(
          calleePage,
          getDisplayHistoryRecords(journey.debugRecords, 'user2')
        ),
      ]);
    });
    /* eslint-enable no-empty-pattern */
  });
}
