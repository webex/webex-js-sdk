import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {getPhoneNumber} from '../test-data';
import {
  makeCall,
  waitForIncomingCall,
  endCall,
  endIncomingCall,
  rejectCall,
  waitForCallDisconnect,
  establishCall,
  cleanupActiveCalls,
} from '../utils/call';
import {CALLING_SELECTORS, AWAIT_TIMEOUT} from '../constants';

/**
 * Core 2-party call lifecycle tests: outgoing, incoming, reject, hangup.
 * Serial chain — shared browser contexts for caller (account 0) and callee (account 1).
 */
export function callLifecycleTests() {
  test.describe('Call Lifecycle', () => {
    test.describe.configure({mode: 'serial', timeout: 180000});

    let tm: TestManager;
    let calleeNumber: string;

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
      ]);
      calleeNumber = getPhoneNumber(tm.userSet.accounts[1]);
    });

    test.afterEach(async () => {
      await Promise.all([
        cleanupActiveCalls(tm.getPage(tm.userSet.accounts[0])),
        cleanupActiveCalls(tm.getPage(tm.userSet.accounts[1])),
      ]);
      // Settle time for backend state between calls
      if (!tm.page.isClosed()) {
        await tm.page.waitForTimeout(3000);
      }
    });

    test.afterAll(async () => {
      await tm.cleanup();
    });

    test('CALL-001: Outgoing call happy path - full event sequence', async () => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);

      const [callerConnected, calleeConnected] = await Promise.all([
        callerPage.evaluate(() => {
          const calls = Object.values(
            (window as any).callingClient.getActiveCalls()
          ).flat() as any[];

          return calls.some((c: any) => c.isConnected());
        }),
        calleePage.evaluate(() => {
          const calls = Object.values(
            (window as any).callingClient.getActiveCalls()
          ).flat() as any[];

          return calls.some((c: any) => c.isConnected());
        }),
      ]);
      expect(callerConnected).toBe(true);
      expect(calleeConnected).toBe(true);

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-002: Incoming call answer flow - verify callee perspective', async () => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);

      await endIncomingCall(calleePage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-003: Incoming call reject flow - callee rejects call', async () => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await makeCall(callerPage, calleeNumber);
      await waitForIncomingCall(calleePage);
      await rejectCall(calleePage);

      await endCall(callerPage);
      await waitForCallDisconnect(callerPage);
      await waitForCallDisconnect(calleePage);
    });
  });
}

/**
 * Call lifecycle tests: remote disconnect, unanswered, media, metrics.
 * Fresh contexts — isolated from the basic lifecycle group.
 */
export function callLifecycleMediaTests() {
  test.describe('Call Lifecycle - Media & Disconnect', () => {
    test.describe.configure({mode: 'serial', timeout: 180000});

    let tm: TestManager;
    let calleeNumber: string;

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
      ]);
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

    test('CALL-014: Local disconnect - establish call, caller hangs up', async () => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-015: Remote disconnect - establish call, callee hangs up', async () => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);

      await endIncomingCall(calleePage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-033: Unanswered call - caller hangs up after no answer', async () => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await makeCall(callerPage, calleeNumber);
      await waitForIncomingCall(calleePage);

      // Callee never answers — wait a few seconds to simulate ring time
      await callerPage.waitForTimeout(5000);

      // Verify caller still has an active (ringing) call
      const hasActiveCall = await callerPage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat();

        return calls.length > 0;
      });
      expect(hasActiveCall).toBe(true);

      // Caller gives up and hangs up
      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-012: ROAP success - verify remote media after call established', async () => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);
      await callerPage.waitForTimeout(2000);

      const [callerHasRemoteAudio, calleeHasRemoteAudio] = await Promise.all([
        callerPage.evaluate(() => {
          const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement;

          return remoteAudio?.srcObject !== null;
        }),
        calleePage.evaluate(() => {
          const remoteAudio = document.getElementById('remote-audio') as HTMLAudioElement;

          return remoteAudio?.srcObject !== null;
        }),
      ]);
      expect(callerHasRemoteAudio).toBe(true);
      expect(calleeHasRemoteAudio).toBe(true);

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-018: Call metrics - verify call quality data available during call', async () => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);
      await callerPage.waitForTimeout(5000);

      await callerPage.locator('#get-call-quality').click({timeout: AWAIT_TIMEOUT});

      await expect(callerPage.locator(CALLING_SELECTORS.CALL_QUALITY_METRICS)).toContainText(
        'rtp-rxstat',
        {timeout: AWAIT_TIMEOUT}
      );

      const metricsText = await callerPage
        .locator(CALLING_SELECTORS.CALL_QUALITY_METRICS)
        .textContent();
      expect(metricsText).toBeTruthy();

      const metrics = JSON.parse(metricsText!);
      expect(metrics).toHaveProperty('rtp-rxstat');
      expect(metrics).toHaveProperty('rtp-txstat');
      expect(metrics['rtp-rxstat']).toHaveProperty('VQMetrics');
      expect(metrics['rtp-txstat']).toHaveProperty('VQMetrics');

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });
  });
}
