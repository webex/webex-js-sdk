import {test, expect, Browser} from '@playwright/test';
import {TestManager} from '../test-manager';
import {getPhoneNumber} from '../test-data';
import {
  makeCall,
  waitForIncomingCall,
  answerCall,
  rejectCall,
  holdCall,
  resumeCall,
  endCall,
  endIncomingCall,
  waitForCallDisconnect,
  establishCall,
  cleanupActiveCalls,
  waitForTransferCommitReady,
  completeConsultTransfer,
  getMediaStreams,
} from '../utils/call';
import {CALLING_SELECTORS, AWAIT_TIMEOUT} from '../constants';

/**
 * Set up a fresh 3-user TestManager (caller/callee/transfer) for a describe block.
 * Returns a getter so individual tests see the latest instance after beforeAll reassigns it.
 */
const setupThreeUserGroup = () => {
  let tm: TestManager | undefined;
  let calleeNumber: string;
  let transferNumber: string;

  const setup = async (browser: Browser, projectName: string) => {
    if (tm) {
      await tm.cleanup().catch(() => {});
    }

    tm = new TestManager(projectName);
    await Promise.all([
      tm.setupContext(browser, 0, {initSDK: true, service: 'calling', register: true, media: true}),
      tm.setupContext(browser, 1, {initSDK: true, service: 'calling', register: true, media: true}),
      tm.setupContext(browser, 2, {initSDK: true, service: 'calling', register: true, media: true}),
    ]);
    calleeNumber = getPhoneNumber(tm.userSet.accounts[1]);
    transferNumber = getPhoneNumber(tm.userSet.accounts[2]);
  };

  const cleanupAfterEach = async () => {
    if (!tm) return;

    await Promise.all([
      cleanupActiveCalls(tm.getPage(tm.userSet.accounts[0])),
      cleanupActiveCalls(tm.getPage(tm.userSet.accounts[1])),
      cleanupActiveCalls(tm.getPage(tm.userSet.accounts[2])),
    ]);

    await tm.cleanup().catch(() => {});
    tm = undefined;
  };

  return {
    setup,
    cleanupAfterEach,
    get tm() {
      if (!tm) {
        throw new Error('TestManager not initialized. Call setup() first.');
      }

      return tm;
    },
    get calleeNumber() {
      return calleeNumber;
    },
    get transferNumber() {
      return transferNumber;
    },
  };
};

/**
 * 3-party tests: blind transfer, consult transfer, transfer errors, busy/call-waiting.
 * Split into cohesive describes so each group runs with fresh browser contexts —
 * long serial chains on the same context cause ROAP/media state drift that
 * exhausts establishCall retry budgets.
 */
export function transferTests() {
  test.describe('Transfer - Blind', () => {
    test.describe.configure({mode: 'serial', timeout: 240000});

    const group = setupThreeUserGroup();

    test.beforeEach(async ({browser}, testInfo) => {
      await group.setup(browser, testInfo.project.name);
    });

    test.afterEach(() => group.cleanupAfterEach());

    test('CALL-009: Blind transfer completion - caller transfers call to third party', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, group.calleeNumber);

      await expect(callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 0});
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill(group.transferNumber);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});

      // Blind transfer is server-side — the SDK doesn't surface incoming_call on the target
      await waitForCallDisconnect(callerPage, 30000);

      const calleeConnected = await calleePage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];

        return calls.some((c: any) => c.isConnected());
      });
      expect(calleeConnected).toBe(true);

      await endIncomingCall(calleePage);
      await waitForCallDisconnect(calleePage);
    });

    test('CALL-026: Hold then blind transfer - callee holds, caller transfers to third party', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, group.calleeNumber);

      await holdCall(calleePage);

      await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 0});
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill(group.transferNumber);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});

      await waitForCallDisconnect(callerPage, 30000);

      // Observable proof of a successful blind-transfer-from-hold is limited to the
      // callee: caller's leg disconnects, callee's leg stays `isConnected()` because
      // the server bridged it to the transfer target. Do NOT resume — the server has
      // already bridged media, so the sample app's `resumed` event never fires (the
      // callee's SDK still reports `held: true` because that was the last state it
      // requested).
      const calleeConnected = await calleePage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];

        return calls.some((c: any) => c.isConnected());
      });
      expect(calleeConnected).toBe(true);

      await endIncomingCall(calleePage);
      await waitForCallDisconnect(calleePage);
    });

    test('CALL-027: Blind transfer rejection - transfer target rejects, original call remains', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);
      const transferPage = group.tm.getPage(group.tm.userSet.accounts[2]);

      await establishCall(callerPage, calleePage, group.calleeNumber);

      await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 0});
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill(group.transferNumber);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});

      await waitForIncomingCall(transferPage);
      await rejectCall(transferPage);

      await waitForCallDisconnect(transferPage, 30000);
      await callerPage.waitForTimeout(5000);

      const calleeStillConnected = await calleePage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];

        return calls.some((c: any) => c.isConnected());
      });
      expect(calleeStillConnected).toBe(true);

      await endIncomingCall(calleePage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });
  });

  test.describe('Transfer - Consult', () => {
    test.describe.configure({mode: 'serial', timeout: 240000});

    const group = setupThreeUserGroup();

    test.beforeEach(async ({browser}, testInfo) => {
      await group.setup(browser, testInfo.project.name);
    });

    test.afterEach(() => group.cleanupAfterEach());

    test('CALL-024: Consult transfer - caller consults then commits transfer to third party', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);
      const transferPage = group.tm.getPage(group.tm.userSet.accounts[2]);

      await establishCall(callerPage, calleePage, group.calleeNumber);

      await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 1});
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill(group.transferNumber);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});

      await waitForIncomingCall(transferPage);
      await answerCall(transferPage);

      await waitForTransferCommitReady(callerPage);
      await completeConsultTransfer(callerPage);

      await waitForCallDisconnect(callerPage, 30000);

      // After commit the server bridges callee ↔ transfer target; both should be connected.
      await expect
        .poll(
          async () =>
            Promise.all([
              calleePage.evaluate(() => {
                const calls = Object.values(
                  (window as any).callingClient.getActiveCalls()
                ).flat() as any[];

                return calls.some((c: any) => c.isConnected());
              }),
              transferPage.evaluate(() => {
                const calls = Object.values(
                  (window as any).callingClient.getActiveCalls()
                ).flat() as any[];

                return calls.some((c: any) => c.isConnected());
              }),
            ]),
          {
            timeout: 30000,
            message:
              'Expected callee and transfer target to both report an active connected call after consult transfer commit',
          }
        )
        .toEqual([true, true]);

      // Callee answered an incoming call, so its hangup button is #end (via endIncomingCall).
      await endIncomingCall(calleePage);
      await Promise.all([waitForCallDisconnect(calleePage), waitForCallDisconnect(transferPage)]);
    });

    test('CALL-025: Consult transfer rejection - target rejects, caller resumes original call', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);
      const transferPage = group.tm.getPage(group.tm.userSet.accounts[2]);

      await establishCall(callerPage, calleePage, group.calleeNumber);

      await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 1});
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill(group.transferNumber);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});

      await waitForIncomingCall(transferPage);
      await rejectCall(transferPage);

      // Match the external Testcase-13-14 flow as closely as this sample app allows.
      // There is no explicit "returnToCall()" UI here: once the transfer target rejects,
      // the consult leg disconnects and leaves only the original held call on the caller.
      const [callerPreResume, transferCallCount] = await Promise.all([
        callerPage.evaluate(() => {
          const calls = Object.values(
            (window as any).callingClient.getActiveCalls()
          ).flat() as any[];
          const connected = calls.find((c: any) => c.isConnected());

          return {
            callCount: calls.length,
            hasConnected: !!connected,
            remoteNum: connected?.getCallerInfo?.()?.num ?? null,
          };
        }),
        transferPage.evaluate(
          () => Object.values((window as any).callingClient.getActiveCalls()).flat().length
        ),
      ]);
      expect(callerPreResume.callCount).toBe(1);
      expect(callerPreResume.hasConnected).toBe(false);
      expect(transferCallCount).toBe(0);
      await expect(callerPage.locator(CALLING_SELECTORS.HOLD_BTN)).toHaveValue('Resume', {
        timeout: AWAIT_TIMEOUT,
      });

      await resumeCall(callerPage);

      const [callerInfo, calleeConnected] = await Promise.all([
        callerPage.evaluate(() => {
          const calls = Object.values(
            (window as any).callingClient.getActiveCalls()
          ).flat() as any[];
          const connected = calls.find((c: any) => c.isConnected());

          return {
            hasConnected: !!connected,
            remoteNum: connected?.getCallerInfo?.()?.num ?? null,
          };
        }),
        calleePage.evaluate(() => {
          const calls = Object.values(
            (window as any).callingClient.getActiveCalls()
          ).flat() as any[];

          return calls.some((c: any) => c.isConnected());
        }),
      ]);
      expect(callerInfo.hasConnected).toBe(true);
      expect(calleeConnected).toBe(true);
      // Caller's remaining call must be the original to the callee, not the rejected
      // transfer target. Compare digit suffixes — SIP URIs can drop + / country code.
      const calleeDigitSuffix = group.calleeNumber.replace(/\D/g, '').slice(-6);
      expect((callerInfo.remoteNum ?? '').replace(/\D/g, '')).toContain(calleeDigitSuffix);

      // End from callee side — mirrors the Testcase-13-14 flow and exercises hangup
      // from the non-holding party. Callee answered an incoming call, so its hangup
      // button is #end (via endIncomingCall), not #end-call.
      await endIncomingCall(calleePage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-017: ALL_CALLS_CLEARED - fires after last call ends (consult transfer)', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);
      const transferPage = group.tm.getPage(group.tm.userSet.accounts[2]);

      await establishCall(callerPage, calleePage, group.calleeNumber);

      await callerPage.evaluate(() => {
        (window as any).__allCallsClearedCount = 0;
        const callManager = (window as any).callingClient.callManager;
        callManager.on('callingClient:all_calls_cleared', () => {
          (window as any).__allCallsClearedCount += 1;
        });
      });

      await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 1});
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill(group.transferNumber);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});

      await waitForIncomingCall(transferPage);
      await answerCall(transferPage);

      await expect(callerPage.locator(CALLING_SELECTORS.END_SECOND_CALL_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });

      const activeCallsDuring = await callerPage.evaluate(() => {
        const calls = (window as any).callingClient.getActiveCalls();

        return Object.values(calls).flat().length;
      });
      expect(activeCallsDuring).toBe(2);

      await callerPage
        .locator(CALLING_SELECTORS.END_SECOND_CALL_BTN)
        .click({timeout: AWAIT_TIMEOUT});
      await callerPage.waitForTimeout(3000);

      const clearedAfterFirst = await callerPage.evaluate(
        () => (window as any).__allCallsClearedCount
      );
      expect(clearedAfterFirst).toBe(0);

      const activeCallsAfterOne = await callerPage.evaluate(() => {
        const calls = (window as any).callingClient.getActiveCalls();

        return Object.values(calls).flat().length;
      });
      expect(activeCallsAfterOne).toBe(1);

      await endCall(callerPage);
      await waitForCallDisconnect(callerPage);
      await callerPage.waitForTimeout(3000);

      const clearedAfterAll = await callerPage.evaluate(
        () => (window as any).__allCallsClearedCount
      );
      expect(clearedAfterAll).toBe(1);

      const activeCallsAfter = await callerPage.evaluate(() => {
        const calls = (window as any).callingClient.getActiveCalls();

        return Object.values(calls).flat().length;
      });
      expect(activeCallsAfter).toBe(0);
    });
  });

  test.describe('Transfer - Errors & Call Waiting', () => {
    test.describe.configure({mode: 'serial', timeout: 240000});

    const group = setupThreeUserGroup();

    test.beforeAll(async ({browser}, testInfo) => {
      await group.setup(browser, testInfo.project.name);
    });

    // Deeper reset between tests in this block: call cleanup + unroute stragglers
    // + refresh media on every page. CALL-010 installs a page.route fake-500; if
    // its unroute is ever missed, subsequent tests silently inherit the mock.
    // The media refresh resets WebRTC peer-connection/DTLS state which otherwise
    // drifts across long serial chains and stalls establishCall in later tests.
    test.afterEach(async () => {
      const pages = [
        group.tm.getPage(group.tm.userSet.accounts[0]),
        group.tm.getPage(group.tm.userSet.accounts[1]),
        group.tm.getPage(group.tm.userSet.accounts[2]),
      ];

      await Promise.all(pages.map((p) => cleanupActiveCalls(p)));
      await Promise.all(
        pages.map(async (p) => {
          if (p.isClosed()) return;
          // Best-effort unroute — no-op if nothing was routed
          await p.unrouteAll({behavior: 'ignoreErrors'}).catch(() => {});
        })
      );
      await Promise.all(
        pages.map(async (p) => {
          if (p.isClosed()) return;
          await getMediaStreams(p).catch(() => {});
        })
      );
      try {
        if (!pages[0].isClosed()) await pages[0].waitForTimeout(2000);
      } catch {
        // Page may have closed during teardown
      }
    });
    test.afterAll(() => group.teardown());

    test('CALL-010: Transfer failure - transfer_error event emitted', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, group.calleeNumber);

      await callerPage.evaluate(() => {
        (window as any).__transferError = null;
        const calls = (window as any).callingClient.getActiveCalls();
        const activeCall = Object.values(calls).flat()[0] as any;
        activeCall.on('transfer_error', (err: any) => {
          (window as any).__transferError = err;
        });
      });

      await callerPage.route('**/services/calltransfer/commit', (route) => {
        route.fulfill({status: 500, body: 'Internal Server Error'});
      });

      await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 0});
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill('+15005550000');
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});

      await callerPage.waitForFunction(() => (window as any).__transferError !== null, {
        timeout: 15000,
      });
      const transferError = await callerPage.evaluate(() => (window as any).__transferError);
      expect(transferError).toBeTruthy();

      await callerPage.unroute('**/services/calltransfer/commit');

      const callStillActive = await callerPage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];

        return calls.some((c: any) => c.isConnected());
      });
      expect(callStillActive).toBe(true);

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test.skip('CALL-004: Remote busy handling - caller dials callee already on a call', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);
      const transferPage = group.tm.getPage(group.tm.userSet.accounts[2]);

      // Busy the callee by establishing a call with the transfer target first
      await establishCall(transferPage, calleePage, group.calleeNumber);

      // Caller tries to call the busy callee — call waiting means it rings
      await makeCall(callerPage, group.calleeNumber);

      await callerPage.waitForFunction(
        () => {
          const calls = (window as any).callingClient?.getActiveCalls();
          if (!calls) return false;

          return Object.values(calls).flat().length > 0;
        },
        {timeout: 15000}
      );

      const activeCallsDuring = await callerPage.evaluate(() => {
        const calls = (window as any).callingClient.getActiveCalls();

        return Object.values(calls).flat().length;
      });
      expect(activeCallsDuring).toBeGreaterThan(0);

      await endCall(callerPage);
      await waitForCallDisconnect(callerPage, 30000);

      await callerPage.waitForTimeout(2000);
      const activeCallsAfter = await callerPage.evaluate(() => {
        const calls = (window as any).callingClient.getActiveCalls();

        return Object.values(calls).flat().length;
      });
      expect(activeCallsAfter).toBe(0);

      await endCall(transferPage);
      await Promise.all([waitForCallDisconnect(transferPage), waitForCallDisconnect(calleePage)]);
    });
  });
}
