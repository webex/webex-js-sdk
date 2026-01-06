import {expect, Page, BrowserContext, Browser} from '@playwright/test';
import {enableAllWidgets, enableMultiLogin, initialiseWidgets, loginViaAccessToken} from './Utils/initUtils';
import {stationLogout, telephonyLogin} from './Utils/stationLoginUtils';
import {loginExtension} from './Utils/incomingTaskUtils';
import {setupConsoleLogging} from './Utils/taskControlUtils';
import {setupAdvancedConsoleLogging} from './Utils/advancedTaskControlUtils';
import {pageSetup, registerAgent} from './Utils/helperUtils';
import {
  LOGIN_MODE,
  LoginMode,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT,
  UI_SETTLE_TIMEOUT,
  AWAIT_TIMEOUT,
  PAGE_TYPES,
  PageType,
  CALL_URL,
} from './constants';

// Configuration interfaces for setup options
interface SetupConfig {
  // Core requirements
  needsAgent1?: boolean;
  needsAgent2?: boolean;
  needsCaller?: boolean;
  needsExtension?: boolean;
  needsChat?: boolean;
  needsMultiSession?: boolean;

  // Login modes
  agent1LoginMode?: LoginMode;

  // Console logging
  enableConsoleLogging?: boolean;
  enableAdvancedLogging?: boolean;
  needDialNumberLogin?: boolean;
}

// Environment variable helper interface
interface EnvTokens {
  agent1AccessToken: string;
  agent2AccessToken: string;
  agent1Username: string;
  agent2Username: string;
  agent1ExtensionNumber: string;
  password: string;
  dialNumberUsername?: string;
  dialNumberPassword?: string;
}

// Context creation result interface
interface ContextCreationResult {
  context: BrowserContext;
  page: Page;
  type: PageType;
}

// 🏗️ Simple Test Context Manager
export class TestManager {
  // Main widget page (Agent 1 login)
  public agent1Page!: Page;
  public agent1Context!: BrowserContext;

  // Multi-session page (Agent 1 second session)
  public multiSessionAgent1Page: Page;
  public multiSessionContext: BrowserContext;

  // Agent 2 main widget page (Agent 2 login)
  public agent2Page: Page;
  public agent2Context: BrowserContext;

  // Caller extension page (Agent 2 for making calls)
  public callerPage: Page;
  public callerExtensionContext: BrowserContext;

  // Extension page (Agent 1 extension login)
  public agent1ExtensionPage: Page;
  public extensionContext: BrowserContext;

  // Chat page
  public chatPage: Page;
  public chatContext: BrowserContext;

  // Dial Number page
  public dialNumberPage: Page;
  public dialNumberContext: BrowserContext;

  // Console messages collected from pages

  public consoleMessages: string[] = [];
  public readonly maxRetries: number;
  public readonly projectName: string;

  constructor(projectName: string, maxRetries: number = DEFAULT_MAX_RETRIES) {
    this.projectName = projectName;
    this.maxRetries = maxRetries;
  }

  // Helper method to get environment tokens
  private getEnvTokens(): EnvTokens {
    return {
      agent1AccessToken: process.env[`${this.projectName}_AGENT1_ACCESS_TOKEN`] ?? '',
      agent2AccessToken: process.env[`${this.projectName}_AGENT2_ACCESS_TOKEN`] ?? '',
      agent1Username: process.env[`${this.projectName}_AGENT1_USERNAME`] ?? '',
      agent2Username: process.env[`${this.projectName}_AGENT2_USERNAME`] ?? '',
      agent1ExtensionNumber: process.env[`${this.projectName}_AGENT1_EXTENSION_NUMBER`] ?? '',
      password: process.env.PW_SANDBOX_PASSWORD ?? '',
      dialNumberUsername: process.env.PW_DIAL_NUMBER_LOGIN_USERNAME ?? '',
      dialNumberPassword: process.env.PW_DIAL_NUMBER_LOGIN_PASSWORD ?? '',
    };
  }

  // Helper method to create context with error handling
  private async createContextWithPage(browser: Browser, type: PageType): Promise<ContextCreationResult> {
    try {
      const context = await browser.newContext();
      const page = await context.newPage();
      return {context, page, type};
    } catch (error) {
      throw new Error(`Failed to create context for ${type}: ${error}`);
    }
  }

  // Helper method to setup console logging for a page
  private setupPageConsoleLogging(page: Page, enableLogging: boolean = true): void {
    if (enableLogging) {
      page.on('console', (msg) => this.consoleMessages.push(msg.text()));
    }
  }

  // Helper method to retry operations with exponential backoff
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = this.maxRetries
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw new Error(`Failed ${operationName} after ${maxRetries} attempts: ${error}`);
        }
        console.warn(`${operationName} attempt ${attempt + 1} failed, retrying...`);
        // Simple exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    throw new Error(`Retry operation failed unexpectedly for ${operationName}`);
  }

  // Helper method to check if logout button is visible
  private async isLogoutButtonVisible(page: Page, timeout: number = DEFAULT_TIMEOUT): Promise<boolean> {
    try {
      return await page.getByTestId('samples:station-logout-button').isVisible({timeout});
    } catch {
      return false;
    }
  }

  // 🎯 Universal Setup Method - Handles all test scenarios (Parallelized)
  async setup(browser: Browser, config: SetupConfig = {}): Promise<void> {
    // Default configuration
    const defaults: SetupConfig = {
      needsAgent1: true,
      needsAgent2: false,
      needsCaller: false,
      needsExtension: false,
      needsChat: false,
      needsMultiSession: false,
      agent1LoginMode: LOGIN_MODE.DESKTOP,
      enableConsoleLogging: true,
      enableAdvancedLogging: false,
      needDialNumberLogin: false,
    };

    const finalConfig: Required<SetupConfig> = {...defaults, ...config} as Required<SetupConfig>;
    const envTokens = this.getEnvTokens();

    // 🚀 Step 1: Create all required browser contexts in parallel
    const contextCreationPromises = this.createContextsForConfig(browser, finalConfig);
    await this.processContextCreations(contextCreationPromises, finalConfig);

    // 🚀 Step 2: Setup login and widgets in parallel for independent pages
    const setupPromises = this.createSetupPromises(finalConfig, envTokens);
    await Promise.all(setupPromises);

    // Multi-session setup - Remove dependency wait, make it truly parallel
    if (finalConfig.needsMultiSession && this.multiSessionAgent1Page) {
      await this.setupMultiSessionFlow(finalConfig, envTokens);
    }

    // 🚀 Step 3: Setup console logging (can be done in parallel too)
    await this.setupConsoleLogging(finalConfig);
  }

  // Helper method to create context creation promises
  private createContextsForConfig(browser: Browser, config: Required<SetupConfig>): Promise<ContextCreationResult>[] {
    const promises: Promise<ContextCreationResult>[] = [];

    if (config.needsAgent1) {
      promises.push(this.createContextWithPage(browser, PAGE_TYPES.AGENT1));
    }
    if (config.needsAgent2) {
      promises.push(this.createContextWithPage(browser, PAGE_TYPES.AGENT2));
    }
    if (config.needsCaller) {
      promises.push(this.createContextWithPage(browser, PAGE_TYPES.CALLER));
    }
    if (config.needsExtension) {
      promises.push(this.createContextWithPage(browser, PAGE_TYPES.EXTENSION));
    }
    if (config.needDialNumberLogin) {
      promises.push(this.createContextWithPage(browser, PAGE_TYPES.DIAL_NUMBER));
    }
    if (config.needsChat) {
      promises.push(this.createContextWithPage(browser, PAGE_TYPES.CHAT));
    }
    if (config.needsMultiSession) {
      promises.push(this.createContextWithPage(browser, PAGE_TYPES.MULTI_SESSION));
    }

    return promises;
  }

  // Helper method to process context creations
  private async processContextCreations(
    promises: Promise<ContextCreationResult>[],
    config: Required<SetupConfig>
  ): Promise<void> {
    const results = await Promise.all(promises);

    for (const result of results) {
      switch (result.type) {
        case PAGE_TYPES.AGENT1:
          this.agent1Context = result.context;
          this.agent1Page = result.page;
          this.consoleMessages = [];
          this.setupPageConsoleLogging(this.agent1Page, true);
          break;
        case PAGE_TYPES.AGENT2:
          this.agent2Context = result.context;
          this.agent2Page = result.page;
          this.setupPageConsoleLogging(this.agent2Page, config.enableConsoleLogging);
          break;
        case PAGE_TYPES.CALLER:
          this.callerExtensionContext = result.context;
          this.callerPage = result.page;
          break;
        case PAGE_TYPES.EXTENSION:
          this.extensionContext = result.context;
          this.agent1ExtensionPage = result.page;
          break;
        case PAGE_TYPES.CHAT:
          this.chatContext = result.context;
          this.chatPage = result.page;
          break;
        case PAGE_TYPES.MULTI_SESSION:
          this.multiSessionContext = result.context;
          this.multiSessionAgent1Page = result.page;
          break;
        case PAGE_TYPES.DIAL_NUMBER:
          this.dialNumberContext = result.context;
          this.dialNumberPage = result.page;
          break;
        default:
          throw new Error(`Unknown page type: ${result.type}`);
      }
    }
  }

  // Helper method to create setup promises
  private createSetupPromises(config: Required<SetupConfig>, envTokens: EnvTokens): Promise<void>[] {
    const setupPromises: Promise<void>[] = [];

    // Agent1 setup
    if (config.needsAgent1) {
      setupPromises.push(this.setupAgent1(config, envTokens));
    }

    // Agent2 setup
    if (config.needsAgent2) {
      setupPromises.push(this.setupAgent2(envTokens));
    }

    // Caller extension setup
    if (config.needsCaller && this.callerPage) {
      setupPromises.push(this.setupCaller(envTokens));
    }

    // Dial Number setup
    if (config.needDialNumberLogin && this.dialNumberPage) {
      setupPromises.push(this.setupDialNumber(envTokens));
    }
    return setupPromises;
  }

  // Helper method for Agent1 setup
  private async setupAgent1(config: Required<SetupConfig>, envTokens: EnvTokens): Promise<void> {
    if (config.agent1LoginMode === LOGIN_MODE.DESKTOP) {
      await pageSetup(this.agent1Page, LOGIN_MODE.DESKTOP, envTokens.agent1AccessToken);
    } else if (config.agent1LoginMode === LOGIN_MODE.EXTENSION && this.agent1ExtensionPage) {
      await Promise.all([
        pageSetup(
          this.agent1Page,
          LOGIN_MODE.EXTENSION,
          envTokens.agent1AccessToken,
          this.agent1ExtensionPage,
          envTokens.agent1ExtensionNumber
        ),
        this.retryOperation(
          () => loginExtension(this.agent1ExtensionPage, envTokens.agent1Username, envTokens.password),
          'agent1 extension login'
        ),
      ]);
    }
  }

  // Helper method for Agent2 setup
  private async setupAgent2(envTokens: EnvTokens): Promise<void> {
    await pageSetup(this.agent2Page, LOGIN_MODE.DESKTOP, envTokens.agent2AccessToken);
  }

  // Helper method for Dial Number setup
  private async setupDialNumber(envTokens: EnvTokens): Promise<void> {
    await this.retryOperation(
      () => loginExtension(this.dialNumberPage, envTokens.dialNumberUsername, envTokens.dialNumberPassword),
      'dial number login'
    );
    // Ensure only one page remains in the Dial Number context to avoid duplicate web client instances
    await this.enforceSingleDialNumberInOwnContext();
  }

  // Helper method for Caller setup
  private async setupCaller(envTokens: EnvTokens): Promise<void> {
    await this.retryOperation(
      () => loginExtension(this.callerPage!, envTokens.agent2Username, envTokens.password),
      'caller extension login'
    );
  }

  // Helper method for multi-session setup
  private async setupMultiSessionFlow(config: Required<SetupConfig>, envTokens: EnvTokens): Promise<void> {
    if (config.agent1LoginMode === LOGIN_MODE.EXTENSION) {
      await pageSetup(
        this.multiSessionAgent1Page!,
        LOGIN_MODE.EXTENSION,
        envTokens.agent1AccessToken,
        this.agent1ExtensionPage,
        envTokens.agent1ExtensionNumber,
        true // Enable multi-session mode
      );
    }
  }

  // Helper method for console logging setup
  private async setupConsoleLogging(config: Required<SetupConfig>): Promise<void> {
    const setupOperations: (() => void)[] = [];

    if (config.enableConsoleLogging && config.needsAgent1) {
      setupOperations.push(() => setupConsoleLogging(this.agent1Page));
    }

    if (config.enableAdvancedLogging && config.needsAgent1) {
      setupOperations.push(() => setupAdvancedConsoleLogging(this.agent1Page));
    }

    if (config.enableConsoleLogging && config.needsAgent2) {
      setupOperations.push(() => setupConsoleLogging(this.agent2Page));
    }

    if (config.enableAdvancedLogging && config.needsAgent2) {
      setupOperations.push(() => setupAdvancedConsoleLogging(this.agent2Page));
    }

    // Execute all setup operations synchronously since they don't return promises
    setupOperations.forEach((operation) => operation());
  }

  async basicSetup(browser: Browser) {
    await this.setup(browser, {
      needsAgent1: true,
      needsAgent2: false,
      agent1LoginMode: LOGIN_MODE.DESKTOP,
      enableConsoleLogging: true,
      enableAdvancedLogging: false,
    });
  }

  async setupForAdvancedTaskControls(browser: Browser) {
    await this.setup(browser, {
      needsAgent1: true,
      needsAgent2: true,
      needsExtension: true,
      needsCaller: true,
      agent1LoginMode: LOGIN_MODE.EXTENSION,
      enableConsoleLogging: true,
      enableAdvancedLogging: true,
      needDialNumberLogin: true,
    });
  }

  async setupForAdvancedCombinations(browser: Browser) {
    await this.setup(browser, {
      needsAgent1: true,
      needsAgent2: true,
      needsCaller: true,
      needDialNumberLogin: true,
      agent1LoginMode: LOGIN_MODE.DESKTOP,
      enableConsoleLogging: true,
      enableAdvancedLogging: true,
    });
  }

  async setupForStationLogin(browser: Browser, isDesktopMode: boolean = false): Promise<void> {
    const envTokens = this.getEnvTokens();

    // Create browser context and page
    this.agent1Context = await browser.newContext();
    this.agent1Page = await this.agent1Context.newPage();
    this.consoleMessages = [];
    this.setupPageConsoleLogging(this.agent1Page, true);

    // Create multi-session context and page for multi-login tests
    this.multiSessionContext = await browser.newContext();
    this.multiSessionAgent1Page = await this.multiSessionContext.newPage();

    // Define page setup operations
    const pageSetupOperations: Promise<void>[] = [
      // Main page setup
      this.setupPageWithWidgets(this.agent1Page, envTokens.agent1AccessToken),
    ];

    // Add multi-session page setup only if not in desktop mode
    if (!isDesktopMode) {
      pageSetupOperations.push(this.setupPageWithWidgets(this.multiSessionAgent1Page, envTokens.agent1AccessToken));
    }

    // Execute page setups in parallel
    await Promise.all(pageSetupOperations);

    // Handle station logout for both pages
    await this.handleStationLogouts(isDesktopMode);

    // Ensure station login widget is visible on both pages
    await this.verifyStationLoginWidgets(isDesktopMode);
  }

  // Helper method to setup page with widgets
  private async setupPageWithWidgets(page: Page, accessToken: string): Promise<void> {
    await loginViaAccessToken(page, accessToken);
    await registerAgent(page);
    await enableMultiLogin(page);
    await enableAllWidgets(page);
    await initialiseWidgets(page);
  }

  // Helper method to handle station logouts
  private async handleStationLogouts(isDesktopMode: boolean): Promise<void> {
    const logoutOperations: Promise<void>[] = [];

    // Logout from station if already logged in on main page
    if (await this.isLogoutButtonVisible(this.agent1Page)) {
      logoutOperations.push(stationLogout(this.agent1Page));
    }

    // Logout from station if already logged in on multi-session page
    if (!isDesktopMode && (await this.isLogoutButtonVisible(this.multiSessionAgent1Page))) {
      logoutOperations.push(stationLogout(this.multiSessionAgent1Page));
    }

    await Promise.all(logoutOperations);
  }

  // Helper method to verify station login widgets
  private async verifyStationLoginWidgets(isDesktopMode: boolean): Promise<void> {
    const verificationPromises: Promise<void>[] = [
      expect(this.agent1Page.getByTestId('station-login-widget')).toBeVisible({timeout: AWAIT_TIMEOUT}),
    ];

    if (!isDesktopMode) {
      verificationPromises.push(
        expect(this.multiSessionAgent1Page.getByTestId('station-login-widget')).toBeVisible({
          timeout: AWAIT_TIMEOUT,
        })
      );
    }

    await Promise.all(verificationPromises);
  }

  async setupMultiSessionPage(): Promise<void> {
    if (!this.multiSessionAgent1Page) {
      return;
    }

    const envTokens = this.getEnvTokens();

    // Setup multi-session page with widgets - only called when needed for multi-session tests
    await loginViaAccessToken(this.multiSessionAgent1Page, envTokens.agent1AccessToken);
    await registerAgent(this.multiSessionAgent1Page);

    await Promise.all([enableMultiLogin(this.multiSessionAgent1Page), enableAllWidgets(this.multiSessionAgent1Page)]);

    await initialiseWidgets(this.multiSessionAgent1Page);
  }

  // Specific setup methods that use the universal setup
  async setupForIncomingTaskDesktop(browser: Browser) {
    await this.setup(browser, {
      needsAgent1: true,
      needsCaller: true,
      agent1LoginMode: LOGIN_MODE.DESKTOP,
      needsChat: true,
      enableConsoleLogging: true,
    });
  }

  async setupForIncomingTaskExtension(browser: Browser) {
    await this.setup(browser, {
      needsAgent1: true,
      needsCaller: true,
      needsExtension: true,
      needsChat: true,
      agent1LoginMode: LOGIN_MODE.EXTENSION,
      enableConsoleLogging: true,
    });
  }

  async setupForIncomingTaskMultiSession(browser: Browser) {
    await this.setup(browser, {
      needsAgent1: true,
      needsCaller: true,
      needsExtension: true,
      needsChat: true,
      needsMultiSession: true,
      agent1LoginMode: LOGIN_MODE.EXTENSION,
      enableConsoleLogging: true,
    });
  }

  async cleanup(): Promise<void> {
    // Logout operations - can be done in parallel
    const logoutOperations: Promise<void>[] = [];

    if (this.agent1Page && (await this.isLogoutButtonVisible(this.agent1Page))) {
      logoutOperations.push(stationLogout(this.agent1Page));
    }

    if (this.agent2Page && (await this.isLogoutButtonVisible(this.agent2Page))) {
      logoutOperations.push(stationLogout(this.agent2Page));
    }

    await Promise.all(logoutOperations);

    // Close pages and contexts in parallel
    const cleanupOperations: Promise<void>[] = [];

    // Close pages
    const pagesToClose = [
      this.agent1Page,
      this.multiSessionAgent1Page,
      this.agent2Page,
      this.callerPage,
      this.agent1ExtensionPage,
      this.chatPage,
      this.dialNumberPage,
    ].filter(Boolean);

    pagesToClose.forEach((page) => {
      if (page) {
        cleanupOperations.push(page.close().catch(() => {})); // Ignore errors during cleanup
      }
    });

    // Close contexts
    const contextsToClose = [
      this.agent1Context,
      this.multiSessionContext,
      this.agent2Context,
      this.callerExtensionContext,
      this.extensionContext,
      this.chatContext,
      this.dialNumberContext,
    ].filter(Boolean);

    contextsToClose.forEach((context) => {
      if (context) {
        cleanupOperations.push(context.close().catch(() => {})); // Ignore errors during cleanup
      }
    });

    await Promise.all(cleanupOperations);
  }

  // Helper method to hard-reset the dial number login session
  public async resetDialNumberSession(): Promise<void> {
    if (!this.dialNumberPage || !this.dialNumberContext) {
      return;
    }
    const envTokens = this.getEnvTokens();
    try {
      await this.dialNumberContext.clearCookies();
      await this.dialNumberPage.evaluate(() => {
        try {
          localStorage.clear();
        } catch {}
        try {
          sessionStorage.clear();
        } catch {}
      });
      // Navigate fresh and login again
      await this.dialNumberPage.goto(CALL_URL);
      await loginExtension(this.dialNumberPage, envTokens.dialNumberUsername!, envTokens.dialNumberPassword!);
      await this.enforceSingleDialNumberInOwnContext();
    } catch (error) {
      throw new Error(`Failed to reset dial number session: ${error}`);
    }
  }

  // Ensures at most one page exists in the dedicated Dial Number context we manage.
  // Closes any extra tabs/pages opened in that context to prevent multiple web.webex.com instances for the Dial Number user.
  private async enforceSingleDialNumberInOwnContext(): Promise<void> {
    if (!this.dialNumberContext) return;
    try {
      const pages = this.dialNumberContext.pages();
      for (const p of pages) {
        if (p !== this.dialNumberPage) {
          try {
            await p.close();
          } catch {}
        }
      }
    } catch {}
  }
}
