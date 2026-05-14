import {Browser, Page, TestInfo, expect, test} from '@playwright/test';
import {TestManager} from '../test-manager';
import {getPhoneNumber, isIntProject} from '../test-data';
import {
  navigateToCallingApp,
  setEnvironmentToInt,
  setServiceIndicator,
  setMobiusWebSocket,
} from '../utils/setup';
import {
  registerLine,
  verifyLineRegistered,
  unregisterLine,
  isLineRegistered,
  getActiveMobiusUrl,
  getDeviceInfo,
} from '../utils/registration';
import {
  cleanupActiveCalls,
  endCall,
  endIncomingCall,
  establishCall,
  getMediaStreams,
  holdCall,
  makeCall,
  rejectCall,
  waitForCallDisconnect,
  waitForIncomingCall,
} from '../utils/call';
import {CALLING_SELECTORS, AWAIT_TIMEOUT, REGISTRATION_TIMEOUT} from '../constants';
import {
  getDiscoveredMobiusWsUrls,
  isKnownWsUrl,
  isMobiusWsActive,
  MOBIUS_WS_MESSAGE,
  MobiusWsInterceptor,
} from '../utils/mobius-ws';

const setupMobiusWsSingleUser = async (
  browser: Browser,
  testInfo: TestInfo,
  interceptor = new MobiusWsInterceptor()
): Promise<{tm: TestManager; page: Page; interceptor: MobiusWsInterceptor}> => {
  const tm = new TestManager(testInfo.project.name);

  await tm.setupContext(browser, 0, {
    initSDK: true,
    service: 'calling',
    mobiusWss: true,
    beforeInit: (context) => interceptor.install(context),
  });

  return {tm, page: tm.page, interceptor};
};

const setupMobiusWsTwoParty = async (
  browser: Browser,
  testInfo: TestInfo,
  callerInterceptor = new MobiusWsInterceptor(),
  calleeInterceptor = new MobiusWsInterceptor()
): Promise<{
  tm: TestManager;
  callerPage: Page;
  calleePage: Page;
  callerInterceptor: MobiusWsInterceptor;
  calleeInterceptor: MobiusWsInterceptor;
  calleeNumber: string;
}> => {
  const tm = new TestManager(testInfo.project.name);

  await Promise.all([
    tm.setupContext(browser, 0, {
      initSDK: true,
      service: 'calling',
      mobiusWss: true,
      register: true,
      media: true,
      beforeInit: (context) => callerInterceptor.install(context),
    }),
    tm.setupContext(browser, 1, {
      initSDK: true,
      service: 'calling',
      mobiusWss: true,
      register: true,
      media: true,
      beforeInit: (context) => calleeInterceptor.install(context),
    }),
  ]);

  return {
    tm,
    callerPage: tm.getPage(tm.userSet.accounts[0]),
    calleePage: tm.getPage(tm.userSet.accounts[1]),
    callerInterceptor,
    calleeInterceptor,
    calleeNumber: getPhoneNumber(tm.userSet.accounts[1], tm.isInt),
  };
};

const getActiveCallCount = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const client = (window as any).callingClient;
    if (!client) return 0;

    return Object.values(client.getActiveCalls()).flat().length;
  });

const hasConnectedCall = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];

    return calls.some((call: any) => call.isConnected());
  });

const verifyActiveMobiusWsUrl = async (page: Page): Promise<void> => {
  const activeMobiusUrl = await getActiveMobiusUrl(page);
  const discovered = await getDiscoveredMobiusWsUrls(page);

  expect(isMobiusWsActive(activeMobiusUrl)).toBe(true);
  expect(isKnownWsUrl(activeMobiusUrl, [...discovered.primary, ...discovered.backup])).toBe(true);
};

const disableAutoKeepalive = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];
    const activeCall = calls[0];

    if (activeCall?.sessionTimer) {
      clearInterval(activeCall.sessionTimer);
      activeCall.sessionTimer = undefined;
    }
  });
};

const startFastKeepalive = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];
    const activeCall = calls[0];

    activeCall.sessionTimer = setInterval(async () => {
      try {
        await activeCall.postStatus();
      } catch (err: unknown) {
        await activeCall.handleCallKeepaliveError(err);
      }
    }, 500);
  });
};

const startOneShotKeepalive = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    const calls = Object.values((window as any).callingClient.getActiveCalls()).flat() as any[];
    const activeCall = calls[0];

    activeCall.sessionTimer = setInterval(async () => {
      try {
        await activeCall.postStatus();
      } catch (err: unknown) {
        await activeCall.handleCallKeepaliveError(err);
      }
      clearInterval(activeCall.sessionTimer);
    }, 500);
  });
};

export function mobiusWsTests() {
  test.describe('Mobius WS Tests', () => {
    test.describe('Registration Lifecycle', () => {
      test.describe.configure({mode: 'serial'});

      let tm: TestManager;
      let page: Page;
      let interceptor: MobiusWsInterceptor;

      test.beforeAll(async ({browser}, testInfo) => {
        interceptor = new MobiusWsInterceptor({
          onResponse: (frame) => {
            if (frame.subtype === MOBIUS_WS_MESSAGE.REGISTER && frame.statusCode === 200) {
              return {
                ...frame,
                data: {
                  ...(frame.data || {}),
                  keepaliveInterval: 5,
                },
              };
            }

            return undefined;
          },
        });
        const setup = await setupMobiusWsSingleUser(browser, testInfo, interceptor);
        tm = setup.tm;
        page = setup.page;

        await registerLine(page);
        await verifyLineRegistered(page);
      });

      test.afterAll(async () => {
        await tm?.cleanup();
      });

      test('MOBIUS-WS REG-001: Initial registration success', async () => {
        expect(interceptor.getRequestCount(MOBIUS_WS_MESSAGE.REGISTER)).toBe(1);

        const statusText = await page.locator(CALLING_SELECTORS.REGISTRATION_STATUS).textContent();
        expect(statusText).toMatch(/Registered, deviceId: .+/);
        expect(await isLineRegistered(page)).toBe(true);
        await verifyActiveMobiusWsUrl(page);

        const deviceInfo = await getDeviceInfo(page);
        expect(deviceInfo.device).toBeTruthy();
        expect(deviceInfo.device.deviceId).toBeTruthy();

        await expect(page.locator(CALLING_SELECTORS.REGISTER_BTN)).toBeDisabled({
          timeout: AWAIT_TIMEOUT,
        });
      });

      test('MOBIUS-WS REG-003: Keepalive requests are sent after registration', async () => {
        await expect
          .poll(() => interceptor.getRequestCount(MOBIUS_WS_MESSAGE.DEVICE_STATUS), {
            message: 'Expected at least one Mobius WSS keepalive request within 20s',
            timeout: 20000,
            intervals: [1000],
          })
          .toBeGreaterThan(0);

        expect(await isLineRegistered(page)).toBe(true);
      });

      test('MOBIUS-WS REG-008: Connection restoration re-registers when no active calls', async () => {
        test.setTimeout(240000);

        const initialRegCount = interceptor.getRequestCount(MOBIUS_WS_MESSAGE.REGISTER);
        const initialUnregisterCount = interceptor.getRequestCount(MOBIUS_WS_MESSAGE.UNREGISTER);
        const mobiusUrlBefore = await getActiveMobiusUrl(page);

        await tm.context.setOffline(true);
        await page.waitForTimeout(45000);
        await tm.context.setOffline(false);

        await expect
          .poll(() => interceptor.getRequestCount(MOBIUS_WS_MESSAGE.REGISTER), {
            message: 'Expected Mobius WSS re-registration after network restoration',
            timeout: 120000,
            intervals: [2000],
          })
          .toBeGreaterThan(initialRegCount);

        await expect
          .poll(() => isLineRegistered(page), {
            message: 'Expected SDK to report registered after WSS connection restoration',
            timeout: 60000,
            intervals: [2000],
          })
          .toBe(true);

        await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
          'Registered, deviceId:',
          {timeout: REGISTRATION_TIMEOUT}
        );

        expect(interceptor.getRequestCount(MOBIUS_WS_MESSAGE.UNREGISTER)).toBeGreaterThan(
          initialUnregisterCount
        );
        expect(await getActiveMobiusUrl(page)).toBe(mobiusUrlBefore);
      });

      test('MOBIUS-WS REG-010: Deregistration success and cleanup', async () => {
        await unregisterLine(page);

        await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
          'Unregistered',
          {timeout: REGISTRATION_TIMEOUT}
        );

        expect(interceptor.getRequestCount(MOBIUS_WS_MESSAGE.UNREGISTER)).toBeGreaterThanOrEqual(1);

        await expect(async () => {
          expect(await isLineRegistered(page)).toBe(false);
        }).toPass({timeout: AWAIT_TIMEOUT});

        await expect(page.locator(CALLING_SELECTORS.REGISTER_BTN)).toBeEnabled({
          timeout: AWAIT_TIMEOUT,
        });
        await expect(page.locator(CALLING_SELECTORS.UNREGISTER_BTN)).toBeDisabled({
          timeout: AWAIT_TIMEOUT,
        });
      });
    });

    test.describe('Failover And Failback', () => {
      test.describe.configure({mode: 'serial'});

      let tm: TestManager;
      let page: Page;
      let primaryWsUrls: string[] = [];
      let backupWsUrls: string[] = [];
      let phase: 'failover' | 'failback' | 'failback-429' = 'failover';
      let registrationAttempts = 0;
      let failbackRegistrationAttempts = 0;
      let failback429Attempts = 0;
      const FAILBACK_RETRY_AFTER_SECONDS = 5;
      const MAX_FAILURES = 6;

      const isRegisteredOnBackup = async (): Promise<boolean> =>
        isKnownWsUrl(await getActiveMobiusUrl(page), backupWsUrls);

      const ensureRegisteredOnBackup = async (): Promise<void> => {
        if (await isRegisteredOnBackup()) {
          expect(await isLineRegistered(page)).toBe(true);

          return;
        }

        await page.locator(CALLING_SELECTORS.REGISTER_BTN).click({timeout: AWAIT_TIMEOUT});

        await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
          'Registered, deviceId:',
          {timeout: 240000}
        );

        await expect
          .poll(isRegisteredOnBackup, {
            message: 'Expected active Mobius WSS URL to be a backup URL',
            timeout: AWAIT_TIMEOUT,
            intervals: [1000],
          })
          .toBe(true);

        expect(await isLineRegistered(page)).toBe(true);
      };

      test.beforeAll(async ({browser}, testInfo) => {
        const interceptor = new MobiusWsInterceptor({
          onRequest: (frame, context) => {
            if (frame.type !== MOBIUS_WS_MESSAGE.REGISTER) {
              return undefined;
            }

            registrationAttempts += 1;

            if (phase === 'failover' && registrationAttempts <= MAX_FAILURES) {
              return {
                statusCode: 503,
                statusMessage: 'Service Unavailable',
                data: {message: 'Service Unavailable'},
              };
            }

            if (phase === 'failback-429') {
              if (isKnownWsUrl(context.url, primaryWsUrls)) {
                failback429Attempts += 1;

                return {
                  statusCode: 429,
                  statusMessage: 'Too Many Requests',
                  metadata: {'retry-after': String(FAILBACK_RETRY_AFTER_SECONDS)},
                  data: {message: 'Too Many Requests'},
                };
              }

              return undefined;
            }

            if (phase === 'failback') {
              failbackRegistrationAttempts += 1;
            }

            return undefined;
          },
        });
        const setup = await setupMobiusWsSingleUser(browser, testInfo, interceptor);
        tm = setup.tm;
        page = setup.page;

        const discovered = await getDiscoveredMobiusWsUrls(page);
        primaryWsUrls = discovered.primary;
        backupWsUrls = discovered.backup;
      });

      test.afterAll(async () => {
        await tm?.cleanup();
      });

      test.skip('MOBIUS-WS REG-006: Primary-to-backup failover on repeated failure', async () => {
        test.setTimeout(300000);

        await ensureRegisteredOnBackup();

        expect(registrationAttempts).toBeGreaterThan(MAX_FAILURES);
        expect(await isLineRegistered(page)).toBe(true);
        expect(isKnownWsUrl(await getActiveMobiusUrl(page), backupWsUrls)).toBe(true);
      });

      test.skip('MOBIUS-WS REG-017: 429 during failback exhausts retry budget', async () => {
        test.setTimeout(300000);

        await ensureRegisteredOnBackup();

        phase = 'failback-429';
        failback429Attempts = 0;

        await page.evaluate(() => {
          const reg = (Object.values((window as any).callingClient.getLines())[0] as any)
            .registration;
          reg.clearFailbackTimer();
          reg.failbackTimer = undefined;
          reg.scheduled429Retry = false;
          reg.failback429RetryAttempts = 0;
          reg.rehomingIntervalMin = 0.08;
          reg.rehomingIntervalMax = 0.08;
          reg.initiateFailback();
        });

        await expect
          .poll(
            () =>
              page.evaluate(
                () =>
                  (Object.values((window as any).callingClient.getLines())[0] as any).registration
                    .failback429RetryAttempts
              ),
            {
              message: 'Expected failback429RetryAttempts to reach 5 over WSS',
              timeout: 240000,
              intervals: [3000],
            }
          )
          .toBeGreaterThanOrEqual(5);

        expect(failback429Attempts).toBeGreaterThanOrEqual(5);
        expect(isKnownWsUrl(await getActiveMobiusUrl(page), backupWsUrls)).toBe(true);
        await expect
          .poll(() => isLineRegistered(page), {
            message: 'Line should remain registered on backup after WSS failback 429 exhaustion',
            timeout: AWAIT_TIMEOUT,
            intervals: [1000],
          })
          .toBe(true);

        await page.evaluate(() => {
          const reg = (Object.values((window as any).callingClient.getLines())[0] as any)
            .registration;
          reg.clearFailbackTimer();
          reg.failbackTimer = undefined;
          reg.scheduled429Retry = false;
          reg.failback429RetryAttempts = 0;
        });
      });

      test.skip('MOBIUS-WS REG-007: Fallback to primary from backup', async () => {
        test.setTimeout(300000);

        await ensureRegisteredOnBackup();

        phase = 'failback';

        await page.evaluate(() => {
          const reg = (Object.values((window as any).callingClient.getLines())[0] as any)
            .registration;
          reg.clearFailbackTimer();
          reg.rehomingIntervalMin = 0.08;
          reg.rehomingIntervalMax = 0.08;
          reg.initiateFailback();
        });

        await expect
          .poll(() => failbackRegistrationAttempts, {
            message: 'Expected WSS failback registration attempt to primary',
            timeout: 90000,
            intervals: [2000],
          })
          .toBeGreaterThan(0);

        await expect
          .poll(() => isLineRegistered(page), {
            message: 'Expected SDK to report registered after WSS failback',
            timeout: 60000,
            intervals: [2000],
          })
          .toBe(true);

        await expect(page.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
          'Registered, deviceId:',
          {timeout: REGISTRATION_TIMEOUT}
        );

        expect(isKnownWsUrl(await getActiveMobiusUrl(page), primaryWsUrls)).toBe(true);
      });
    });

    test.describe('Invalid Token', () => {
      test('MOBIUS-WS REG-011: Registration fails with invalid token', async ({
        page,
        context,
      }, testInfo) => {
        const isInt = isIntProject(testInfo.project.name);
        let registrationPosts = 0;
        let registrationStatus = 0;
        const interceptor = new MobiusWsInterceptor({
          onRequest: (frame) => {
            if (frame.type === MOBIUS_WS_MESSAGE.AUTH) {
              return {statusCode: 200, statusMessage: 'OK'};
            }

            if (frame.type === MOBIUS_WS_MESSAGE.REGISTER) {
              registrationPosts += 1;
              registrationStatus = 401;

              return {
                statusCode: 401,
                statusMessage: 'Unauthorized',
                data: {message: 'Unauthorized'},
              };
            }

            return undefined;
          },
        });

        await interceptor.install(context);
        await navigateToCallingApp(page);
        if (isInt) await setEnvironmentToInt(page);
        await setMobiusWebSocket(page, true);
        await setServiceIndicator(page, 'calling');

        await page.locator(CALLING_SELECTORS.ACCESS_TOKEN_INPUT).fill('invalid-token-12345', {
          timeout: AWAIT_TIMEOUT,
        });
        await page
          .locator(CALLING_SELECTORS.INITIALIZE_CALLING_BTN)
          .click({timeout: AWAIT_TIMEOUT});

        await expect(page.locator(CALLING_SELECTORS.AUTH_STATUS)).toHaveText(
          'Saved access token!',
          {timeout: 30000}
        );

        const registerBtn = page.locator(CALLING_SELECTORS.REGISTER_BTN);
        const isEnabled = await registerBtn.isEnabled({timeout: 30000}).catch(() => false);

        if (isEnabled) {
          await registerBtn.click({timeout: AWAIT_TIMEOUT});
          await page.waitForTimeout(5000);
        }

        const lineRegistered = await page.evaluate(() => {
          const client = (window as any).callingClient;
          const line = client && (Object.values(client.getLines())[0] as any);

          return line?.registration?.isDeviceRegistered?.() === true;
        });

        expect(lineRegistered).toBe(false);
        if (registrationPosts > 0) {
          expect(registrationStatus).toBe(401);
        }

        const status = await page.locator(CALLING_SELECTORS.REGISTRATION_STATUS).textContent();
        expect(status).not.toMatch(/Registered, deviceId:/);
      });
    });

    test.describe('Core Call Lifecycle', () => {
      test.describe.configure({mode: 'serial', timeout: 180000});

      let tm: TestManager;
      let callerPage: Page;
      let calleePage: Page;
      let calleeNumber: string;
      let callerInterceptor: MobiusWsInterceptor;

      test.beforeAll(async ({browser}, testInfo) => {
        const setup = await setupMobiusWsTwoParty(browser, testInfo);
        tm = setup.tm;
        callerPage = setup.callerPage;
        calleePage = setup.calleePage;
        calleeNumber = setup.calleeNumber;
        callerInterceptor = setup.callerInterceptor;
      });

      test.afterEach(async () => {
        await Promise.all([cleanupActiveCalls(callerPage), cleanupActiveCalls(calleePage)]);
        if (!callerPage.isClosed()) {
          await callerPage.waitForTimeout(3000);
        }
      });

      test.afterAll(async () => {
        await tm?.cleanup();
      });

      test('MOBIUS-WS CALL-001: Outgoing call happy path', async () => {
        await establishCall(callerPage, calleePage, calleeNumber);

        expect(await hasConnectedCall(callerPage)).toBe(true);
        expect(await hasConnectedCall(calleePage)).toBe(true);
        expect(callerInterceptor.getRequestCount(MOBIUS_WS_MESSAGE.CALL_SETUP)).toBeGreaterThan(0);
        expect(callerInterceptor.getRequestCount(MOBIUS_WS_MESSAGE.CALL_MEDIA)).toBeGreaterThan(0);

        await endCall(callerPage);
        await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
      });

      test('MOBIUS-WS CALL-002: Incoming call answer flow', async () => {
        await establishCall(callerPage, calleePage, calleeNumber);

        await endIncomingCall(calleePage);
        await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
      });

      test('MOBIUS-WS CALL-003: Incoming call reject flow', async () => {
        await makeCall(callerPage, calleeNumber);
        await waitForIncomingCall(calleePage);
        await rejectCall(calleePage);

        await endCall(callerPage);
        await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
      });

      test('MOBIUS-WS CALL-016: Network flap with active call survives disruption', async () => {
        await establishCall(callerPage, calleePage, calleeNumber);

        await tm.getContext(tm.userSet.accounts[0]).setOffline(true);
        await callerPage.waitForTimeout(3000);
        await tm.getContext(tm.userSet.accounts[0]).setOffline(false);
        await callerPage.waitForTimeout(5000);

        expect(await hasConnectedCall(callerPage)).toBe(true);

        await endCall(callerPage);
        await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
      });
    });

    test.describe('Call Setup And Media Errors', () => {
      test('MOBIUS-WS CALL-011: Call setup failure leaves no stuck call', async ({
        browser,
      }, testInfo) => {
        const interceptor = new MobiusWsInterceptor({
          onRequest: (frame) => {
            if (frame.type === MOBIUS_WS_MESSAGE.CALL_SETUP) {
              return {
                statusCode: 503,
                statusMessage: 'Call setup failed',
                data: {message: 'Call setup failed'},
              };
            }

            return undefined;
          },
        });
        const {tm, page: testPage} = await setupMobiusWsSingleUser(browser, testInfo, interceptor);

        try {
          await registerLine(testPage);
          await verifyLineRegistered(testPage);
          await getMediaStreams(testPage);

          await testPage
            .locator(CALLING_SELECTORS.DESTINATION_INPUT)
            .fill('+15005550000', {timeout: AWAIT_TIMEOUT});
          await testPage.locator(CALLING_SELECTORS.MAKE_CALL_BTN).click({timeout: AWAIT_TIMEOUT});

          await expect
            .poll(() => getActiveCallCount(testPage), {
              message: 'Expected failed WSS call setup to clear active calls',
              timeout: 60000,
              intervals: [1000],
            })
            .toBe(0);
        } finally {
          await tm.cleanup();
        }
      });

      test('MOBIUS-WS CALL-013: ROAP media failure triggers call teardown', async ({
        browser,
      }, testInfo) => {
        const callerInterceptor = new MobiusWsInterceptor({
          onRequest: (frame) => {
            if (frame.type === MOBIUS_WS_MESSAGE.CALL_MEDIA) {
              return {
                statusCode: 500,
                statusMessage: 'Media negotiation failed',
                data: {error: 'Media negotiation failed'},
              };
            }

            return undefined;
          },
        });
        const {
          tm,
          callerPage: testCallerPage,
          calleeNumber: testCalleeNumber,
        } = await setupMobiusWsTwoParty(browser, testInfo, callerInterceptor);

        try {
          await makeCall(testCallerPage, testCalleeNumber);

          await expect
            .poll(() => getActiveCallCount(testCallerPage), {
              message: 'Expected failed WSS media negotiation to clear active calls',
              timeout: 30000,
              intervals: [1000],
            })
            .toBe(0);
        } finally {
          await tm.cleanup();
        }
      });
    });

    test.describe('Call Keepalive Errors', () => {
      test('MOBIUS-WS CALL-025: Keepalive 401 tears down call', async ({browser}, testInfo) => {
        let failStatus = false;
        const callerInterceptor = new MobiusWsInterceptor({
          onRequest: (frame) => {
            if (failStatus && frame.type === MOBIUS_WS_MESSAGE.CALL_STATUS) {
              return {
                statusCode: 401,
                statusMessage: 'Token expired',
                data: {message: 'Token expired'},
              };
            }

            return undefined;
          },
        });
        const {
          tm,
          callerPage: testCallerPage,
          calleePage: testCalleePage,
          calleeNumber: testCalleeNumber,
        } = await setupMobiusWsTwoParty(browser, testInfo, callerInterceptor);

        try {
          await establishCall(testCallerPage, testCalleePage, testCalleeNumber);
          await disableAutoKeepalive(testCallerPage);

          await testCallerPage.evaluate(() => {
            (window as any).__callError = null;
            const calls = Object.values(
              (window as any).callingClient.getActiveCalls()
            ).flat() as any[];
            calls[0].on('call_error', (err: any) => {
              (window as any).__callError = err;
            });
          });

          failStatus = true;
          await startFastKeepalive(testCallerPage);

          await waitForCallDisconnect(testCallerPage, 30000);

          const callError = await testCallerPage.evaluate(() => (window as any).__callError);
          expect(callError).toBeTruthy();
        } finally {
          await tm.cleanup();
        }
      });

      test('MOBIUS-WS CALL-026: Keepalive 500 retries then recovers', async ({
        browser,
      }, testInfo) => {
        let interceptStatus = false;
        let statusRequestCount = 0;
        const callerInterceptor = new MobiusWsInterceptor({
          onRequest: (frame) => {
            if (interceptStatus && frame.type === MOBIUS_WS_MESSAGE.CALL_STATUS) {
              statusRequestCount += 1;

              if (statusRequestCount === 1) {
                return {
                  statusCode: 500,
                  statusMessage: 'Internal Server Error',
                  metadata: {'retry-after': '2'},
                  data: {error: 'Internal Server Error'},
                };
              }
            }

            return undefined;
          },
        });
        const {
          tm,
          callerPage: testCallerPage,
          calleePage: testCalleePage,
          calleeNumber: testCalleeNumber,
        } = await setupMobiusWsTwoParty(browser, testInfo, callerInterceptor);

        try {
          await establishCall(testCallerPage, testCalleePage, testCalleeNumber);
          await disableAutoKeepalive(testCallerPage);

          interceptStatus = true;
          await startOneShotKeepalive(testCallerPage);

          await testCallerPage.waitForTimeout(5000);

          expect(await hasConnectedCall(testCallerPage)).toBe(true);
          expect(statusRequestCount).toBeGreaterThanOrEqual(2);

          await endCall(testCallerPage);
          await Promise.all([
            waitForCallDisconnect(testCallerPage),
            waitForCallDisconnect(testCalleePage),
          ]);
        } finally {
          await tm.cleanup();
        }
      });

      test('MOBIUS-WS CALL-027: Keepalive max retries exhausted', async ({browser}, testInfo) => {
        let failStatus = false;
        let statusRequestCount = 0;
        const callerInterceptor = new MobiusWsInterceptor({
          onRequest: (frame) => {
            if (failStatus && frame.type === MOBIUS_WS_MESSAGE.CALL_STATUS) {
              statusRequestCount += 1;

              return {
                statusCode: 500,
                statusMessage: 'Internal Server Error',
                metadata: {'retry-after': '1'},
                data: {error: 'Internal Server Error'},
              };
            }

            return undefined;
          },
        });
        const {
          tm,
          callerPage: testCallerPage,
          calleePage: testCalleePage,
          calleeNumber: testCalleeNumber,
        } = await setupMobiusWsTwoParty(browser, testInfo, callerInterceptor);

        try {
          await establishCall(testCallerPage, testCalleePage, testCalleeNumber);
          await disableAutoKeepalive(testCallerPage);

          await testCallerPage.evaluate(() => {
            (window as any).__callErrors = [];
            const calls = Object.values(
              (window as any).callingClient.getActiveCalls()
            ).flat() as any[];
            calls[0].on('call_error', (err: any) => {
              (window as any).__callErrors.push(err);
            });
          });

          failStatus = true;
          await startOneShotKeepalive(testCallerPage);
          await testCallerPage.waitForTimeout(10000);

          expect(statusRequestCount).toBeGreaterThanOrEqual(5);
          const errorCount = await testCallerPage.evaluate(
            () => ((window as any).__callErrors as any[]).length
          );
          expect(errorCount).toBeGreaterThanOrEqual(1);
          expect(await hasConnectedCall(testCallerPage)).toBe(true);

          await endCall(testCallerPage);
          await Promise.all([
            waitForCallDisconnect(testCallerPage),
            waitForCallDisconnect(testCalleePage),
          ]);
        } finally {
          await tm.cleanup();
        }
      });
    });

    test.describe('Hold And Resume Errors', () => {
      test('MOBIUS-WS CALL-007: Resume API failure emits resume_error', async ({
        browser,
      }, testInfo) => {
        let failResume = false;
        const callerInterceptor = new MobiusWsInterceptor({
          onRequest: (frame) => {
            if (failResume && frame.type === MOBIUS_WS_MESSAGE.CALL_RESUME) {
              return {
                statusCode: 500,
                statusMessage: 'Internal Server Error',
                data: {error: 'Internal Server Error'},
              };
            }

            return undefined;
          },
        });
        const {
          tm,
          callerPage: testCallerPage,
          calleePage: testCalleePage,
          calleeNumber: testCalleeNumber,
        } = await setupMobiusWsTwoParty(browser, testInfo, callerInterceptor);

        try {
          await establishCall(testCallerPage, testCalleePage, testCalleeNumber);
          await holdCall(testCallerPage);

          await testCallerPage.evaluate(() => {
            (window as any).__resumeError = null;
            const calls = (window as any).callingClient.getActiveCalls();
            const activeCall = Object.values(calls).flat()[0] as any;
            activeCall.on('resume_error', (err: any) => {
              (window as any).__resumeError = err;
            });
          });

          failResume = true;
          await testCallerPage.locator(CALLING_SELECTORS.HOLD_BTN).click({timeout: AWAIT_TIMEOUT});

          await testCallerPage.waitForFunction(() => (window as any).__resumeError !== null, {
            timeout: 15000,
          });
          expect(await testCallerPage.evaluate(() => (window as any).__resumeError)).toBeTruthy();
          await expect(testCallerPage.locator(CALLING_SELECTORS.HOLD_BTN)).toHaveValue('Resume');
        } finally {
          await tm.cleanup();
        }
      });

      test('MOBIUS-WS CALL-006: Hold API failure emits hold_error', async ({browser}, testInfo) => {
        let failHold = false;
        const callerInterceptor = new MobiusWsInterceptor({
          onRequest: (frame) => {
            if (failHold && frame.type === MOBIUS_WS_MESSAGE.CALL_HOLD) {
              return {
                statusCode: 500,
                statusMessage: 'Internal Server Error',
                data: {error: 'Internal Server Error'},
              };
            }

            return undefined;
          },
        });
        const {
          tm,
          callerPage: testCallerPage,
          calleePage: testCalleePage,
          calleeNumber: testCalleeNumber,
        } = await setupMobiusWsTwoParty(browser, testInfo, callerInterceptor);

        try {
          await establishCall(testCallerPage, testCalleePage, testCalleeNumber);

          await testCallerPage.evaluate(() => {
            (window as any).__holdError = null;
            const calls = (window as any).callingClient.getActiveCalls();
            const activeCall = Object.values(calls).flat()[0] as any;
            activeCall.on('hold_error', (err: any) => {
              (window as any).__holdError = err;
            });
          });

          failHold = true;
          await testCallerPage.locator(CALLING_SELECTORS.HOLD_BTN).click({timeout: AWAIT_TIMEOUT});

          await testCallerPage.waitForFunction(() => (window as any).__holdError !== null, {
            timeout: 15000,
          });
          expect(await testCallerPage.evaluate(() => (window as any).__holdError)).toBeTruthy();
          await expect(testCallerPage.locator(CALLING_SELECTORS.HOLD_BTN)).toHaveValue('Hold');
        } finally {
          await tm.cleanup();
        }
      });
    });

    test.describe('Registration Keepalive And Retry', () => {
      test('MOBIUS-WS REG-004: Keepalive 404 triggers re-registration', async ({
        browser,
      }, testInfo) => {
        test.setTimeout(180000);

        let failKeepalive = false;
        let postReRegKeepaliveCount = 0;
        let trackPostReRegKeepalive = false;
        const interceptor = new MobiusWsInterceptor({
          onRequest: (frame) => {
            if (frame.type === MOBIUS_WS_MESSAGE.DEVICE_STATUS) {
              if (failKeepalive) {
                return {
                  statusCode: 404,
                  statusMessage: 'Device not found',
                  data: {message: 'Device not found'},
                };
              }

              if (trackPostReRegKeepalive) {
                postReRegKeepaliveCount += 1;
              }
            }

            return undefined;
          },
          onResponse: (frame) => {
            if (frame.subtype === MOBIUS_WS_MESSAGE.REGISTER && frame.statusCode === 200) {
              return {...frame, data: {...(frame.data || {}), keepaliveInterval: 5}};
            }

            return undefined;
          },
        });
        const {tm, page: testPage} = await setupMobiusWsSingleUser(browser, testInfo, interceptor);

        try {
          await registerLine(testPage);
          await verifyLineRegistered(testPage);

          const initialRegCount = interceptor.getRequestCount(MOBIUS_WS_MESSAGE.REGISTER);
          failKeepalive = true;

          await expect
            .poll(() => interceptor.getRequestCount(MOBIUS_WS_MESSAGE.REGISTER), {
              message: 'Expected WSS re-registration after keepalive 404',
              timeout: 90000,
              intervals: [2000],
            })
            .toBeGreaterThan(initialRegCount);

          failKeepalive = false;
          trackPostReRegKeepalive = true;

          await expect
            .poll(() => isLineRegistered(testPage), {
              message: 'Expected SDK to report registered after WSS re-registration',
              timeout: 60000,
              intervals: [2000],
            })
            .toBe(true);

          await expect(testPage.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
            'Registered, deviceId:',
            {timeout: REGISTRATION_TIMEOUT}
          );

          await expect
            .poll(() => postReRegKeepaliveCount, {
              message: 'Expected WSS keepalive to resume after re-registration',
              timeout: 20000,
              intervals: [1000],
            })
            .toBeGreaterThan(0);
        } finally {
          await tm.cleanup();
        }
      });

      test('MOBIUS-WS REG-005: 429 Retry-After is honored on keepalive', async ({
        browser,
      }, testInfo) => {
        test.setTimeout(180000);

        const RETRY_AFTER_SECONDS = 10;
        let firstKeepaliveTime = 0;
        let resumedKeepaliveTime = 0;
        const interceptor = new MobiusWsInterceptor({
          onRequest: (frame, context) => {
            if (frame.type === MOBIUS_WS_MESSAGE.DEVICE_STATUS) {
              if (context.requestCount === 1) {
                firstKeepaliveTime = Date.now();

                return {
                  statusCode: 429,
                  statusMessage: 'Too Many Requests',
                  metadata: {'retry-after': String(RETRY_AFTER_SECONDS)},
                  data: {message: 'Too Many Requests'},
                };
              }

              if (resumedKeepaliveTime === 0) {
                resumedKeepaliveTime = Date.now();
              }
            }

            return undefined;
          },
          onResponse: (frame) => {
            if (frame.subtype === MOBIUS_WS_MESSAGE.REGISTER && frame.statusCode === 200) {
              return {...frame, data: {...(frame.data || {}), keepaliveInterval: 5}};
            }

            return undefined;
          },
        });
        const {tm, page: testPage} = await setupMobiusWsSingleUser(browser, testInfo, interceptor);

        try {
          await registerLine(testPage);
          await verifyLineRegistered(testPage);

          await expect
            .poll(() => interceptor.getRequestCount(MOBIUS_WS_MESSAGE.DEVICE_STATUS), {
              message: 'Expected WSS keepalive to resume after 429 Retry-After delay',
              timeout: 60000,
              intervals: [1000],
            })
            .toBeGreaterThanOrEqual(2);

          if (firstKeepaliveTime > 0 && resumedKeepaliveTime > 0) {
            const gap = resumedKeepaliveTime - firstKeepaliveTime;
            expect(gap).toBeGreaterThanOrEqual((RETRY_AFTER_SECONDS - 1) * 1000);
          }

          expect(await isLineRegistered(testPage)).toBe(true);
        } finally {
          await tm.cleanup();
        }
      });

      test('MOBIUS-WS REG-015: 429 on initial registration honors Retry-After', async ({
        browser,
      }, testInfo) => {
        test.setTimeout(300000);

        const RETRY_AFTER_SECONDS = 10;
        const MAX_429_RESPONSES = 2;
        const attemptTimestamps: number[] = [];
        const interceptor = new MobiusWsInterceptor({
          onRequest: (frame, context) => {
            if (frame.type === MOBIUS_WS_MESSAGE.REGISTER) {
              attemptTimestamps.push(Date.now());

              if (context.requestCount <= MAX_429_RESPONSES) {
                return {
                  statusCode: 429,
                  statusMessage: 'Too Many Requests',
                  metadata: {'retry-after': String(RETRY_AFTER_SECONDS)},
                  data: {message: 'Too Many Requests'},
                };
              }
            }

            return undefined;
          },
        });
        const {tm, page: testPage} = await setupMobiusWsSingleUser(browser, testInfo, interceptor);

        try {
          await testPage.locator(CALLING_SELECTORS.REGISTER_BTN).click({timeout: AWAIT_TIMEOUT});

          await expect(testPage.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
            'Registered, deviceId:',
            {timeout: 240000}
          );

          expect(interceptor.getRequestCount(MOBIUS_WS_MESSAGE.REGISTER)).toBeGreaterThan(
            MAX_429_RESPONSES
          );
          expect(await isLineRegistered(testPage)).toBe(true);

          if (attemptTimestamps.length > MAX_429_RESPONSES) {
            const last429Time = attemptTimestamps[MAX_429_RESPONSES - 1];
            const firstSuccessAttemptTime = attemptTimestamps[MAX_429_RESPONSES];
            const gap = firstSuccessAttemptTime - last429Time;

            expect(gap).toBeGreaterThanOrEqual((RETRY_AFTER_SECONDS - 2) * 1000);
          }
        } finally {
          await tm.cleanup();
        }
      });

      test('MOBIUS-WS REG-016: 429 with high Retry-After triggers backup failover', async ({
        browser,
      }, testInfo) => {
        test.setTimeout(300000);

        const HIGH_RETRY_AFTER = 120;
        const testStartTime = Date.now();
        let primaryWsUrls: string[] = [];
        let backupWsUrls: string[] = [];
        let primaryAttempts = 0;
        let backupAttempts = 0;
        const interceptor = new MobiusWsInterceptor({
          onRequest: (frame, context) => {
            if (frame.type === MOBIUS_WS_MESSAGE.REGISTER) {
              if (isKnownWsUrl(context.url, primaryWsUrls)) {
                primaryAttempts += 1;

                return {
                  statusCode: 429,
                  statusMessage: 'Too Many Requests',
                  metadata: {'retry-after': String(HIGH_RETRY_AFTER)},
                  data: {message: 'Too Many Requests'},
                };
              }

              if (isKnownWsUrl(context.url, backupWsUrls)) {
                backupAttempts += 1;
              }
            }

            return undefined;
          },
        });
        const {tm, page: testPage} = await setupMobiusWsSingleUser(browser, testInfo, interceptor);

        try {
          const discovered = await getDiscoveredMobiusWsUrls(testPage);
          primaryWsUrls = discovered.primary;
          backupWsUrls = discovered.backup;

          await testPage.locator(CALLING_SELECTORS.REGISTER_BTN).click({timeout: AWAIT_TIMEOUT});

          await expect(testPage.locator(CALLING_SELECTORS.REGISTRATION_STATUS)).toContainText(
            'Registered, deviceId:',
            {timeout: 240000}
          );

          expect(primaryAttempts).toBeGreaterThanOrEqual(1);
          expect(backupAttempts).toBeGreaterThanOrEqual(1);
          expect(await isLineRegistered(testPage)).toBe(true);
          expect(isKnownWsUrl(await getActiveMobiusUrl(testPage), backupWsUrls)).toBe(true);

          const elapsed = Date.now() - testStartTime;
          expect(elapsed).toBeLessThan(HIGH_RETRY_AFTER * 1000);
        } finally {
          await tm.cleanup();
        }
      });
    });
  });
}
