import {Browser, Page} from '@playwright/test';
import {TestManager} from '../test-manager';
import {getPhoneNumber} from '../test-data';
import {cleanupActiveCalls} from './call';
import {UI_SETTLE_MS} from '../constants';

/**
 * Pause execution for a brief, fixed window so the sample-app DOM and SDK
 * state can settle between successive actions. No-op for closed pages.
 */
export const settleUi = async (...pages: Page[]): Promise<void> => {
  await Promise.all(
    pages.filter((page) => !page.isClosed()).map((page) => page.waitForTimeout(UI_SETTLE_MS))
  );
};

/**
 * Build a per-describe harness that owns a 3-user TestManager (caller, callee,
 * transfer target) and exposes setup/teardown plus convenience accessors.
 *
 * Returns a getter for the underlying TestManager so individual tests see the
 * latest instance after `setup()` reassigns it in beforeEach.
 */
export const setupThreeUserGroup = () => {
  let tm: TestManager | undefined;
  let calleeNumber: string;
  let transferNumber: string;

  const setup = async (browser: Browser, projectName: string): Promise<void> => {
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

  const pages = (): Page[] => {
    if (!tm) return [];

    return [
      tm.getPage(tm.userSet.accounts[0]),
      tm.getPage(tm.userSet.accounts[1]),
      tm.getPage(tm.userSet.accounts[2]),
    ];
  };

  const cleanupActiveGroupCalls = async (): Promise<void> => {
    if (!tm) return;

    await Promise.all(
      pages().map(async (page) => {
        await cleanupActiveCalls(page);
        await page.unrouteAll({behavior: 'ignoreErrors'}).catch(() => {});
      })
    );
    await settleUi(...pages());
  };

  const teardown = async (): Promise<void> => {
    if (!tm) return;

    await cleanupActiveGroupCalls();
    await tm.cleanup().catch(() => {});
    tm = undefined;
  };

  return {
    setup,
    cleanupActiveGroupCalls,
    teardown,
    get tm(): TestManager {
      if (!tm) {
        throw new Error('TestManager not initialized. Call setup() first.');
      }

      return tm;
    },
    get calleeNumber(): string {
      return calleeNumber;
    },
    get transferNumber(): string {
      return transferNumber;
    },
  };
};

export type ThreeUserGroup = ReturnType<typeof setupThreeUserGroup>;
