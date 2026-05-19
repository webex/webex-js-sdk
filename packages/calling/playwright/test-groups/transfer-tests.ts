import {test, expect} from '@playwright/test';
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
  waitForCallEstablished,
  establishCall,
  cleanupActiveCalls,
  waitForTransferCommitReady,
  completeConsultTransfer,
} from '../utils/call';
import {settleUi, setupThreeUserGroup} from '../utils/three-user-group';
import {
  CALLING_SELECTORS,
  AWAIT_TIMEOUT,
  POST_ACTION_SETTLE_MS,
  TRANSFER_SUITE_TIMEOUT,
} from '../constants';

export function transferTests() {
  test.describe('Transfer - Blind', () => {
    test.describe.configure({mode: 'serial', timeout: TRANSFER_SUITE_TIMEOUT});

    const group = setupThreeUserGroup();

    test.beforeEach(async ({browser}, testInfo) => {
      await group.setup(browser, testInfo.project.name);
    });

    test.afterEach(async () => {
      await group.teardown();
    });

    test('TRANSFER-001: Blind transfer completion - caller transfers call to third party', async () => {
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
      await answerCall(transferPage);
      await settleUi(callerPage, calleePage, transferPage);

      // Caller leaves; the surviving leg is callee <-> transfer target.
      await waitForCallDisconnect(callerPage, 30000);
      await expect(callerPage.locator(CALLING_SELECTORS.TRANSFER_STATUS)).toContainText(
        'Transferred Successfully',
        {timeout: AWAIT_TIMEOUT}
      );
      await expect(callerPage.locator(CALLING_SELECTORS.END_CALL_BTN)).toBeDisabled();
      await expect(callerPage.locator(CALLING_SELECTORS.MAKE_CALL_BTN)).toBeEnabled();
      await expect(calleePage.locator(CALLING_SELECTORS.END_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
      await expect(transferPage.locator(CALLING_SELECTORS.END_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });

      await Promise.all([cleanupActiveCalls(calleePage), cleanupActiveCalls(transferPage)]);
      await Promise.all([waitForCallDisconnect(calleePage), waitForCallDisconnect(transferPage)]);
    });

    test('TRANSFER-002: Hold then blind transfer - callee holds, caller transfers to third party', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);
      const transferPage = group.tm.getPage(group.tm.userSet.accounts[2]);

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

      await transferPage.bringToFront();
      const incomingReady = waitForIncomingCall(transferPage);
      await callerPage.bringToFront();
      await callerPage.locator(CALLING_SELECTORS.TRANSFER_BTN).click({timeout: AWAIT_TIMEOUT});
      await transferPage.bringToFront();
      await incomingReady;
      await answerCall(transferPage);
      await settleUi(callerPage, calleePage, transferPage);

      await waitForCallDisconnect(callerPage, 30000);
      await expect(callerPage.locator(CALLING_SELECTORS.TRANSFER_STATUS)).toContainText(
        'Transferred Successfully',
        {timeout: AWAIT_TIMEOUT}
      );
      await expect(callerPage.locator(CALLING_SELECTORS.END_CALL_BTN)).toBeDisabled();
      await expect(callerPage.locator(CALLING_SELECTORS.MAKE_CALL_BTN)).toBeEnabled();
      await expect(calleePage.locator(CALLING_SELECTORS.END_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
      await expect(transferPage.locator(CALLING_SELECTORS.END_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });

      await Promise.all([cleanupActiveCalls(calleePage), cleanupActiveCalls(transferPage)]);
      await Promise.all([waitForCallDisconnect(calleePage), waitForCallDisconnect(transferPage)]);
    });

    test('TRANSFER-003: Blind transfer rejection - caller disconnects regardless of target rejection', async () => {
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

      // Per SDK behavior, blind transfer commit drops the caller leg immediately —
      // the caller doesn't wait for the target's accept/reject decision.
      await waitForCallDisconnect(callerPage, 30000);

      await transferPage.bringToFront();
      await incomingReady;
      await rejectCall(transferPage);
      await waitForCallDisconnect(transferPage);
      await settleUi(calleePage, transferPage);

      // Callee has no remote party once caller is gone and target rejected —
      // tear down the orphaned leg so the next test starts clean.
      await endIncomingCall(calleePage);
      await waitForCallDisconnect(calleePage);
    });
  });

  test.describe('Transfer - Consult', () => {
    test.describe.configure({mode: 'serial', timeout: TRANSFER_SUITE_TIMEOUT});

    const group = setupThreeUserGroup();

    test.beforeEach(async ({browser}, testInfo) => {
      await group.setup(browser, testInfo.project.name);
    });

    test.afterEach(async () => {
      await group.teardown();
    });

    test('TRANSFER-004: Consult transfer - caller consults then commits transfer to third party', async () => {
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

    test('TRANSFER-005: Consult transfer rejection - target rejects, caller resumes original call', async () => {
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

    test('TRANSFER-006: Held callee drops before consult commit - caller returns to single consult leg', async () => {
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

      // Held callee disconnects before the caller commits the transfer.
      await cleanupActiveCalls(calleePage);
      await waitForCallDisconnect(calleePage);
      await settleUi(callerPage, transferPage);

      // Consult leg with transfer target should still be active; tear it down.
      await expect(callerPage.locator(CALLING_SELECTORS.END_SECOND_CALL_BTN)).toBeEnabled({
        timeout: AWAIT_TIMEOUT,
      });
      await callerPage
        .locator(CALLING_SELECTORS.END_SECOND_CALL_BTN)
        .click({timeout: AWAIT_TIMEOUT});
      await callerPage.waitForTimeout(POST_ACTION_SETTLE_MS);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(transferPage)]);
    });

    test('TRANSFER-007: Consult swap - caller toggles between held callee and consulted target', async () => {
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

      // Park the consult leg, resume the original held callee.
      await holdCall(callerPage);
      await settleUi(callerPage, calleePage, transferPage);
      await expect(callerPage.locator(CALLING_SELECTORS.HOLD_BTN)).toHaveValue('Resume', {
        timeout: AWAIT_TIMEOUT,
      });
      await resumeCall(callerPage);
      await settleUi(callerPage, calleePage, transferPage);
      await expect(callerPage.locator(CALLING_SELECTORS.HOLD_BTN)).toHaveValue('Hold', {
        timeout: AWAIT_TIMEOUT,
      });

      // Swap back to the consult leg.
      await holdCall(callerPage);
      await settleUi(callerPage, calleePage, transferPage);
      await expect(callerPage.locator(CALLING_SELECTORS.HOLD_BTN)).toHaveValue('Resume', {
        timeout: AWAIT_TIMEOUT,
      });
      await resumeCall(callerPage);
      await settleUi(callerPage, calleePage, transferPage);
      await expect(callerPage.locator(CALLING_SELECTORS.HOLD_BTN)).toHaveValue('Hold', {
        timeout: AWAIT_TIMEOUT,
      });

      // End the consult leg, then the original call to clear all parties.
      await callerPage
        .locator(CALLING_SELECTORS.END_SECOND_CALL_BTN)
        .click({timeout: AWAIT_TIMEOUT});
      await waitForCallDisconnect(transferPage);
      await endCall(callerPage);
      await Promise.all([waitForCallDisconnect(callerPage), waitForCallDisconnect(calleePage)]);
    });
  });

  test.describe('Call - Call Waiting', () => {
    test.describe.configure({mode: 'serial', timeout: TRANSFER_SUITE_TIMEOUT});

    const group = setupThreeUserGroup();

    test.beforeEach(async ({browser}, testInfo) => {
      await group.setup(browser, testInfo.project.name);
    });

    test.afterEach(async () => {
      await group.teardown();
    });

    test('CALL-030: Remote busy handling - caller dials callee already active with third party', async () => {
      const callerPage = group.tm.getPage(group.tm.userSet.accounts[0]);
      const calleePage = group.tm.getPage(group.tm.userSet.accounts[1]);
      const transferPage = group.tm.getPage(group.tm.userSet.accounts[2]);

      // Occupy the callee first: transferPage and calleePage are in the active call.
      await establishCall(transferPage, calleePage, group.calleeNumber);
      await settleUi(transferPage, calleePage);

      // callerPage then dials the same callee; calleePage is the busy party.
      await makeCall(callerPage, group.calleeNumber);
      await callerPage.waitForTimeout(POST_ACTION_SETTLE_MS);

      await endCall(callerPage);
      await waitForCallDisconnect(callerPage, 30000);
      await Promise.all([waitForCallEstablished(transferPage), waitForCallEstablished(calleePage)]);
      await settleUi(callerPage, transferPage, calleePage);

      await endCall(transferPage);
      await Promise.all([waitForCallDisconnect(transferPage), waitForCallDisconnect(calleePage)]);
    });
  });
}
