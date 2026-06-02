import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {getPhoneNumber} from '../test-data';
import {
  cleanupActiveCalls,
  endCall,
  endCallerIfStillActive,
  establishCall,
  makeCall,
  rejectCall,
  waitForCallDisconnect,
  waitForIncomingCall,
} from '../utils/call';
import {
  CALL_HISTORY_ANSWERED_DISPOSITIONS,
  CALL_HISTORY_MISSED_CALLER_DISPOSITIONS,
  CALL_HISTORY_REJECTED_CALLEE_DISPOSITIONS,
  CALL_HISTORY_REJECTED_CALLER_DISPOSITIONS,
  CALL_HISTORY_TIME_LOOKBACK_MS,
} from '../constants';
import {
  attachCallHistorySummary,
  expectHistoryTiming,
  expectUiShowsHistoryRecord,
  expectUiShowsHistoryRecords,
  getCallHistoryRecords,
  getDisplayHistoryRecords,
  openCallHistoryList,
  waitForCallHistoryCase,
} from '../utils/call-history';
import {runBidirectionalHistoryJourney} from '../utils/call-history-journey';

export function callHistoryTests() {
  test.describe('Call History Query', () => {
    test('CH-QUERY-001: Call history query helper passes pagination and sorting options', async ({
      page,
    }) => {
      await page.evaluate(() => {
        (window as any).__callHistoryQueryArgs = [];
        (window as any).callHistory = {
          getCallHistoryData: async (...args: unknown[]) => {
            (window as any).__callHistoryQueryArgs.push(args);

            return {data: {userSessions: [{sessionId: 'query-record'}]}};
          },
        };
      });

      const records = await getCallHistoryRecords(page, {
        days: 3,
        limit: 5,
        sort: 'ASC',
        sortBy: 'startTime',
      });

      const queryArgs = await page.evaluate(() => (window as any).__callHistoryQueryArgs[0]);

      expect(records).toEqual([{sessionId: 'query-record'}]);
      expect(queryArgs).toEqual([3, 5, 'ASC', 'startTime']);
    });
  });

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
    test('CH-CALL-001: Answered call creates exact per-user history records', async ({}, testInfo) => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);
      const startedAt = new Date(Date.now() - CALL_HISTORY_TIME_LOOKBACK_MS);

      await establishCall(callerPage, calleePage, calleeNumber);
      await callerPage.waitForTimeout(2000);
      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
      const endedAt = new Date();

      const callerRecord = await waitForCallHistoryCase(
        callerPage,
        {
          counterpartNumber: calleeNumber,
          direction: 'OUTGOING',
          startedAt,
          dispositions: CALL_HISTORY_ANSWERED_DISPOSITIONS,
        },
        'caller outgoing answered call'
      );
      const calleeRecord = await waitForCallHistoryCase(
        calleePage,
        {
          counterpartNumber: callerNumber,
          direction: 'INCOMING',
          startedAt,
          dispositions: CALL_HISTORY_ANSWERED_DISPOSITIONS,
        },
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

    test('CH-CALL-002: Missed call creates exact callee MISSED history', async ({}, testInfo) => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);
      const startedAt = new Date(Date.now() - CALL_HISTORY_TIME_LOOKBACK_MS);

      await makeCall(callerPage, calleeNumber);
      await waitForIncomingCall(calleePage);
      await callerPage.waitForTimeout(5000);
      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
      const endedAt = new Date();

      const calleeMissedRecord = await waitForCallHistoryCase(
        calleePage,
        {
          counterpartNumber: callerNumber,
          direction: 'INCOMING',
          startedAt,
          dispositions: ['MISSED'],
        },
        'callee incoming missed call'
      );
      const callerCanceledRecord = await waitForCallHistoryCase(
        callerPage,
        {
          counterpartNumber: calleeNumber,
          direction: 'OUTGOING',
          startedAt,
          dispositions: CALL_HISTORY_MISSED_CALLER_DISPOSITIONS,
        },
        'caller outgoing unanswered call'
      );

      expectHistoryTiming(calleeMissedRecord, {notBefore: startedAt, notAfter: endedAt});
      expectHistoryTiming(callerCanceledRecord, {notBefore: startedAt, notAfter: endedAt});
      await attachCallHistorySummary(testInfo, 'missed-not-picked', [
        {user: 'user1', expectedDisposition: 'CANCELED', record: callerCanceledRecord},
        {user: 'user2', expectedDisposition: 'MISSED', record: calleeMissedRecord},
      ]);

      await expectUiShowsHistoryRecord(calleePage, calleeMissedRecord);
      await expectUiShowsHistoryRecord(callerPage, callerCanceledRecord);
    });

    test('CH-CALL-003: Rejected call creates exact per-user history records', async ({}, testInfo) => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);
      const startedAt = new Date(Date.now() - CALL_HISTORY_TIME_LOOKBACK_MS);

      await makeCall(callerPage, calleeNumber);
      await waitForIncomingCall(calleePage);
      await rejectCall(calleePage);
      await endCallerIfStillActive(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
      const endedAt = new Date();

      const callerRecord = await waitForCallHistoryCase(
        callerPage,
        {
          counterpartNumber: calleeNumber,
          direction: 'OUTGOING',
          startedAt,
          dispositions: CALL_HISTORY_REJECTED_CALLER_DISPOSITIONS,
        },
        'caller outgoing rejected call'
      );
      const calleeRecord = await waitForCallHistoryCase(
        calleePage,
        {
          counterpartNumber: callerNumber,
          direction: 'INCOMING',
          startedAt,
          dispositions: CALL_HISTORY_REJECTED_CALLEE_DISPOSITIONS,
        },
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

    test('CH-LIST-001: Bidirectional journey renders in Call History UI', async ({}, testInfo) => {
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
