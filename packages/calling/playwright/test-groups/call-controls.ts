import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {getPhoneNumber} from '../test-data';
import {
  sendDTMF,
  holdCall,
  resumeCall,
  endCall,
  endIncomingCall,
  waitForCallDisconnect,
  establishCall,
  cleanupActiveCalls,
} from '../utils/call';
import {CALLING_SELECTORS, AWAIT_TIMEOUT} from '../constants';

/**
 * Call control tests: mute/unmute, DTMF, network flap.
 * Fresh contexts — isolated from hold and error groups.
 */
export function callControlTests() {
  test.describe('Call Controls', () => {
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

    test('CALL-030: Mute and unmute - toggle mute during active call', async () => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);

      const initialMuted = await callerPage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];

        return calls[0]?.isMuted();
      });
      expect(initialMuted).toBe(false);

      await callerPage.locator(CALLING_SELECTORS.MUTE_BTN).click({timeout: AWAIT_TIMEOUT});
      await callerPage.waitForTimeout(2000);

      const isMutedAfterClick = await callerPage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];

        return calls[0]?.isMuted();
      });
      expect(isMutedAfterClick).toBe(true);

      await callerPage.locator(CALLING_SELECTORS.MUTE_BTN).click({timeout: AWAIT_TIMEOUT});
      await callerPage.waitForTimeout(2000);

      const isMutedAfterUnmute = await callerPage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];

        return calls[0]?.isMuted();
      });
      expect(isMutedAfterUnmute).toBe(false);

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-008: DTMF send - send digit sequence during call', async () => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);

      const digits = ['1', '2', '3', '5', '*', '#'];
      /* eslint-disable no-await-in-loop */
      for (const digit of digits) {
        await sendDTMF(callerPage, digit);
        await callerPage.waitForTimeout(500);
      }
      /* eslint-enable no-await-in-loop */

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-016: Network flap with active call - call survives brief disruption', async () => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);

      await tm.getContext(tm.userSet.accounts[0]).setOffline(true);
      await callerPage.waitForTimeout(3000);
      await tm.getContext(tm.userSet.accounts[0]).setOffline(false);
      await callerPage.waitForTimeout(5000);

      const stillConnected = await callerPage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];

        return calls.some((c: any) => c.isConnected());
      });
      expect(stillConnected).toBe(true);

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });
  });
}

/**
 * Hold/resume tests: multiple cycles, callee-side hold, hold+disconnect combos.
 * Each destructive test gets fresh contexts via setupContext.
 */
export function callHoldTests() {
  test.describe('Call Hold', () => {
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

    test('CALL-005: Hold and resume - multiple cycles', async () => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);

      /* eslint-disable no-await-in-loop */
      for (let i = 0; i < 3; i += 1) {
        await holdCall(callerPage);
        await callerPage.waitForTimeout(1000);

        await resumeCall(callerPage);
        await callerPage.waitForTimeout(1000);
      }
      /* eslint-enable no-await-in-loop */

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test.fixme('CALL-032: Callee-side hold and resume', async ({browser}) => {
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
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      // Let Mobius settle after fresh registration before placing a call
      await callerPage.waitForTimeout(5000);

      await establishCall(callerPage, calleePage, calleeNumber);

      await holdCall(calleePage);

      await callerPage.waitForFunction(
        () => {
          const calls = Object.values(
            (window as any).callingClient.getActiveCalls()
          ).flat() as any[];

          return calls.some((c: any) => c.isHeld());
        },
        {timeout: 15000}
      );

      await calleePage.waitForTimeout(1000);

      await resumeCall(calleePage);

      await callerPage.waitForFunction(
        () => {
          const calls = Object.values(
            (window as any).callingClient.getActiveCalls()
          ).flat() as any[];

          return calls.some((c: any) => c.isConnected() && !c.isHeld());
        },
        {timeout: 15000}
      );

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-019: Hold then remote disconnect - callee hangs up while caller holds', async ({
      browser,
    }) => {
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
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      // Let Mobius settle after fresh registration before placing a call
      await callerPage.waitForTimeout(5000);

      await establishCall(callerPage, calleePage, calleeNumber);

      await holdCall(callerPage);

      await endIncomingCall(calleePage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);

      const callerActiveCalls = await callerPage.evaluate(() => {
        const calls = (window as any).callingClient.getActiveCalls();

        return Object.values(calls).flat().length;
      });
      expect(callerActiveCalls).toBe(0);
    });

    test('CALL-020: Hold then immediate disconnect - caller holds and immediately hangs up', async ({
      browser,
    }) => {
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
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      // Let Mobius settle after fresh registration before placing a call
      await callerPage.waitForTimeout(5000);

      await establishCall(callerPage, calleePage, calleeNumber);

      await holdCall(callerPage);

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);

      const callerActiveCalls = await callerPage.evaluate(() => {
        const calls = (window as any).callingClient.getActiveCalls();

        return Object.values(calls).flat().length;
      });
      expect(callerActiveCalls).toBe(0);
    });
  });
}

/**
 * Hold/resume error injection tests.
 * Each test gets fresh contexts — route interception leaves dirty state.
 */
export function callHoldErrorTests() {
  test.describe('Call Hold Errors', () => {
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

    test('CALL-007: Resume API failure - resume_error event emitted', async ({browser}) => {
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
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);
      await holdCall(callerPage);

      await callerPage.evaluate(() => {
        (window as any).__resumeError = null;
        const calls = (window as any).callingClient.getActiveCalls();
        const activeCall = Object.values(calls).flat()[0] as any;
        activeCall.on('resume_error', (err: any) => {
          (window as any).__resumeError = err;
        });
      });

      await callerPage.route('**/services/callhold/resume', (route) => {
        route.fulfill({status: 500, body: 'Internal Server Error'});
      });

      await callerPage.locator(CALLING_SELECTORS.HOLD_BTN).click({timeout: AWAIT_TIMEOUT});

      await callerPage.waitForFunction(() => (window as any).__resumeError !== null, {
        timeout: 15000,
      });
      const resumeError = await callerPage.evaluate(() => (window as any).__resumeError);
      expect(resumeError).toBeTruthy();
      await expect(callerPage.locator(CALLING_SELECTORS.HOLD_BTN)).toHaveValue('Resume');

      await callerPage.unroute('**/services/callhold/resume');

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-006: Hold API failure - hold_error event emitted', async ({browser}) => {
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
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);

      await callerPage.evaluate(() => {
        (window as any).__holdError = null;
        const calls = (window as any).callingClient.getActiveCalls();
        const activeCall = Object.values(calls).flat()[0] as any;
        activeCall.on('hold_error', (err: any) => {
          (window as any).__holdError = err;
        });
      });

      await callerPage.route('**/services/callhold/hold', (route) => {
        route.fulfill({status: 500, body: 'Internal Server Error'});
      });

      await callerPage.locator(CALLING_SELECTORS.HOLD_BTN).click({timeout: AWAIT_TIMEOUT});

      await callerPage.waitForFunction(() => (window as any).__holdError !== null, {
        timeout: 15000,
      });
      const holdError = await callerPage.evaluate(() => (window as any).__holdError);
      expect(holdError).toBeTruthy();
      await expect(callerPage.locator(CALLING_SELECTORS.HOLD_BTN)).toHaveValue('Hold');

      await callerPage.unroute('**/services/callhold/hold');

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });
  });
}
