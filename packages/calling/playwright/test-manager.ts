import {Page, BrowserContext, Browser} from '@playwright/test';
import {AccountRole, UserSet, getToken, getUserSet, isIntProject} from './test-data';
import {
  navigateToCallingApp,
  initializeCallingSDK,
  verifySDKInitialized,
  setServiceIndicator,
  setEnvironmentToInt,
} from './utils/setup';
import {registerLine, verifyLineRegistered} from './utils/registration';
import {ServiceIndicator} from './constants';

interface SetupConfig {
  /** Navigate to sample app and init SDK */
  initSDK?: boolean;
  /** Register the line after SDK init */
  register?: boolean;
  /** Service indicator to set before init (default: 'calling') */
  service?: ServiceIndicator;
}

interface ManagedContext {
  context: BrowserContext;
  page: Page;
  role: AccountRole;
}

/**
 * Manages browser contexts and pages for one or more accounts within a test.
 *
 * Resolves account roles from the Playwright project name (testInfo.project.name)
 * so that suites never need to hardcode role strings.
 *
 * Single-user usage (registration tests):
 *   const tm = new TestManager('SET_1');
 *   await tm.setupContext(browser, 0, {initSDK: true, register: true});
 *   // tm.page, tm.context ready — uses USER_1 account automatically
 *
 * Multi-user usage (call tests):
 *   const tm = new TestManager('SET_2USER');
 *   await Promise.all([
 *     tm.setupContext(browser, 0, {initSDK: true, register: true}),   // USER_1
 *     tm.setupContext(browser, 1, {initSDK: true, register: true}),   // USER_2
 *   ]);
 *   // tm.getPage('USER_1'), tm.getPage('USER_2') ready
 */
export class TestManager {
  public readonly projectName: string;
  public readonly userSet: UserSet;
  public readonly isInt: boolean;
  private contexts = new Map<AccountRole, ManagedContext>();

  constructor(projectName: string) {
    this.projectName = projectName;
    this.isInt = isIntProject(projectName);
    this.userSet = getUserSet(projectName);
  }

  /** The primary account role for this set (first in the accounts array) */
  get primaryRole(): AccountRole {
    return this.userSet.accounts[0];
  }

  /** Shortcut: page for the first (or only) account */
  get page(): Page {
    const first = this.contexts.values().next().value;
    if (!first) throw new Error('No contexts set up. Call setupContext first.');

    return first.page;
  }

  /** Shortcut: context for the first (or only) account */
  get context(): BrowserContext {
    const first = this.contexts.values().next().value;
    if (!first) throw new Error('No contexts set up. Call setupContext first.');

    return first.context;
  }

  getPage(role: AccountRole): Page {
    const mc = this.contexts.get(role);
    if (!mc) throw new Error(`No context for role ${role}. Call setupContext first.`);

    return mc.page;
  }

  getContext(role: AccountRole): BrowserContext {
    const mc = this.contexts.get(role);
    if (!mc) throw new Error(`No context for role ${role}. Call setupContext first.`);

    return mc.context;
  }

  /**
   * Create a browser context for an account in this set, optionally init SDK and register.
   *
   * @param accountIndex - Which account to use (index into userSet.accounts).
   */
  async setupContext(
    browser: Browser,
    accountIndex: number,
    config: SetupConfig = {}
  ): Promise<ManagedContext> {
    const role = this.userSet.accounts[accountIndex];
    if (!role) {
      throw new Error(
        `Account index ${accountIndex} out of range for set "${this.projectName}" ` +
          `(has ${this.userSet.accounts.length} accounts: ${this.userSet.accounts.join(', ')})`
      );
    }

    const context = await browser.newContext({ignoreHTTPSErrors: true});
    const page = await context.newPage();
    const mc: ManagedContext = {context, page, role};
    this.contexts.set(role, mc);

    if (config.initSDK) {
      await navigateToCallingApp(page);
      if (this.isInt) {
        await setEnvironmentToInt(page);
      }
      if (config.service) {
        await setServiceIndicator(page, config.service);
      }
      await initializeCallingSDK(page, getToken(role, this.isInt));
      await verifySDKInitialized(page);

      if (config.register) {
        await registerLine(page);
        await verifyLineRegistered(page);
      }
    }

    return mc;
  }

  /**
   * Close all managed contexts.
   */
  async cleanup(): Promise<void> {
    const closePromises = Array.from(this.contexts.values()).map((mc) =>
      mc.context.close().catch(() => {})
    );
    await Promise.all(closePromises);
    this.contexts.clear();
  }
}
