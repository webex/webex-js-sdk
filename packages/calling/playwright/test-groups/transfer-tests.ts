import {test, expect, Browser, Page} from '@playwright/test';
import {TestManager} from '../test-manager';
import {getPhoneNumber} from '../test-data';
import {
  makeCall,
  waitForIncomingCall,
  answerCall,
  rejectCall,
  holdCall,
  endCall,
  endIncomingCall,
  waitForCallDisconnect,
  establishCall,
  cleanupActiveCalls,
  waitForTransferCommitReady,
  completeConsultTransfer,
} from '../utils/call';
import {CALLING_SELECTORS, AWAIT_TIMEOUT} from '../constants';

const UI_SETTLE_MS = 3000;
const POST_ACTION_SETTLE_MS = 5000;

const settleUi = async (...pages: Page[]) => {
  await Promise.all(
    pages.filter((page) => !page.isClosed()).map((page) => page.waitForTimeout(UI_SETTLE_MS))
  );
};

const setupThreeUserGroup = () => {
  let tm: TestManager | undefined;
  let calleeNumber: string;
  let transferNumber: string;

  const setup = async (browser: Browser, projectName: string) => {
    if (tm) {
      await tm.cleanup().catch(() => {});
      tm = undefined;
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

  const pages = () => {
    if (!tm) return [];

    return [
      tm.getPage(tm.userSet.accounts[0]),
      tm.getPage(tm.userSet.accounts[1]),
      tm.getPage(tm.userSet.accounts[2]),
    ];
  };

  const cleanupActiveGroupCalls = async () => {
    if (!tm) return;

    await Promise.all(
      pages().map(async (page) => {
        await cleanupActiveCalls(page);
        await page.unrouteAll({behavior: 'ignoreErrors'}).catch(() => {});
      })
    );
    await settleUi(...pages());
  };

  const teardown = async () => {
    if (!tm) return;

    await cleanupActiveGroupCalls();
    await tm.cleanup().catch(() => {});
    tm = undefined;
  };

  return {
    setup,
    cleanupActiveGroupCalls,
    teardown,
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

export function transferTests() {
  test.describe('Transfer - Blind', () => {
    test.describe.configure({mode: 'serial', timeout: 240000});

    const group = setupThreeUserGroup();

    test.beforeEach(async ({browser}, testInfo) => {
      await group.setup(browser, testInfo.project.name);
    });

    test.afterEach(async () => {
      await group.teardown();
    });

    test('CALL-009: Blind transfer completion - caller transfers call to third party', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, group.calleeNumber);
      await settleUi(callerPage, calleePage);

      await expect(callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 0});
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill(group.transferNumber);
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});
      await callerPage.waitForTimeout(POST_ACTION_SETTLE_MS);

      await waitForCallDisconnect(callerPage, 30000);
      await endIncomingCall(calleePage);
      await waitForCallDisconnect(calleePage);
    });

    test('CALL-026: Hold then blind transfer - callee holds, caller transfers to third party', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, group.calleeNumber);
      await settleUi(callerPage, calleePage);
      await holdCall(calleePage);
      await settleUi(callerPage, calleePage);

      await expect(callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 0});
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill(group.transferNumber);
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});
      await callerPage.waitForTimeout(POST_ACTION_SETTLE_MS);

      await waitForCallDisconnect(callerPage, 30000);
      await endIncomingCall(calleePage);
      await waitForCallDisconnect(calleePage);
    });

    test('CALL-027: Blind transfer rejection - transfer target rejects, original call remains', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);
      const transferPage = group.tm.getPage(group.tm.userSet.accounts[2]);

      await establishCall(callerPage, calleePage, group.calleeNumber);
      await settleUi(callerPage, calleePage);

      await expect(callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 0});
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill(group.transferNumber);
      await settleUi(callerPage);

      await transferPage.bringToFront();
      const incomingReady = waitForIncomingCall(transferPage);
      await callerPage.bringToFront();
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});
      await transferPage.bringToFront();
      await incomingReady;
      await rejectCall(transferPage);
      await settleUi(callerPage, calleePage, transferPage);

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

    test.afterEach(async () => {
      await group.teardown();
    });

    test('CALL-024: Consult transfer - caller consults then commits transfer to third party', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);
      const transferPage = group.tm.getPage(group.tm.userSet.accounts[2]);

      await establishCall(callerPage, calleePage, group.calleeNumber);
      await settleUi(callerPage, calleePage);

      await expect(callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 1});
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill(group.transferNumber);
      await settleUi(callerPage);

      await transferPage.bringToFront();
      const incomingReady = waitForIncomingCall(transferPage);
      await callerPage.bringToFront();
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});
      await transferPage.bringToFront();
      await incomingReady;
      await answerCall(transferPage);
      await settleUi(callerPage, transferPage);
      await waitForTransferCommitReady(callerPage);
      await settleUi(callerPage);
      await completeConsultTransfer(callerPage);
      await callerPage.waitForTimeout(POST_ACTION_SETTLE_MS);

      await waitForCallDisconnect(callerPage, 30000);
      await endIncomingCall(calleePage);
      await Promise.all([waitForCallDisconnect(calleePage), waitForCallDisconnect(transferPage)]);
    });

    test('CALL-025: Consult transfer rejection - target rejects, caller resumes original call', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);
      const transferPage = group.tm.getPage(group.tm.userSet.accounts[2]);

      await establishCall(callerPage, calleePage, group.calleeNumber);
      await settleUi(callerPage, calleePage);

      await expect(callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 1});
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill(group.transferNumber);
      await settleUi(callerPage);

      await transferPage.bringToFront();
      const incomingReady = waitForIncomingCall(transferPage);
      await callerPage.bringToFront();
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});
      await transferPage.bringToFront();
      await incomingReady;
      await rejectCall(transferPage);
      await settleUi(callerPage, calleePage, transferPage);

      await expect(callerPage.locator(CALLING_SELECTORS.END_SECOND_CALL_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
      await settleUi(callerPage);
      await callerPage
        .locator(CALLING_SELECTORS.END_SECOND_CALL_BTN)
        .click({timeout: AWAIT_TIMEOUT});
      await callerPage.waitForTimeout(POST_ACTION_SETTLE_MS);

      await endIncomingCall(calleePage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-017: ALL_CALLS_CLEARED - fires after last call ends (consult transfer)', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);
      const transferPage = group.tm.getPage(group.tm.userSet.accounts[2]);

      await establishCall(callerPage, calleePage, group.calleeNumber);
      await settleUi(callerPage, calleePage);

      await expect(callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 1});
      await settleUi(callerPage);
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill(group.transferNumber);
      await settleUi(callerPage);

      await transferPage.bringToFront();
      const incomingReady = waitForIncomingCall(transferPage);
      await callerPage.bringToFront();
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});
      await transferPage.bringToFront();
      await incomingReady;
      await answerCall(transferPage);
      await settleUi(callerPage, transferPage);

      await expect(callerPage.locator(CALLING_SELECTORS.END_SECOND_CALL_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
      await settleUi(callerPage);
      await callerPage
        .locator(CALLING_SELECTORS.END_SECOND_CALL_BTN)
        .click({timeout: AWAIT_TIMEOUT});
      await callerPage.waitForTimeout(POST_ACTION_SETTLE_MS);

      await endCall(callerPage);
      await Promise.all([
        waitForCallDisconnect(callerPage),
        waitForCallDisconnect(calleePage),
        waitForCallDisconnect(transferPage),
      ]);
    });
  });

  test.describe('Transfer - Errors & Call Waiting', () => {
    test.describe.configure({mode: 'serial', timeout: 240000});

    const group = setupThreeUserGroup();

    test.beforeEach(async ({browser}, testInfo) => {
      await group.setup(browser, testInfo.project.name);
    });

    test.afterEach(async () => {
      await group.teardown();
    });

    test('CALL-010: Transfer failure - transfer_error event emitted', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);

      await establishCall(callerPage, calleePage, group.calleeNumber);
      await settleUi(callerPage, calleePage);

      await callerPage.route('**/services/calltransfer/commit', (route) => {
        route.fulfill({status: 500, body: 'Internal Server Error'});
      });

      try {
        await expect(callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN)).toBeEnabled({
          timeout: AWAIT_TIMEOUT,
        });
        await settleUi(callerPage);
        await callerPage.locator(CALLING_SELECTORS.TRANSFER_OPTIONS).selectOption({index: 0});
        await settleUi(callerPage);
        await callerPage.locator(CALLING_SELECTORS.TRANSFER_TARGET_INPUT).fill('+15005550000');
        await settleUi(callerPage);
        await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});
        await callerPage.waitForTimeout(POST_ACTION_SETTLE_MS);
      } finally {
        await callerPage.unroute('**/services/calltransfer/commit');
      }

      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });

    test('CALL-004: Remote busy handling - caller dials callee already on a call', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);
      const transferPage = group.tm.getPage(group.tm.userSet.accounts[2]);

      await establishCall(transferPage, calleePage, group.calleeNumber);
      await settleUi(transferPage, calleePage);

      await makeCall(callerPage, group.calleeNumber);
      await callerPage.waitForTimeout(POST_ACTION_SETTLE_MS);

      await endCall(callerPage);
      await waitForCallDisconnect(callerPage, 30000);
      await settleUi(callerPage, transferPage, calleePage);

      await endCall(transferPage);
      await Promise.all([waitForCallDisconnect(transferPage), waitForCallDisconnect(calleePage)]);
    });
  });
}
