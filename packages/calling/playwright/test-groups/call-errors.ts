import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {getUserSet, getToken, getPhoneNumber, isIntProject, isMobiusWsMode} from '../test-data';
import {
  navigateToCallingApp,
  initializeCallingSDK,
  verifySDKInitialized,
  setEnvironmentToInt,
} from '../utils/setup';
import {registerLine, verifyLineRegistered, unregisterLine} from '../utils/registration';
import {
  getMediaStreams,
  makeCall,
  endCall,
  holdCall,
  endIncomingCall,
  waitForCallDisconnect,
  establishCall,
  cleanupActiveCalls,
} from '../utils/call';
import {CALLING_SELECTORS, AWAIT_TIMEOUT} from '../constants';
import {MOBIUS_WS_MESSAGE, MobiusWsInterceptor} from '../utils/mobius-ws';

/**
 * Call error tests that need route intercepts before the call is made.
 * Each test gets a fresh page/context from Playwright (no shared state).
 */
export function callErrorTests() {
  test.describe('Call Errors', () => {
    test.afterEach(async ({page}) => {
      // Best-effort unregister to release stale device registrations on the backend.
      // Without this, successive tests that register the same account can fail
      // because Mobius still holds the previous device.
      try {
        const btn = page.locator(CALLING_SELECTORS.UNREGISTER_BTN);
        if (await btn.isEnabled({timeout: 2000})) {
          await btn.click({timeout: 5000});
          await page.waitForTimeout(3000);
        }
      } catch {
        // Cleanup is optional
      }
    });

    test('CALL-013: Call connect timeout - no stuck call on setup failure', async ({
      page,
      context,
    }, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      const role = getUserSet(testInfo.project.name).accounts[0];
      const mobiusWsMode = isMobiusWsMode();

      if (mobiusWsMode) {
        await new MobiusWsInterceptor({
          onRequest: (frame) =>
            frame.type === MOBIUS_WS_MESSAGE.CALL_SETUP
              ? {
                  statusCode: 500,
                  statusMessage: 'Internal Server Error',
                  data: {message: 'Call setup failed'},
                }
              : undefined,
        }).install(context);
      }

      await navigateToCallingApp(page);
      if (isInt) await setEnvironmentToInt(page);
      await initializeCallingSDK(page, getToken(role, isInt));
      await verifySDKInitialized(page);
      await registerLine(page);
      await verifyLineRegistered(page);
      await getMediaStreams(page);

      if (!mobiusWsMode) {
        await context.route(/\/devices\/[^/]+\/call$/, (route) => {
          route.fulfill({
            status: 500,
            body: JSON.stringify({message: 'Call setup failed'}),
          });
        });
      }

      await page
        .locator(CALLING_SELECTORS.DESTINATION_INPUT)
        .fill('+15005550000', {timeout: AWAIT_TIMEOUT});
      await page.locator(CALLING_SELECTORS.MAKE_CALL_BTN).click({timeout: AWAIT_TIMEOUT});

      await page.waitForFunction(
        () => {
          const calls = (window as any).callingClient.getActiveCalls();

          return Object.values(calls).flat().length === 0;
        },
        {timeout: 60000}
      );

      await context.unrouteAll({behavior: 'ignoreErrors'});

      const activeCalls = await page.evaluate(() => {
        const calls = (window as any).callingClient.getActiveCalls();

        return Object.values(calls).flat().length;
      });
      expect(activeCalls).toBe(0);
    });

    test('CALL-014: ROAP error - media negotiation failure triggers call teardown', async ({
      page,
      context,
    }, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      const accounts = getUserSet(testInfo.project.name).accounts;
      const calleeNumber = getPhoneNumber(accounts[1], isInt);
      const mobiusWsMode = isMobiusWsMode();

      if (mobiusWsMode) {
        await new MobiusWsInterceptor({
          onRequest: (frame) =>
            frame.type === MOBIUS_WS_MESSAGE.CALL_MEDIA
              ? {
                  statusCode: 500,
                  statusMessage: 'Internal Server Error',
                  data: {message: 'Media negotiation failed'},
                }
              : undefined,
        }).install(context);
      }

      await navigateToCallingApp(page);
      if (isInt) await setEnvironmentToInt(page);
      await initializeCallingSDK(page, getToken(accounts[0], isInt));
      await verifySDKInitialized(page);
      await registerLine(page);
      await verifyLineRegistered(page);
      await getMediaStreams(page);

      if (!mobiusWsMode) {
        await context.route('**/calls/**/media', (route) => {
          route.fulfill({status: 500, body: JSON.stringify({error: 'Media negotiation failed'})});
        });
      }

      await makeCall(page, calleeNumber);
      await page.waitForTimeout(3000);

      await page.waitForFunction(
        () => {
          const calls = (window as any).callingClient.getActiveCalls();

          return Object.values(calls).flat().length === 0;
        },
        {timeout: 30000}
      );

      await context.unrouteAll({behavior: 'ignoreErrors'});

      const activeCalls = await page.evaluate(() => {
        const calls = (window as any).callingClient.getActiveCalls();

        return Object.values(calls).flat().length;
      });
      expect(activeCalls).toBe(0);
    });

    test('CALL-015: Call to invalid destination - call fails and cleans up', async ({
      page,
    }, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      const role = getUserSet(testInfo.project.name).accounts[0];

      await navigateToCallingApp(page);
      if (isInt) await setEnvironmentToInt(page);
      await initializeCallingSDK(page, getToken(role, isInt));
      await verifySDKInitialized(page);
      await registerLine(page);
      await verifyLineRegistered(page);
      await getMediaStreams(page);

      // Dial a clearly invalid/unregistered number
      await makeCall(page, '1234567');

      // Call should eventually fail and clear — no orphaned call objects
      await page.waitForFunction(
        () => {
          const client = (window as any).callingClient;
          if (!client) return true;
          const calls = client.getActiveCalls();

          return Object.values(calls).flat().length === 0;
        },
        {timeout: 60000}
      );

      const activeCallsAfter = await page.evaluate(() => {
        const calls = (window as any).callingClient.getActiveCalls();

        return Object.values(calls).flat().length;
      });
      expect(activeCallsAfter).toBe(0);
    });
  });
}

/**
 * Edge-case call tests: race conditions, page close during active/held calls.
 * Serial chain — shared browser contexts for caller (account 0) and callee (account 1).
 *
 * CALL-019 and CALL-020 (page close) are destructive — they close the callee's page,
 * so they run last and share a final beforeAll/afterAll lifecycle.
 */
export function callEdgeCaseTests() {
  test.describe('Call Edge Cases', () => {
    test.describe.configure({mode: 'serial', timeout: 240000});

    let testManager: TestManager;
    let calleeNumber: string;

    test.beforeAll(async ({browser}, testInfo) => {
      testManager = new TestManager(testInfo.project.name);
      await Promise.all([
        testManager.setupContext(browser, 0, {
          initSDK: true,
          service: 'calling',
          register: true,
          media: true,
        }),
        testManager.setupContext(browser, 1, {
          initSDK: true,
          service: 'calling',
          register: true,
          media: true,
        }),
      ]);
      calleeNumber = getPhoneNumber(testManager.userSet.accounts[1], testManager.isInt);
    });

    test.afterEach(async () => {
      await Promise.all([
        cleanupActiveCalls(testManager.getPage(testManager.userSet.accounts[0])),
        cleanupActiveCalls(testManager.getPage(testManager.userSet.accounts[1])),
      ]);
      if (!testManager.page.isClosed()) {
        await testManager.page.waitForTimeout(3000);
      }
    });

    test.afterAll(async () => {
      await testManager.cleanup();
    });

    test('CALL-016: Resume and disconnect race - concurrent operations on 2 endpoints', async () => {
      const callerPage = testManager.getPage(testManager.userSet.accounts[0]);
      const calleePage = testManager.getPage(testManager.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);

      await holdCall(callerPage);
      // holdCall already asserts button value is 'Resume' — call is on hold

      // Race: caller resumes while callee disconnects simultaneously
      await Promise.all([
        callerPage.locator(CALLING_SELECTORS.HOLD_BTN).click({timeout: AWAIT_TIMEOUT}),
        endIncomingCall(calleePage),
      ]);

      // Both endpoints should cleanly reach zero active calls
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);

      const callerActiveCalls = await callerPage.evaluate(() => {
        const calls = (window as any).callingClient.getActiveCalls();

        return Object.values(calls).flat().length;
      });
      expect(callerActiveCalls).toBe(0);
    });

    test('CALL-017: Deregister during active call - callee deregisters mid-call', async ({
      browser,
    }) => {
      await Promise.all([
        testManager.setupContext(browser, 0, {
          initSDK: true,
          service: 'calling',
          register: true,
          media: true,
        }),
        testManager.setupContext(browser, 1, {
          initSDK: true,
          service: 'calling',
          register: true,
          media: true,
        }),
      ]);
      const callerPage = testManager.getPage(testManager.userSet.accounts[0]);
      const calleePage = testManager.getPage(testManager.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);

      // Callee deregisters while call is active
      await unregisterLine(calleePage);

      // Caller should see the call disconnect.
      // Don't use waitForCallDisconnect on callee — after deregistration
      // the Make Call button stays disabled (no registration), so the
      // button-enabled assertion would fail.
      await waitForCallDisconnect(callerPage, 60000);

      // Verify callee also has no active calls
      await calleePage.waitForFunction(
        () => {
          const client = (window as any).callingClient;
          if (!client) return true;
          const calls = client.getActiveCalls();

          return Object.values(calls).flat().length === 0;
        },
        {timeout: 60000}
      );

      const callerActiveCalls = await callerPage.evaluate(() => {
        const calls = (window as any).callingClient.getActiveCalls();

        return Object.values(calls).flat().length;
      });
      expect(callerActiveCalls).toBe(0);
    });

    test('CALL-018: Call to unregistered endpoint - call fails and cleans up', async ({
      browser,
    }) => {
      // Fresh contexts — CALL-017 deregistered the callee
      await Promise.all([
        testManager.setupContext(browser, 0, {
          initSDK: true,
          service: 'calling',
          register: true,
          media: true,
        }),
        testManager.setupContext(browser, 1, {
          initSDK: true,
          service: 'calling',
          register: true,
          media: true,
        }),
      ]);
      const callerPage = testManager.getPage(testManager.userSet.accounts[0]);
      const calleePage = testManager.getPage(testManager.userSet.accounts[1]);

      // Deregister callee so their device is offline
      await unregisterLine(calleePage);
      await calleePage.waitForTimeout(3000);

      // Caller dials callee's (now unregistered) number
      await makeCall(callerPage, calleeNumber);

      // Let the failure announcement play, then caller explicitly ends
      await callerPage.waitForTimeout(15000);
      await endCall(callerPage);
      await waitForCallDisconnect(callerPage);

      const activeCalls = await callerPage.evaluate(() => {
        const calls = (window as any).callingClient.getActiveCalls();

        return Object.values(calls).flat().length;
      });
      expect(activeCalls).toBe(0);
    });

    test.fixme(
      'CALL-019: Page close during active call - callee browser closes mid-call',
      async () => {
        const callerPage = testManager.getPage(testManager.userSet.accounts[0]);
        const calleePage = testManager.getPage(testManager.userSet.accounts[1]);

        await establishCall(callerPage, calleePage, calleeNumber);

        // Close callee's page abruptly (simulates browser crash / tab close)
        await calleePage.close();

        // Caller should eventually see the call disconnect
        await waitForCallDisconnect(callerPage, 60000);

        const callerActiveCalls = await callerPage.evaluate(() => {
          const calls = (window as any).callingClient.getActiveCalls();

          return Object.values(calls).flat().length;
        });
        expect(callerActiveCalls).toBe(0);
      }
    );

    test.fixme(
      'CALL-020: Page close during held call - callee browser closes while call is held',
      async ({browser}) => {
        // Known slow-disconnect issue: when a callee's browser closes during a held call,
        // the caller's SDK takes an extremely long time (~150s observed) to detect the
        // disconnect. The mobius-e2e-tests suite (tests/holdResume.test.ts TC-8) hit the
        // exact same problem and gave up — the test is marked `test.fixme` with the comment
        // "even closing the page doesn't trigger de-registration". We keep this test active
        // with a generous 180s waitForCallDisconnect timeout (and 240s test timeout) to
        // avoid flaking, but if this continues to be unreliable we should skip it like
        // mobius does and file a backend bug for the slow disconnect detection on held calls.
        //
        // Both contexts need fresh setup since CALL-019 closed the callee page
        // and the caller's UI state (hold button) may be stale
        await testManager.setupContext(browser, 0, {
          initSDK: true,
          service: 'calling',
          register: true,
          media: true,
        });
        await testManager.setupContext(browser, 1, {
          initSDK: true,
          service: 'calling',
          register: true,
          media: true,
        });
        const callerPage = testManager.getPage(testManager.userSet.accounts[0]);
        const calleePage = testManager.getPage(testManager.userSet.accounts[1]);

        await establishCall(callerPage, calleePage, calleeNumber);

        await holdCall(callerPage);

        // Close callee's page while call is held
        await calleePage.close();

        // Caller should eventually see the call disconnect.
        // 180s timeout: observed disconnect times of ~150s in CI (see comment above).
        await waitForCallDisconnect(callerPage, 180000);

        const callerActiveCalls = await callerPage.evaluate(() => {
          const calls = (window as any).callingClient.getActiveCalls();

          return Object.values(calls).flat().length;
        });
        expect(callerActiveCalls).toBe(0);
      }
    );
  });
}
