/* eslint-disable no-await-in-loop */
import {expect, Page, BrowserContext, Browser} from '@playwright/test';
import {stationLogout} from './Utils/stationLoginUtils';
import {loginExtension} from './Utils/incomingTaskUtils';
import {setupConsoleLogging} from './Utils/taskControlUtils';
import {setupAdvancedConsoleLogging} from './Utils/advancedTaskControlUtils';
import {pageSetup, handleStrayTasks, runWithTimeout, sleep} from './Utils/helperUtils';
import {
  LOGIN_MODE,
  LoginMode,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT,
  AWAIT_TIMEOUT,
  PAGE_TYPES,
  PageType,
} from './constants';

interface SetupConfig {
  needsAgent1?: boolean;
  needsAgent2?: boolean;
  needsAgent3?: boolean;
  needsAgent4?: boolean;
  needsCaller?: boolean;
  needsExtension?: boolean;
  needsChat?: boolean;
  needsMultiSession?: boolean;

  agent1LoginMode?: LoginMode;

  enableConsoleLogging?: boolean;
  enableAdvancedLogging?: boolean;
  needDialNumberLogin?: boolean;
}

interface EnvTokens {
  agent1AccessToken: string;
  agent2AccessToken: string;
  agent3AccessToken: string;
  agent4AccessToken: string;
  callerAccessToken: string;
  agent1Username: string;
  agent2Username: string;
  agent3Username: string;
  agent4Username: string;
  agent1ExtensionNumber: string;
  entryPoint: string;
  password: string;
  dialNumberLoginAccessToken?: string;
}

interface ContextCreationResult {
  context: BrowserContext;
  page: Page;
  type: PageType;
}

const PAGE_SETUP_ATTEMPT_TIMEOUT_MS = 4 * 60 * 1000;
const LOGIN_SETUP_ATTEMPT_TIMEOUT_MS = 2 * 60 * 1000;

export class TestManager {
  public agent1Page!: Page;
  public agent1Context!: BrowserContext;

  public multiSessionAgent1Page: Page;
  public multiSessionContext: BrowserContext;

  public agent2Page: Page;
  public agent2Context: BrowserContext;

  public agent3Page: Page;
  public agent3Context: BrowserContext;

  public agent4Page: Page;
  public agent4Context: BrowserContext;

  public callerPage: Page;
  public callerExtensionContext: BrowserContext;

  public agent1ExtensionPage: Page;
  public extensionContext: BrowserContext;

  public chatPage: Page;
  public chatContext: BrowserContext;

  public dialNumberPage: Page;
  public dialNumberContext: BrowserContext;

  public consoleMessages: string[] = [];
  public readonly maxRetries: number;
  public readonly projectName: string;

  constructor(projectName: string, maxRetries: number = DEFAULT_MAX_RETRIES) {
    this.projectName = projectName;
    this.maxRetries = maxRetries;
  }

  private getEnvTokens(): EnvTokens {
    return {
      agent1AccessToken: process.env[`${this.projectName}_AGENT1_ACCESS_TOKEN`] ?? '',
      agent2AccessToken: process.env[`${this.projectName}_AGENT2_ACCESS_TOKEN`] ?? '',
      agent3AccessToken: process.env[`${this.projectName}_AGENT3_ACCESS_TOKEN`] ?? '',
      agent4AccessToken: process.env[`${this.projectName}_AGENT4_ACCESS_TOKEN`] ?? '',
      callerAccessToken:
        process.env[`${this.projectName}_CALLER_ACCESS_TOKEN`] ??
        process.env.CALLER_ACCESS_TOKEN ??
        '',
      agent1Username: process.env[`${this.projectName}_AGENT1_USERNAME`] ?? '',
      agent2Username: process.env[`${this.projectName}_AGENT2_USERNAME`] ?? '',
      agent3Username: process.env[`${this.projectName}_AGENT3_USERNAME`] ?? '',
      agent4Username: process.env[`${this.projectName}_AGENT4_USERNAME`] ?? '',
      agent1ExtensionNumber: process.env[`${this.projectName}_AGENT1_EXTENSION_NUMBER`] ?? '',
      entryPoint: process.env[`${this.projectName}_ENTRY_POINT`] ?? '',
      password: process.env.PW_SANDBOX_PASSWORD ?? '',
      dialNumberLoginAccessToken: process.env.DIAL_NUMBER_LOGIN_ACCESS_TOKEN ?? '',
    };
  }

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

  private setupPageConsoleLogging(page: Page, enableLogging = true): void {
    if (enableLogging) {
      page.on('console', (msg) => this.consoleMessages.push(msg.text()));
    }
  }

  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries?: number,
    attemptTimeoutMs?: number
  ): Promise<T> {
    const retryCount = maxRetries ?? this.maxRetries;
    /* eslint-disable no-plusplus */
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        if (!attemptTimeoutMs) {
          return await operation();
        }

        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            operation(),
            new Promise<T>((_, reject) => {
              timer = setTimeout(() => {
                reject(new Error(`${operationName} timed out after ${attemptTimeoutMs}ms`));
              }, attemptTimeoutMs);
            }),
          ]);
        } finally {
          if (timer) {
            clearTimeout(timer);
          }
        }
      } catch (error) {
        if (attempt === retryCount - 1) {
          throw new Error(`Failed ${operationName} after ${retryCount} attempts: ${error}`);
        }
        await sleep(2 ** attempt * 1000);
      }
    }
    /* eslint-enable no-plusplus */
    throw new Error(`Retry operation failed unexpectedly for ${operationName}`);
  }

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

  private async safeHandleStrayTasks(
    page?: Page,
    extensionPage: Page | null = null
  ): Promise<void> {
    if (!page || page.isClosed()) {
      return;
    }
    const validExtension = extensionPage && !extensionPage.isClosed() ? extensionPage : null;
    await runWithTimeout(() => handleStrayTasks(page, validExtension));
  }

  private async safeStationLogout(page?: Page): Promise<void> {
    if (!page || page.isClosed()) {
      return;
    }
    const hasLogoutButton = await this.isLogoutButtonVisible(page);
    if (!hasLogoutButton) {
      return;
    }
    await runWithTimeout(() => stationLogout(page, false), AWAIT_TIMEOUT);
  }

  async setup(browser: Browser, config: SetupConfig = {}): Promise<void> {
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

    const contextCreationPromises = this.createContextsForConfig(browser, finalConfig);
    await this.processContextCreations(contextCreationPromises, finalConfig);

    const setupOperations = this.createSetupOperations(finalConfig, envTokens);
    for (const setupOperation of setupOperations) {
      await setupOperation();
    }

    if (finalConfig.needsMultiSession && this.multiSessionAgent1Page) {
      await this.setupMultiSessionFlow(finalConfig, envTokens);
    }

    await this.setupConsoleLogging(finalConfig);
  }

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

  private createSetupOperations(
    config: Required<SetupConfig>,
    envTokens: EnvTokens
  ): Array<() => Promise<void>> {
    const setupOperations: Array<() => Promise<void>> = [];

    if (config.needsAgent1) {
      setupOperations.push(() => this.setupAgent1(config, envTokens));
    }

    if (config.needsAgent2) {
      setupOperations.push(() => this.setupAgent2(envTokens));
    }

    if (config.needsAgent3) {
      setupOperations.push(() => this.setupAgent3(envTokens));
    }

    if (config.needsAgent4) {
      setupOperations.push(() => this.setupAgent4(envTokens));
    }

    if (config.needsCaller && this.callerPage) {
      setupOperations.push(() => this.setupCaller(config, envTokens));
    }

    if (config.needDialNumberLogin && this.dialNumberPage) {
      setupOperations.push(() => this.setupDialNumber(envTokens));
    }

    return setupOperations;
  }

  private async setupAgent1(config: Required<SetupConfig>, envTokens: EnvTokens): Promise<void> {
    const ensureFreshAgent1Page = async (forceRecreate = false): Promise<void> => {
      if (!forceRecreate && this.agent1Page && !this.agent1Page.isClosed()) {
        return;
      }

      if (!this.agent1Context) {
        throw new Error('Agent1 context is unavailable for recreation');
      }

      const browser = this.agent1Context.browser();
      if (!browser) {
        throw new Error('Browser is unavailable for agent1 page recreation');
      }

      await this.agent1Context.close().catch(() => {});
      const recreated = await this.createContextWithPage(browser, PAGE_TYPES.AGENT1);
      this.agent1Context = recreated.context;
      this.agent1Page = recreated.page;
      this.consoleMessages = [];
      this.setupPageConsoleLogging(this.agent1Page, true);
    };

    if (config.agent1LoginMode === LOGIN_MODE.DESKTOP) {
      let attempt = 0;
      await this.retryOperation(
        async () => {
          await ensureFreshAgent1Page(attempt > 0);
          attempt += 1;

          return pageSetup(
            this.agent1Page,
            LOGIN_MODE.DESKTOP,
            envTokens.agent1AccessToken,
            undefined,
            config.needsMultiSession,
            false
          );
        },
        'agent1 desktop station setup',
        this.maxRetries,
        PAGE_SETUP_ATTEMPT_TIMEOUT_MS
      );
    } else if (config.agent1LoginMode === LOGIN_MODE.EXTENSION) {
      let attempt = 0;
      await this.retryOperation(
        async () => {
          await ensureFreshAgent1Page(attempt > 0);
          attempt += 1;

          return pageSetup(
            this.agent1Page,
            LOGIN_MODE.EXTENSION,
            envTokens.agent1AccessToken,
            envTokens.agent1ExtensionNumber,
            config.needsMultiSession,
            false
          );
        },
        'agent1 extension station setup',
        this.maxRetries,
        PAGE_SETUP_ATTEMPT_TIMEOUT_MS
      );

      if (this.agent1ExtensionPage) {
        await this.retryOperation(
          () => loginExtension(this.agent1ExtensionPage, envTokens.agent1AccessToken),
          'agent1 extension login',
          this.maxRetries,
          LOGIN_SETUP_ATTEMPT_TIMEOUT_MS
        );
      }
    } else if (config.agent1LoginMode === LOGIN_MODE.DIAL_NUMBER) {
      let attempt = 0;
      await this.retryOperation(
        async () => {
          await ensureFreshAgent1Page(attempt > 0);
          attempt += 1;

          return pageSetup(
            this.agent1Page,
            LOGIN_MODE.DIAL_NUMBER,
            envTokens.agent1AccessToken,
            envTokens.entryPoint,
            config.needsMultiSession,
            false
          );
        },
        'agent1 dial-number station setup',
        this.maxRetries,
        PAGE_SETUP_ATTEMPT_TIMEOUT_MS
      );
    }
  }

  private async setupAgent2(envTokens: EnvTokens): Promise<void> {
    const ensureFreshAgent2Page = async (forceRecreate = false): Promise<void> => {
      if (!forceRecreate && this.agent2Page && !this.agent2Page.isClosed()) {
        return;
      }

      if (!this.agent2Context) {
        throw new Error('Agent2 context is unavailable for recreation');
      }

      const browser = this.agent2Context.browser();
      if (!browser) {
        throw new Error('Browser is unavailable for agent2 page recreation');
      }

      await this.agent2Context.close().catch(() => {});
      const recreated = await this.createContextWithPage(browser, PAGE_TYPES.AGENT2);
      this.agent2Context = recreated.context;
      this.agent2Page = recreated.page;
      this.setupPageConsoleLogging(this.agent2Page, true);
    };

    let attempt = 0;
    await this.retryOperation(
      async () => {
        await ensureFreshAgent2Page(attempt > 0);
        attempt += 1;

        return pageSetup(this.agent2Page, LOGIN_MODE.DESKTOP, envTokens.agent2AccessToken);
      },
      'agent2 desktop station setup',
      this.maxRetries,
      PAGE_SETUP_ATTEMPT_TIMEOUT_MS
    );
  }

  private async setupAgent3(envTokens: EnvTokens): Promise<void> {
    const ensureFreshAgent3Page = async (forceRecreate = false): Promise<void> => {
      if (!forceRecreate && this.agent3Page && !this.agent3Page.isClosed()) {
        return;
      }

      if (!this.agent3Context) {
        throw new Error('Agent3 context is unavailable for recreation');
      }

      const browser = this.agent3Context.browser();
      if (!browser) {
        throw new Error('Browser is unavailable for agent3 page recreation');
      }

      await this.agent3Context.close().catch(() => {});
      const recreated = await this.createContextWithPage(browser, PAGE_TYPES.AGENT3);
      this.agent3Context = recreated.context;
      this.agent3Page = recreated.page;
      this.setupPageConsoleLogging(this.agent3Page, true);
    };

    let attempt = 0;
    await this.retryOperation(
      async () => {
        await ensureFreshAgent3Page(attempt > 0);
        attempt += 1;

        return pageSetup(this.agent3Page, LOGIN_MODE.DESKTOP, envTokens.agent3AccessToken);
      },
      'agent3 desktop station setup',
      this.maxRetries,
      PAGE_SETUP_ATTEMPT_TIMEOUT_MS
    );
  }

  private async setupAgent4(envTokens: EnvTokens): Promise<void> {
    const ensureFreshAgent4Page = async (forceRecreate = false): Promise<void> => {
      if (!forceRecreate && this.agent4Page && !this.agent4Page.isClosed()) {
        return;
      }

      if (!this.agent4Context) {
        throw new Error('Agent4 context is unavailable for recreation');
      }

      const browser = this.agent4Context.browser();
      if (!browser) {
        throw new Error('Browser is unavailable for agent4 page recreation');
      }

      await this.agent4Context.close().catch(() => {});
      const recreated = await this.createContextWithPage(browser, PAGE_TYPES.AGENT4);
      this.agent4Context = recreated.context;
      this.agent4Page = recreated.page;
      this.setupPageConsoleLogging(this.agent4Page, true);
    };

    let attempt = 0;
    await this.retryOperation(
      async () => {
        await ensureFreshAgent4Page(attempt > 0);
        attempt += 1;

        return pageSetup(this.agent4Page, LOGIN_MODE.DESKTOP, envTokens.agent4AccessToken);
      },
      'agent4 desktop station setup',
      this.maxRetries,
      PAGE_SETUP_ATTEMPT_TIMEOUT_MS
    );
  }

  private async setupDialNumber(envTokens: EnvTokens): Promise<void> {
    await this.retryOperation(
      () => loginExtension(this.dialNumberPage, envTokens.dialNumberLoginAccessToken),
      'dial number login',
      this.maxRetries,
      LOGIN_SETUP_ATTEMPT_TIMEOUT_MS
    );
  }

  private async setupCaller(config: Required<SetupConfig>, envTokens: EnvTokens): Promise<void> {
    const callerToken =
      envTokens.callerAccessToken ||
      (config.needsAgent2 && !config.needDialNumberLogin
        ? envTokens.dialNumberLoginAccessToken
        : undefined) ||
      envTokens.agent2AccessToken ||
      envTokens.dialNumberLoginAccessToken;

    const ensureFreshCallerPage = async (forceRecreate = false): Promise<void> => {
      if (!forceRecreate && this.callerPage && !this.callerPage.isClosed()) {
        return;
      }

      if (!this.callerExtensionContext) {
        throw new Error('Caller context is unavailable for recreation');
      }

      const browser = this.callerExtensionContext.browser();
      if (!browser) {
        throw new Error('Browser is unavailable for caller page recreation');
      }

      await this.callerExtensionContext.close().catch(() => {});
      const recreated = await this.createContextWithPage(browser, PAGE_TYPES.CALLER);
      this.callerExtensionContext = recreated.context;
      this.callerPage = recreated.page;
      this.setupPageConsoleLogging(this.callerPage, config.enableConsoleLogging);
    };

    let attempt = 0;
    await this.retryOperation(
      async () => {
        await ensureFreshCallerPage(attempt > 0);
        attempt += 1;

        return loginExtension(this.callerPage!, callerToken ?? '');
      },
      'caller extension login',
      this.maxRetries,
      LOGIN_SETUP_ATTEMPT_TIMEOUT_MS
    );
  }

  private async setupMultiSessionFlow(
    config: Required<SetupConfig>,
    envTokens: EnvTokens
  ): Promise<void> {
    const ensureFreshMultiSessionPage = async (forceRecreate = false): Promise<void> => {
      if (
        !forceRecreate &&
        this.multiSessionAgent1Page &&
        !this.multiSessionAgent1Page.isClosed()
      ) {
        return;
      }

      if (!this.multiSessionContext) {
        throw new Error('Multi-session context is unavailable for recreation');
      }

      const browser = this.multiSessionContext.browser();
      if (!browser) {
        throw new Error('Browser is unavailable for multi-session page recreation');
      }

      await this.multiSessionContext.close().catch(() => {});
      const recreated = await this.createContextWithPage(browser, PAGE_TYPES.MULTI_SESSION);
      this.multiSessionContext = recreated.context;
      this.multiSessionAgent1Page = recreated.page;
      this.setupPageConsoleLogging(this.multiSessionAgent1Page, config.enableConsoleLogging);
    };

    if (config.agent1LoginMode === LOGIN_MODE.EXTENSION) {
      let attempt = 0;
      await this.retryOperation(
        async () => {
          await ensureFreshMultiSessionPage(attempt > 0);
          attempt += 1;

          return pageSetup(
            this.multiSessionAgent1Page!,
            LOGIN_MODE.EXTENSION,
            envTokens.agent1AccessToken,
            envTokens.agent1ExtensionNumber,
            true,
            false
          );
        },
        'multi-session agent1 extension station setup',
        this.maxRetries,
        PAGE_SETUP_ATTEMPT_TIMEOUT_MS
      );
    } else if (config.agent1LoginMode === LOGIN_MODE.DIAL_NUMBER) {
      let attempt = 0;
      await this.retryOperation(
        async () => {
          await ensureFreshMultiSessionPage(attempt > 0);
          attempt += 1;

          return pageSetup(
            this.multiSessionAgent1Page!,
            LOGIN_MODE.DIAL_NUMBER,
            envTokens.agent1AccessToken,
            envTokens.entryPoint,
            true,
            false
          );
        },
        'multi-session agent1 dial-number station setup',
        this.maxRetries,
        PAGE_SETUP_ATTEMPT_TIMEOUT_MS
      );
    }
  }

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

    this.agent1Context = await browser.newContext({ignoreHTTPSErrors: true});
    this.agent1Page = await this.agent1Context.newPage();
    this.consoleMessages = [];
    this.setupPageConsoleLogging(this.agent1Page, true);

    await pageSetup(
      this.agent1Page,
      LOGIN_MODE.DESKTOP,
      envTokens.agent1AccessToken,
      undefined,
      false,
      true
    );

    await this.safeStationLogout(this.agent1Page);

    // Ensure station login widget is visible
    await this.verifyStationLoginWidgets();
  }

  async setupForStationLoginMultiSession(browser: Browser, loginMode: LoginMode): Promise<void> {
    await this.setup(browser, {
      needsAgent1: true,
      needsMultiSession: true,
      agent1LoginMode: loginMode,
      enableConsoleLogging: true,
      enableAdvancedLogging: false,
    });
  }

  async setupForUserStateMultiSession(browser: Browser): Promise<void> {
    await this.setup(browser, {
      needsAgent1: true,
      needsMultiSession: true,
      agent1LoginMode: LOGIN_MODE.EXTENSION,
      enableConsoleLogging: true,
      enableAdvancedLogging: false,
    });
  }

  private async verifyStationLoginWidgets(): Promise<void> {
    await expect(this.agent1Page.locator('#AgentLogin')).toBeVisible({timeout: AWAIT_TIMEOUT});
  }

  async setupForIncomingTaskDesktop(browser: Browser) {
    await this.setup(browser, {
      needsAgent1: true,
      needsCaller: true,
      agent1LoginMode: LOGIN_MODE.DESKTOP,
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
    const boundedCleanup = async (
      operation: () => Promise<unknown>,
      timeoutMs = 5000
    ): Promise<void> => {
      await Promise.race([operation().catch(() => {}), sleep(timeoutMs)]);
    };

    // First handle any stray tasks
    await boundedCleanup(() => this.softCleanup(), 8000);

    // Logout operations - can be done in parallel
    const logoutOperations: Promise<void>[] = [];

    if (this.agent1Page) {
      logoutOperations.push(boundedCleanup(() => this.safeStationLogout(this.agent1Page)));
    }

    if (this.multiSessionAgent1Page) {
      logoutOperations.push(
        boundedCleanup(() => this.safeStationLogout(this.multiSessionAgent1Page))
      );
    }

    if (this.agent2Page) {
      logoutOperations.push(boundedCleanup(() => this.safeStationLogout(this.agent2Page)));
    }

    if (this.agent3Page) {
      logoutOperations.push(boundedCleanup(() => this.safeStationLogout(this.agent3Page)));
    }

    if (this.agent4Page) {
      logoutOperations.push(boundedCleanup(() => this.safeStationLogout(this.agent4Page)));
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
        cleanupOperations.push(boundedCleanup(() => page.close()));
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
        cleanupOperations.push(boundedCleanup(() => context.close()));
      }
    });

    await Promise.all(cleanupOperations);
  }
}
