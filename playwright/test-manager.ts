/* eslint-disable import/no-extraneous-dependencies, class-methods-use-this, import/prefer-default-export */
import {Browser, BrowserContext, Page} from '@playwright/test';
import {BASE_URL, LOGIN_MODE} from './constants';
import {deregister, loginViaAccessToken, register} from './Utils/initUtils';
import {loginExtension} from './Utils/incomingTaskUtils';
import {stationLogout, telephonyLogin} from './Utils/stationLoginUtils';
import {navigateToContactCenter} from './Utils/helperUtils';

export class TestManager {
  public agent1Page!: Page;
  public agent1Context!: BrowserContext;

  public agent2Page?: Page;
  public agent2Context?: BrowserContext;

  public multiSessionAgent1Page?: Page;
  public multiSessionContext?: BrowserContext;

  public callerPage!: Page;
  public callerExtensionContext?: BrowserContext;

  public agent1ExtensionPage!: Page;
  public extensionContext?: BrowserContext;

  public dialNumberPage?: Page;
  public dialNumberContext?: BrowserContext;

  public consoleMessages: string[] = [];
  public readonly projectName: string;

  constructor(projectName: string) {
    this.projectName = projectName;
  }

  private getEnvTokens(): {
    agent1AccessToken: string;
    agent2AccessToken: string;
    agent1ExtensionNumber: string;
    entryPoint: string;
  } {
    return {
      agent1AccessToken: process.env[`${this.projectName}_AGENT1_ACCESS_TOKEN`] || '',
      agent2AccessToken: process.env[`${this.projectName}_AGENT2_ACCESS_TOKEN`] || '',
      agent1ExtensionNumber: process.env[`${this.projectName}_AGENT1_EXTENSION_NUMBER`] || '',
      entryPoint:
        process.env[`${this.projectName}_ENTRY_POINT`] || process.env.PW_ENTRY_POINT1 || '',
    };
  }

  private attachConsole(page: Page): void {
    page.on('console', (message) => this.consoleMessages.push(message.text()));
  }

  private async createContextAndPage(
    browser: Browser
  ): Promise<{context: BrowserContext; page: Page}> {
    const context = await browser.newContext({ignoreHTTPSErrors: true});
    const page = await context.newPage();
    await navigateToContactCenter(page, BASE_URL);

    return {context, page};
  }

  private async initContactCenterSession(page: Page, accessToken: string): Promise<void> {
    await loginViaAccessToken(page, accessToken);
    await register(page);
  }

  async basicSetup(browser: Browser): Promise<void> {
    const env = this.getEnvTokens();
    const {context, page} = await this.createContextAndPage(browser);

    this.agent1Context = context;
    this.agent1Page = page;
    this.attachConsole(this.agent1Page);

    await this.initContactCenterSession(this.agent1Page, env.agent1AccessToken);
  }

  async setupForStationLogin(browser: Browser): Promise<void> {
    await this.basicSetup(browser);
    await this.setupMultiSessionPage();
  }

  async setupForIncomingTaskDesktop(browser: Browser): Promise<void> {
    const env = this.getEnvTokens();

    await this.basicSetup(browser);
    await telephonyLogin(this.agent1Page, LOGIN_MODE.DESKTOP);

    const caller = await this.createContextAndPage(browser);
    this.callerExtensionContext = caller.context;
    this.callerPage = caller.page;
    await loginExtension(this.callerPage, env.agent2AccessToken);
  }

  async setupForIncomingTaskExtension(browser: Browser): Promise<void> {
    const env = this.getEnvTokens();

    await this.basicSetup(browser);
    await telephonyLogin(this.agent1Page, LOGIN_MODE.EXTENSION, env.agent1ExtensionNumber);

    const extension = await this.createContextAndPage(browser);
    this.extensionContext = extension.context;
    this.agent1ExtensionPage = extension.page;
    await loginExtension(this.agent1ExtensionPage, env.agent1AccessToken);

    const caller = await this.createContextAndPage(browser);
    this.callerExtensionContext = caller.context;
    this.callerPage = caller.page;
    await loginExtension(this.callerPage, env.agent2AccessToken);
  }

  async setupMultiSessionPage(): Promise<void> {
    const env = this.getEnvTokens();

    if (!this.agent1Context) {
      throw new Error('Agent1 context is not initialized');
    }

    if (!this.multiSessionAgent1Page) {
      this.multiSessionContext = this.agent1Context;
      this.multiSessionAgent1Page = await this.agent1Context.newPage();
      await navigateToContactCenter(this.multiSessionAgent1Page, BASE_URL);
      await this.initContactCenterSession(this.multiSessionAgent1Page, env.agent1AccessToken);
      this.attachConsole(this.multiSessionAgent1Page);
    }
  }

  private async cleanupPage(page: Page): Promise<void> {
    try {
      const endButton = page.locator('#end');
      if (await endButton.isEnabled().catch(() => false)) {
        await endButton.click().catch(() => {});
        await page.waitForTimeout(500);
      }

      const wrapupButton = page.locator('#wrapup');
      const wrapupSelect = page.locator('#wrapupCodesDropdown');
      const [isWrapupEnabled, isSelectEnabled] = await Promise.all([
        wrapupButton.isEnabled().catch(() => false),
        wrapupSelect.isEnabled().catch(() => false),
      ]);

      if (isWrapupEnabled && isSelectEnabled) {
        await wrapupSelect.selectOption({index: 0}).catch(() => {});
        await wrapupButton.click().catch(() => {});
      }

      await stationLogout(page, false).catch(() => {});
      await deregister(page).catch(() => {});
    } catch {
      // best-effort cleanup
    }
  }

  async cleanup(): Promise<void> {
    const pages: Array<Page | undefined> = [
      this.agent1Page,
      this.agent2Page,
      this.multiSessionAgent1Page,
      this.agent1ExtensionPage,
      this.callerPage,
      this.dialNumberPage,
    ];

    // Clean up pages sequentially - order matters for proper teardown
    // Each page cleanup must complete before the next starts
    /* eslint-disable no-await-in-loop */
    for (const page of pages) {
      if (page) {
        await this.cleanupPage(page);
      }
    }
    /* eslint-enable no-await-in-loop */

    const contexts: Array<BrowserContext | undefined> = [
      this.agent1Context,
      this.agent2Context,
      this.extensionContext,
      this.callerExtensionContext,
      this.dialNumberContext,
    ];

    // Close unique contexts in parallel
    const closed = new Set<BrowserContext>();
    const closePromises = contexts
      .filter((context): context is BrowserContext => Boolean(context) && !closed.has(context))
      .map((context) => {
        closed.add(context);

        return context.close().catch(() => {});
      });

    await Promise.all(closePromises);

    this.consoleMessages = [];
  }
}
