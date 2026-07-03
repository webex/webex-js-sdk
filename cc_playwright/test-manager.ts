import {expect, Page, BrowserContext, Browser} from '@playwright/test';
import {loginViaAccessToken} from './Utils/initUtils';
import {stationLogout} from './Utils/stationLoginUtils';
import {loginExtension} from './Utils/incomingTaskUtils';
import {setupConsoleLogging} from './Utils/taskControlUtils';
import {setupAdvancedConsoleLogging} from './Utils/advancedTaskControlUtils';
import {pageSetup, handleStrayTasks} from './Utils/helperUtils';
import {
  LOGIN_MODE,
  LoginMode,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT,
  OPERATION_TIMEOUT,
  UI_SETTLE_TIMEOUT,
  AWAIT_TIMEOUT,
  PAGE_TYPES,
  PageType,
} from './constants';

// Configuration interfaces for setup options
interface SetupConfig {
  // Core requirements
  needsAgent1?: boolean;
  needsAgent2?: boolean;
  needsAgent3?: boolean;
  needsAgent4?: boolean;
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
  agent3AccessToken: string;
  agent4AccessToken: string;
  agent1Username: string;
  agent2Username: string;
  agent3Username: string;
  agent4Username: string;
  agent1ExtensionNumber: string;
  password: string;
  dialNumberLoginAccessToken?: string;
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

  // Agent 3 main widget page (Agent 3 login)
  public agent3Page: Page;
  public agent3Context: BrowserContext;

  // Agent 4 main widget page (Agent 4 login)
  public agent4Page: Page;
  public agent4Context: BrowserContext;

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
      agent3AccessToken: process.env[`${this.projectName}_AGENT3_ACCESS_TOKEN`] ?? '',
      agent4AccessToken: process.env[`${this.projectName}_AGENT4_ACCESS_TOKEN`] ?? '',
      agent1Username: process.env[`${this.projectName}_AGENT1_USERNAME`] ?? '',
      agent2Username: process.env[`${this.projectName}_AGENT2_USERNAME`] ?? '',
      agent3Username: process.env[`${this.projectName}_AGENT3_USERNAME`] ?? '',
      agent4Username: process.env[`${this.projectName}_AGENT4_USERNAME`] ?? '',
      agent1ExtensionNumber: process.env[`${this.projectName}_AGENT1_EXTENSION_NUMBER`] ?? '',
      password: process.env.PW_SANDBOX_PASSWORD ?? '',
      dialNumberLoginAccessToken: process.env.DIAL_NUMBER_LOGIN_ACCESS_TOKEN ?? '',
    };
  }

  // Helper method to create context with error handling
  private async createContextWithPage(
    browser: Browser,
    type: PageType
  ): Promise<ContextCreationResult> {
    try {
      const context = await browser.newContext({ignoreHTTPSErrors: true});
      const page = await context.newPage();

      return {context, page, type};
    } catch (error) {
      throw new Error(`Failed to create context for ${type}: ${error}`);
    }
  }

  // Helper method to setup console logging for a page
  private setupPageConsoleLogging(page: Page, enableLogging = true): void {
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
    /* eslint-disable no-await-in-loop, no-plusplus */
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw new Error(`Failed ${operationName} after ${maxRetries} attempts: ${error}`);
        }
        // Simple exponential backoff
        await new Promise((resolve) => {
          setTimeout(resolve, 2 ** attempt * 1000);
        });
      }
    }
    /* eslint-enable no-await-in-loop, no-plusplus */
    throw new Error(`Retry operation failed unexpectedly for ${operationName}`);
  }

  // Helper method to check if logout button is visible
  private async isLogoutButtonVisible(
    page: Page,
    timeout: number = DEFAULT_TIMEOUT
  ): Promise<boolean> {
    try {
      return await page.locator('#logoutAgent').isVisible({timeout});
    } catch {
      return false;
    }
  }

  // Best-effort guard to prevent cleanup/setup hooks from hanging indefinitely.
  private async runBestEffortWithTimeout(
    operation: () => Promise<void>,
    timeout: number = OPERATION_TIMEOUT
  ): Promise<void> {
    const guardedOperation = operation().catch(() => {});
    const timeoutGuard = new Promise<void>((resolve) => {
      setTimeout(resolve, timeout);
    });
    await Promise.race([guardedOperation, timeoutGuard]);
  }

  private async safeHandleStrayTasks(
    page?: Page,
    extensionPage: Page | null = null
  ): Promise<void> {
    if (!page || page.isClosed()) {
      return;
    }
    const validExtension = extensionPage && !extensionPage.isClosed() ? extensionPage : null;
    await this.runBestEffortWithTimeout(() => handleStrayTasks(page, validExtension));
  }

  private async safeStationLogout(page?: Page): Promise<void> {
    if (!page || page.isClosed()) {
      return;
    }
    const hasLogoutButton = await this.isLogoutButtonVisible(page);
    if (!hasLogoutButton) {
      return;
    }
    await this.runBestEffortWithTimeout(
      () => stationLogout(page, false),
      OPERATION_TIMEOUT + UI_SETTLE_TIMEOUT * 10
    );
  }

  // 🎯 Universal Setup Method - Handles all test scenarios (Parallelized)
  async setup(browser: Browser, config: SetupConfig = {}): Promise<void> {
    // Default configuration
    const defaults: SetupConfig = {
      needsAgent1: true,
      needsAgent2: false,
      needsAgent3: false,
      needsAgent4: false,
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
  private createContextsForConfig(
    browser: Browser,
    config: Required<SetupConfig>
  ): Promise<ContextCreationResult>[] {
    const promises: Promise<ContextCreationResult>[] = [];

    if (config.needsAgent1) {
      promises.push(this.createContextWithPage(browser, PAGE_TYPES.AGENT1));
    }
    if (config.needsAgent2) {
      promises.push(this.createContextWithPage(browser, PAGE_TYPES.AGENT2));
    }
    if (config.needsAgent3) {
      promises.push(this.createContextWithPage(browser, PAGE_TYPES.AGENT3));
    }
    if (config.needsAgent4) {
      promises.push(this.createContextWithPage(browser, PAGE_TYPES.AGENT4));
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
        case PAGE_TYPES.AGENT3:
          this.agent3Context = result.context;
          this.agent3Page = result.page;
          this.setupPageConsoleLogging(this.agent3Page, config.enableConsoleLogging);
          break;
        case PAGE_TYPES.AGENT4:
          this.agent4Context = result.context;
          this.agent4Page = result.page;
          this.setupPageConsoleLogging(this.agent4Page, config.enableConsoleLogging);
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
  private createSetupPromises(
    config: Required<SetupConfig>,
    envTokens: EnvTokens
  ): Promise<void>[] {
    const setupPromises: Promise<void>[] = [];

    // Agent1 setup
    if (config.needsAgent1) {
      setupPromises.push(this.setupAgent1(config, envTokens));
    }

    // Agent2 setup
    if (config.needsAgent2) {
      setupPromises.push(this.setupAgent2(envTokens));
    }

    // Agent3 setup
    if (config.needsAgent3) {
      setupPromises.push(this.setupAgent3(envTokens));
    }

    // Agent4 setup
    if (config.needsAgent4) {
      setupPromises.push(this.setupAgent4(envTokens));
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
          envTokens.agent1ExtensionNumber
        ),
        this.retryOperation(
          () => loginExtension(this.agent1ExtensionPage, envTokens.agent1AccessToken),
          'agent1 extension login'
        ),
      ]);
    }
  }

  // Helper method for Agent2 setup
  private async setupAgent2(envTokens: EnvTokens): Promise<void> {
    await pageSetup(this.agent2Page, LOGIN_MODE.DESKTOP, envTokens.agent2AccessToken);
  }

  // Helper method for Agent3 setup
  private async setupAgent3(envTokens: EnvTokens): Promise<void> {
    await pageSetup(this.agent3Page, LOGIN_MODE.DESKTOP, envTokens.agent3AccessToken);
  }

  // Helper method for Agent4 setup
  private async setupAgent4(envTokens: EnvTokens): Promise<void> {
    await pageSetup(this.agent4Page, LOGIN_MODE.DESKTOP, envTokens.agent4AccessToken);
  }

  // Helper method for Dial Number setup
  private async setupDialNumber(envTokens: EnvTokens): Promise<void> {
    await this.retryOperation(
      () => loginExtension(this.dialNumberPage, envTokens.dialNumberLoginAccessToken),
      'dial number login'
    );
    // Ensure only one page remains in the Dial Number context to avoid duplicate web client instances
    // await this.enforceSingleDialNumberInOwnContext();
  }

  // Helper method for Caller setup
  private async setupCaller(envTokens: EnvTokens): Promise<void> {
    await this.retryOperation(
      () => loginExtension(this.callerPage!, envTokens.agent2AccessToken),
      'caller extension login'
    );
  }

  // Helper method for multi-session setup
  private async setupMultiSessionFlow(
    config: Required<SetupConfig>,
    envTokens: EnvTokens
  ): Promise<void> {
    if (config.agent1LoginMode === LOGIN_MODE.EXTENSION) {
      await pageSetup(
        this.multiSessionAgent1Page!,
        LOGIN_MODE.EXTENSION,
        envTokens.agent1AccessToken,
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

    if (config.enableConsoleLogging && config.needsAgent3) {
      setupOperations.push(() => setupConsoleLogging(this.agent3Page));
    }

    if (config.enableAdvancedLogging && config.needsAgent3) {
      setupOperations.push(() => setupAdvancedConsoleLogging(this.agent3Page));
    }

    if (config.enableConsoleLogging && config.needsAgent4) {
      setupOperations.push(() => setupConsoleLogging(this.agent4Page));
    }

    if (config.enableAdvancedLogging && config.needsAgent4) {
      setupOperations.push(() => setupAdvancedConsoleLogging(this.agent4Page));
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
      needDialNumberLogin: false,
    });
  }

  async setupForAdvancedCombinations(browser: Browser) {
    await this.setup(browser, {
      needsAgent1: true,
      needsAgent2: true,
      needsCaller: true,
      needDialNumberLogin: false,
      agent1LoginMode: LOGIN_MODE.DESKTOP,
      enableConsoleLogging: true,
      enableAdvancedLogging: true,
    });
  }

  async setupForDialNumber(browser: Browser) {
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

  async setupForMultipartyConference(browser: Browser) {
    await this.setup(browser, {
      needsAgent1: true,
      needsAgent2: true,
      needsAgent3: true,
      needsAgent4: true,
      needsCaller: true,
      needDialNumberLogin: false,
      agent1LoginMode: LOGIN_MODE.DESKTOP,
      enableConsoleLogging: true,
      enableAdvancedLogging: true,
    });
  }

  async setupForStationLogin(browser: Browser): Promise<void> {
    const envTokens = this.getEnvTokens();

    // Create browser context and page
    this.agent1Context = await browser.newContext({ignoreHTTPSErrors: true});
    this.agent1Page = await this.agent1Context.newPage();
    this.consoleMessages = [];
    this.setupPageConsoleLogging(this.agent1Page, true);

    // Note: Multi-session support removed - sample app doesn't support widget-based multi-session
    // For multi-session tests, create separate contexts manually with different agent credentials

    // Setup page with SDK initialization
    await this.setupPageWithWidgets(this.agent1Page, envTokens.agent1AccessToken);

    // Handle station logout
    await this.handleStationLogouts();

    // Ensure station login widget is visible
    await this.verifyStationLoginWidgets();
  }

  // Helper method to setup page with widgets
  private async setupPageWithWidgets(page: Page, accessToken: string): Promise<void> {
    await loginViaAccessToken(page, accessToken);
    await page.waitForLoadState('domcontentloaded');

    // Check current status to determine if we need to register
    const currentStatus = await page.locator('#ws-connection-status').textContent();
    const isSubscribed = currentStatus?.trim() === 'Subscribed';

    if (isSubscribed) {
      // SDK already registered and active - just ensure dropdowns are populated
      await page.waitForTimeout(2000); // Let any pending restoration complete
    } else {
      // Need to initialize and register
      // Initialize SDK - click webex.init() button
      const saveButton = page.locator('#access-token-save');
      const saveEnabled = await saveButton.isEnabled().catch(() => false);

      if (saveEnabled) {
        await saveButton.click();
        await expect(page.locator('#webexcc-register')).toBeEnabled({timeout: OPERATION_TIMEOUT});
      }

      // Register with contact center - populates login options dropdown
      const registerButton = page.locator('#webexcc-register');
      const registerEnabled = await registerButton.isEnabled().catch(() => false);

      if (registerEnabled) {
        await registerButton.click();

        // Wait for registration to complete - status should change to "Subscribed"
        await expect(page.locator('#ws-connection-status')).toHaveText('Subscribed', {
          timeout: OPERATION_TIMEOUT,
        });
      } else {
        // Button disabled but not subscribed - partial state, wait for restoration
        await page.waitForTimeout(3000);
        await expect(page.locator('#ws-connection-status')).toHaveText('Subscribed', {
          timeout: OPERATION_TIMEOUT,
        });
      }
    }

    // Wait for teams dropdown to populate - confirms agent profile loaded
    await page.locator('#teamsDropdown option:not([value=""])').first().waitFor({
      state: 'attached',
      timeout: OPERATION_TIMEOUT,
    });

    // Wait for login options dropdown to populate - confirms loginVoiceOptions are loaded
    // This dropdown contains BROWSER, EXTENSION, AGENT_DN options
    await page.locator('#AgentLogin option:not([value=""])').first().waitFor({
      state: 'attached',
      timeout: OPERATION_TIMEOUT,
    });
  }

  // Helper method to handle station logouts
  private async handleStationLogouts(): Promise<void> {
    // Logout from station if already logged in
    if (await this.isLogoutButtonVisible(this.agent1Page)) {
      await stationLogout(this.agent1Page, false); // Don't throw during setup cleanup
    }
  }

  // Helper method to verify station login widgets
  private async verifyStationLoginWidgets(): Promise<void> {
    await expect(this.agent1Page.locator('#AgentLogin')).toBeVisible({timeout: AWAIT_TIMEOUT});
  }

  async setupMultiSessionPage(): Promise<void> {
    if (!this.multiSessionAgent1Page) {
      return;
    }

    const envTokens = this.getEnvTokens();

    // Setup multi-session page with full SDK initialization
    await loginViaAccessToken(this.multiSessionAgent1Page, envTokens.agent1AccessToken);
    await this.multiSessionAgent1Page.waitForLoadState('domcontentloaded');

    // Initialize SDK - click webex.init() button
    await this.multiSessionAgent1Page.click('#access-token-save');
    await expect(this.multiSessionAgent1Page.locator('#webexcc-register')).toBeEnabled({
      timeout: OPERATION_TIMEOUT,
    });

    // Register with contact center - populates login options dropdown
    await this.multiSessionAgent1Page.click('#webexcc-register');

    // Wait for registration status to update (from "Not Subscribed" to "Subscribed")
    await expect(this.multiSessionAgent1Page.locator('#ws-connection-status')).toHaveText(
      'Subscribed',
      {
        timeout: OPERATION_TIMEOUT,
      }
    );

    // Wait for teams dropdown to populate - confirms agent profile loaded
    await this.multiSessionAgent1Page
      .locator('#teamsDropdown option:not([value=""])')
      .first()
      .waitFor({
        state: 'attached',
        timeout: OPERATION_TIMEOUT,
      });
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

  /**
   * Soft cleanup - only handles stray tasks without logging out or closing browsers.
   * Use this in afterAll to clean up state between test files.
   */
  async softCleanup(): Promise<void> {
    const cleanupOps: Promise<void>[] = [];

    if (this.agent1Page) {
      cleanupOps.push(this.safeHandleStrayTasks(this.agent1Page, this.agent1ExtensionPage));
    }
    if (this.multiSessionAgent1Page) {
      cleanupOps.push(
        this.safeHandleStrayTasks(this.multiSessionAgent1Page, this.agent1ExtensionPage)
      );
    }
    if (this.agent2Page) {
      cleanupOps.push(this.safeHandleStrayTasks(this.agent2Page));
    }
    if (this.agent3Page) {
      cleanupOps.push(this.safeHandleStrayTasks(this.agent3Page));
    }
    if (this.agent4Page) {
      cleanupOps.push(this.safeHandleStrayTasks(this.agent4Page));
    }
    if (this.callerPage) {
      cleanupOps.push(this.safeHandleStrayTasks(this.callerPage));
    }

    await Promise.all(cleanupOps);
  }

  /**
   * Full cleanup - logs out and closes all pages/contexts.
   * Use this only at the end of the entire test suite.
   */
  async cleanup(): Promise<void> {
    // First handle any stray tasks
    await this.softCleanup().catch(() => {});

    // Logout operations - can be done in parallel
    const logoutOperations: Promise<void>[] = [];

    if (this.agent1Page) {
      logoutOperations.push(this.safeStationLogout(this.agent1Page));
    }

    if (this.multiSessionAgent1Page) {
      logoutOperations.push(this.safeStationLogout(this.multiSessionAgent1Page));
    }

    if (this.agent2Page) {
      logoutOperations.push(this.safeStationLogout(this.agent2Page));
    }

    if (this.agent3Page) {
      logoutOperations.push(this.safeStationLogout(this.agent3Page));
    }

    if (this.agent4Page) {
      logoutOperations.push(this.safeStationLogout(this.agent4Page));
    }

    await Promise.all(logoutOperations);

    // Close pages and contexts in parallel
    const cleanupOperations: Promise<void>[] = [];

    // Close pages
    const pagesToClose = [
      this.agent1Page,
      this.multiSessionAgent1Page,
      this.agent2Page,
      this.agent3Page,
      this.agent4Page,
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
      this.agent3Context,
      this.agent4Context,
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
}
