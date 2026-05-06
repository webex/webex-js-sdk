import {test, expect} from '@playwright/test';
import {TestManager} from '../test-manager';
import {getPhoneNumber} from '../test-data';
import {endCall, waitForCallDisconnect, establishCall, cleanupActiveCalls} from '../utils/call';

/**
 * Helper: get the active call object and clear the SDK's 10-minute keepalive timer,
 * so tests can trigger postStatus() on demand without waiting.
 *
 * TypeScript `private` is compile-time only — at runtime we can access sessionTimer
 * directly on the call object to clear/replace it.
 */
const disableAutoKeepalive = async (page: import('@playwright/test').Page): Promise<void> => {
  await page.evaluate(() => {
    const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];
    const activeCall = calls[0];
    if (activeCall?.sessionTimer) {
      clearInterval(activeCall.sessionTimer);
      activeCall.sessionTimer = undefined;
    }
  });
};

/**
 * Helper: invoke postStatus() on the active call and return the outcome.
 * Returns {success: true} or {success: false, error: string}.
 */
const triggerKeepalive = async (
  page: import('@playwright/test').Page
): Promise<{success: boolean; error?: string}> =>
  page.evaluate(async () => {
    const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];
    const activeCall = calls[0];
    if (!activeCall) return {success: false, error: 'no active call'};
    try {
      await activeCall.postStatus();

      return {success: true};
    } catch (e: any) {
      return {success: false, error: e?.message || String(e)};
    }
  });

/**
 * Call keepalive tests — verify the SDK's session refresh behaviour
 * (postStatus POST to /calls/{id}/status) under success and failure conditions.
 *
 * We don't wait for the real 10-minute timer — instead we clear the SDK's
 * setInterval and invoke postStatus() directly, with route interception
 * controlling the response.
 *
 * Each test gets fresh contexts because route interception must be set up
 * before the call is established (to avoid races).
 */
export function callKeepaliveTests() {
  test.describe('Call Keepalive', () => {
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
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      // Unroute any intercepted requests from this test
      await callerPage.unrouteAll({behavior: 'ignoreErrors'}).catch(() => {});
      await Promise.all([cleanupActiveCalls(callerPage), cleanupActiveCalls(calleePage)]);
      if (!tm.page.isClosed()) {
        await tm.page.waitForTimeout(3000);
      }
    });

    test.afterAll(async () => {
      await tm.cleanup();
    });

    test('CALL-024: Keepalive success - postStatus 200 keeps call alive', async () => {
      const callerPage = tm.getPage(tm.userSet.accounts[0]);
      const calleePage = tm.getPage(tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, calleeNumber);
      await disableAutoKeepalive(callerPage);

      // Trigger keepalive manually — should succeed against real backend
      const result = await triggerKeepalive(callerPage);
      expect(result.success).toBe(true);

      // Call should still be connected after keepalive
      const stillConnected = await callerPage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];

        return calls.some((c: any) => c.isConnected());
      });
      expect(stillConnected).toBe(true);

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-025: Keepalive 401 - expired token tears down call', async ({browser}) => {
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
      await disableAutoKeepalive(callerPage);

      // Listen for call_error event
      await callerPage.evaluate(() => {
        (window as any).__callError = null;
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];
        const activeCall = calls[0];
        activeCall.on('call_error', (err: any) => {
          (window as any).__callError = err;
        });
      });

      // Intercept the status POST and return 401
      await callerPage.route('**/calls/**/status', (route) => {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({message: 'Token expired'}),
        });
      });

      // Trigger the keepalive error path via the SDK's internal handler.
      // We call handleCallKeepaliveError indirectly by invoking postStatus
      // through the retry machinery — but since we disabled the auto-timer,
      // we re-enable a short one to trigger the full error flow.
      await callerPage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];
        const activeCall = calls[0];
        // Trigger the internal keepalive flow that handles errors properly
        activeCall.sessionTimer = setInterval(async () => {
          try {
            await activeCall.postStatus();
          } catch (err: unknown) {
            await activeCall.handleCallKeepaliveError(err);
          }
        }, 500);
      });

      // Call should disconnect due to 401
      await waitForCallDisconnect(callerPage, 30000);

      // Verify call_error was emitted
      const callError = await callerPage.evaluate(() => (window as any).__callError);
      expect(callError).toBeTruthy();

      await callerPage.unrouteAll({behavior: 'ignoreErrors'});
    });

    test('CALL-026: Keepalive 500 with retry - transient failure then recovery', async ({
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

      await establishCall(callerPage, calleePage, calleeNumber);
      await disableAutoKeepalive(callerPage);

      // Track status request count
      let statusRequestCount = 0;
      await callerPage.route('**/calls/**/status', (route) => {
        statusRequestCount += 1;
        if (statusRequestCount === 1) {
          // First request: 500 with retry-after
          route.fulfill({
            status: 500,
            headers: {'retry-after': '2'},
            contentType: 'application/json',
            body: JSON.stringify({error: 'Internal Server Error'}),
          });
        } else {
          // Subsequent requests: let through to real backend
          route.continue();
        }
      });

      // Trigger the keepalive error flow
      await callerPage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];
        const activeCall = calls[0];
        activeCall.sessionTimer = setInterval(async () => {
          try {
            await activeCall.postStatus();
          } catch (err: unknown) {
            await activeCall.handleCallKeepaliveError(err);
          }
          // Clear after first trigger — retry logic handles the rest
          clearInterval(activeCall.sessionTimer);
        }, 500);
      });

      // Wait for retry (2s retry-after + buffer)
      await callerPage.waitForTimeout(5000);

      // Call should still be connected — retry succeeded
      const stillConnected = await callerPage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];

        return calls.some((c: any) => c.isConnected());
      });
      expect(stillConnected).toBe(true);

      // At least 2 requests should have been made (initial fail + retry)
      expect(statusRequestCount).toBeGreaterThanOrEqual(2);

      await callerPage.unrouteAll({behavior: 'ignoreErrors'});
      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-027: Keepalive max retries exhausted - all status POSTs fail', async ({browser}) => {
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
      await disableAutoKeepalive(callerPage);

      // Track how many status requests are made
      let statusRequestCount = 0;
      await callerPage.route('**/calls/**/status', (route) => {
        statusRequestCount += 1;
        route.fulfill({
          status: 500,
          headers: {'retry-after': '1'},
          contentType: 'application/json',
          body: JSON.stringify({error: 'Internal Server Error'}),
        });
      });

      // Listen for call_error events
      await callerPage.evaluate(() => {
        (window as any).__callErrors = [];
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];
        const activeCall = calls[0];
        activeCall.on('call_error', (err: any) => {
          (window as any).__callErrors.push(err);
        });
      });

      // Trigger the keepalive error flow
      await callerPage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];
        const activeCall = calls[0];
        activeCall.sessionTimer = setInterval(async () => {
          try {
            await activeCall.postStatus();
          } catch (err: unknown) {
            await activeCall.handleCallKeepaliveError(err);
          }
          // Clear after first trigger — retry logic chains subsequent attempts
          clearInterval(activeCall.sessionTimer);
        }, 500);
      });

      // Wait for all retries: initial + 4 retries × ~1s each + buffer
      // MAX_CALL_KEEPALIVE_RETRY_COUNT = 4, retry-after = 1s
      await callerPage.waitForTimeout(10000);

      // Should have made 5 requests total (1 initial + 4 retries)
      expect(statusRequestCount).toBeGreaterThanOrEqual(5);

      // call_error events should have been emitted for each failure
      const errorCount = await callerPage.evaluate(
        () => ((window as any).__callErrors as any[]).length
      );
      expect(errorCount).toBeGreaterThanOrEqual(1);

      // After max retries, the SDK silently stops keepalive but the call
      // remains in ESTABLISHED state (known behaviour — no automatic disconnect)
      const stillConnected = await callerPage.evaluate(() => {
        const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];

        return calls.some((c: any) => c.isConnected());
      });
      expect(stillConnected).toBe(true);

      await callerPage.unrouteAll({behavior: 'ignoreErrors'});
      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });
  });
}
