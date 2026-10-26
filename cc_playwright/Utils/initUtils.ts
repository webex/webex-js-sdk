import {Page, expect, BrowserContext} from '@playwright/test';
import dotenv from 'dotenv';
import * as path from 'path';
import {BASE_URL, AWAIT_TIMEOUT, UI_SETTLE_TIMEOUT, OPERATION_TIMEOUT} from '../constants';

dotenv.config({path: path.resolve(__dirname, '../.env')});

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Performs login using an access token from environment variables
 * @param page - The Playwright page object
 * @param agentId - Agent identifier to get access token for (e.g., 'AGENT1', 'AGENT2')
 * @description Requires PW_{agentId}_ACCESS_TOKEN environment variable to be set
 * @throws {Error} When PW_{agentId}_ACCESS_TOKEN environment variable is not defined
 * @example
 * ```typescript
 * // Ensure PW_AGENT1_ACCESS_TOKEN is set in .env file
 * await loginViaAccessToken(page, 'AGENT1');
 *
 * // Different agents with their own access tokens
 * await loginViaAccessToken(page, 'AGENT2'); // Uses PW_AGENT2_ACCESS_TOKEN
 * await loginViaAccessToken(page, 'ADMIN');  // Uses PW_ADMIN_ACCESS_TOKEN
 * ```
 */
export const loginViaAccessToken = async (page: Page, accessToken: string): Promise<void> => {
  await page.goto(BASE_URL, {waitUntil: 'domcontentloaded'});
  await page.evaluate(() => {
    const win = window as unknown as {
      generateWebexConfig?: (args: {credentials?: unknown}) => Record<string, unknown>;
    };

    const originalGenerateWebexConfig = win.generateWebexConfig;
    if (typeof originalGenerateWebexConfig !== 'function') {
      return;
    }

    win.generateWebexConfig = (args) => {
      const config = originalGenerateWebexConfig(args);
      const currentCcConfig =
        config.cc && typeof config.cc === 'object' ? (config.cc as Record<string, unknown>) : {};

      return {
        ...config,
        cc: {
          ...currentCcConfig,
          allowAutomatedRelogin: false,
        },
      };
    };
  });
  if (!accessToken) {
    throw new Error(`ACCESS_TOKEN is not defined, OAuth failed`);
  }
  const accessTokenInput = page.locator('#access-token');
  await expect(accessTokenInput).toBeVisible({timeout: AWAIT_TIMEOUT});
  await accessTokenInput.fill(accessToken, {timeout: AWAIT_TIMEOUT});
};

/**
 * Performs OAuth login with Webex using agent credentials from environment variables
 * @param page - The Playwright page object
 * @param agentId - Agent identifier to validate against environment variables (e.g., 'SET_1_AGENT1', 'SET_2_AGENT2')
 * @param customPassword - Optional custom password. If not provided, uses PW_SANDBOX_PASSWORD from environment
 * @description Validates credentials against {agentId}_USERNAME and PW_SANDBOX_PASSWORD (or custom password)
 * @throws {Error} When agent credentials are not found in environment variables
 * @example
 * ```typescript
 * // OAuth login with agent credentials from environment variables
 * await oauthLogin(page, 'SET_1_AGENT1'); // validates against SET_1_AGENT1_USERNAME/PW_SANDBOX_PASSWORD
 * await oauthLogin(page, 'SET_1_AGENT2'); // validates against SET_1_AGENT2_USERNAME/PW_SANDBOX_PASSWORD
 * await oauthLogin(page, 'SET_2_AGENT1'); // validates against SET_2_AGENT1_USERNAME/PW_SANDBOX_PASSWORD
 * await oauthLogin(page, 'custom_user', 'custom_password'); // uses custom password
 * ```
 */
export const oauthLogin = async (
  page: Page,
  username: string,
  customPassword?: string,
  retryAttempt = 0
): Promise<void> => {
  // Check 1: Validate username parameter is provided
  if (!username) {
    throw new Error('Username parameter is required');
  }

  // Check 2: Validate username is not empty string
  if (username.trim() === '') {
    throw new Error('Username cannot be empty string');
  }

  // Check 3: Get credentials from environment variables or use custom password
  const password = customPassword || process.env.PW_SANDBOX_PASSWORD;
  // Check 6: Validate environment variables are set
  if (!username || !password) {
    throw new Error(`Environment variables ${username} and PW_SANDBOX_PASSWORD must be set`);
  }

  await page.goto(BASE_URL, {waitUntil: 'domcontentloaded'});

  // Wait for Webex SDK to be loaded (required for OAuth flow)
  await page.waitForFunction(() => typeof (window as any).Webex !== 'undefined', {
    timeout: AWAIT_TIMEOUT,
  });

  // Wait for auth dropdown to be ready
  const authTypeDropdown = page.locator('#auth-type');
  await authTypeDropdown.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
  await authTypeDropdown.selectOption('oauth', {timeout: AWAIT_TIMEOUT});

  // Wait for OAuth form to become visible and SDK to initialize
  const oauthLoginButton = page.locator('#oauth-login-btn');
  await oauthLoginButton.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});

  // Wait for webex instance to be ready for OAuth
  await page.waitForFunction(
    () => {
      const webex = (window as any).webex;

      return (
        webex && webex.authorization && typeof webex.authorization.initiateLogin === 'function'
      );
    },
    {timeout: AWAIT_TIMEOUT}
  );

  // OAuth login redirects to Webex login page - wait for navigation with extended timeout
  await oauthLoginButton.click({timeout: AWAIT_TIMEOUT, noWaitAfter: true});
  await page.waitForURL(
    (url) =>
      /idbroker(?:-[a-z0-9]+)?\.webex\.com/i.test(url.hostname) ||
      url.toString().includes('id.webex.com'),
    {
      timeout: OPERATION_TIMEOUT,
      waitUntil: 'commit',
    }
  );

  const usernameFieldByRole = page.getByRole('textbox', {name: 'name@example.com'});
  const usernameFieldBySelector = page.locator(
    '#IDToken1, input[type="email"], input[name="IDToken1"], input[autocomplete="username"]'
  );
  const roleFieldVisible = await usernameFieldByRole.isVisible().catch(() => false);
  if (roleFieldVisible) {
    await usernameFieldByRole.fill(username, {timeout: AWAIT_TIMEOUT});
  } else {
    await usernameFieldBySelector.first().waitFor({state: 'visible', timeout: OPERATION_TIMEOUT});
    await usernameFieldBySelector.first().fill(username, {timeout: AWAIT_TIMEOUT});
  }

  // Click "Sign in" link triggers navigation to password page
  const signInLink = page.getByRole('link', {name: 'Sign in'});
  const signInButton = page.getByRole('button', {name: 'Sign in'});
  const passwordTextbox = page.getByRole('textbox', {name: 'Password'});
  const passwordInputFallback = page.locator(
    '#IDToken2, input[type="password"], input[name="IDToken2"], input[name="password"]'
  );
  const usernameInput = usernameFieldBySelector.first();
  const clickSignIn = async () =>
    ((await signInLink.isVisible().catch(() => false)) ? signInLink : signInButton).click({
      timeout: AWAIT_TIMEOUT,
      noWaitAfter: true,
    });

  /* eslint-disable no-await-in-loop */
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await clickSignIn();
    await Promise.race([
      passwordInputFallback.first().waitFor({state: 'visible', timeout: AWAIT_TIMEOUT}),
      page.waitForURL((url) => url.toString().includes(BASE_URL), {
        timeout: AWAIT_TIMEOUT,
        waitUntil: 'commit',
      }),
    ]).catch(() => {});

    if (page.url().includes(BASE_URL)) {
      return;
    }
    if (
      await passwordInputFallback
        .first()
        .isVisible()
        .catch(() => false)
    ) {
      break;
    }
    if (await usernameInput.isVisible().catch(() => false)) {
      await usernameInput.fill(username, {timeout: AWAIT_TIMEOUT});
    }
    await sleep(500);
  }
  /* eslint-enable no-await-in-loop */

  const passwordByRoleVisible = await passwordTextbox.isVisible().catch(() => false);
  const passwordInput = passwordByRoleVisible ? passwordTextbox : passwordInputFallback.first();
  await passwordInput.waitFor({state: 'visible', timeout: OPERATION_TIMEOUT});
  await passwordInput.fill(password, {timeout: AWAIT_TIMEOUT});

  const passwordSignInButton = page.getByRole('button', {name: 'Sign in'});
  const passwordSubmitControl = page.locator(
    'button[type="submit"], input[type="submit"], button:has-text("Sign in"), input[value="Sign in"]'
  );
  if (await passwordSignInButton.isVisible().catch(() => false)) {
    await passwordSignInButton.click({timeout: AWAIT_TIMEOUT, noWaitAfter: true});
  } else if (
    await passwordSubmitControl
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await passwordSubmitControl.first().click({timeout: AWAIT_TIMEOUT, noWaitAfter: true});
  } else {
    await passwordInput.press('Enter', {timeout: AWAIT_TIMEOUT});
  }

  try {
    // Wait for redirect back to sample app with extended timeout for OAuth flow
    await page.waitForURL((url) => url.toString().includes(BASE_URL), {
      timeout: OPERATION_TIMEOUT,
      waitUntil: 'commit',
    });
  } catch (error) {
    const alreadyOnSample = page.url().includes(BASE_URL);
    if (alreadyOnSample) {
      return;
    }

    await sleep(500);
    const bodyText = await page
      .locator('body')
      .innerText({timeout: 5000})
      .catch(() => '');
    const wasSignedOut = /automatically signed out|sign in again/i.test(bodyText);
    if (!wasSignedOut || retryAttempt >= 3) {
      throw error;
    }

    await page
      .context()
      .clearCookies()
      .catch(() => {});
    await page.goto(BASE_URL, {waitUntil: 'domcontentloaded'}).catch(() => {});
    await oauthLogin(page, username, customPassword, retryAttempt + 1);
  }
};

/**
 * Initializes the Webex SDK by clicking the webex.init() button
 * @param page - The Playwright page object
 * @description Clicks the access-token-save button which calls webex.init()
 * @throws {Error} When SDK initialization fails
 * @example
 * ```typescript
 * await loginViaAccessToken(page, accessToken);
 * await initializeSdk(page);
 * ```
 */
export const initializeSdk = async (page: Page): Promise<void> => {
  const initButton = page.locator('#access-token-save');
  await expect(initButton).toBeVisible({timeout: AWAIT_TIMEOUT});
  await initButton.click({timeout: AWAIT_TIMEOUT});

  // Wait for webexcc-register button to become enabled
  const registerButton = page.locator('#webexcc-register');
  await expect(registerButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
};

export const setMultiLoginToggle = async (page: Page, enabled: boolean): Promise<void> => {
  const multiLoginToggle = page.locator('#multiLoginFlag');
  await expect(multiLoginToggle).toBeVisible({timeout: AWAIT_TIMEOUT});
  await page.evaluate((shouldEnable) => {
    const checkbox = document.querySelector<HTMLInputElement>('#multiLoginFlag');
    if (!checkbox) {
      return;
    }

    checkbox.checked = shouldEnable;
    localStorage.setItem('isMultiLoginEnabled', String(shouldEnable));
    checkbox.dispatchEvent(new Event('change', {bubbles: true}));
  }, enabled);

  await expect
    .poll(
      () =>
        page.evaluate(() => ({
          checked: document.querySelector<HTMLInputElement>('#multiLoginFlag')?.checked ?? false,
          stored: localStorage.getItem('isMultiLoginEnabled'),
        })),
      {timeout: AWAIT_TIMEOUT, intervals: [100, 250, 500]}
    )
    .toEqual({checked: enabled, stored: String(enabled)});
  await sleep(UI_SETTLE_TIMEOUT);
};

/**
 * Registers with contact center by clicking the webex.cc.register() button
 * @param page - The Playwright page object
 * @description Clicks the webexcc-register button which calls webex.cc.register()
 * @throws {Error} When CC registration fails
 * @example
 * ```typescript
 * await initializeSdk(page);
 * await registerContactCenter(page);
 * ```
 */
export const registerContactCenter = async (
  page: Page,
  retryStaleRegistration = true
): Promise<void> => {
  const registerButton = page.locator('#webexcc-register');
  const unregisterButton = page.locator('#webexcc-deregister');
  const getRegistrationSnapshot = async () => {
    const statusText = (
      await page
        .locator('#ws-connection-status')
        .textContent()
        .catch(() => '')
    ).trim();
    const teamsCount = await page
      .locator('#teamsDropdown option:not([value=""])')
      .count()
      .catch(() => 0);
    const loginCount = await page
      .locator('#AgentLogin option:not([value=""])')
      .count()
      .catch(() => 0);
    const registerEnabled = await registerButton.isEnabled().catch(() => false);
    const unregisterEnabled = await unregisterButton.isEnabled().catch(() => false);

    return {
      statusText,
      teamsCount,
      loginCount,
      registerEnabled,
      unregisterEnabled,
    };
  };
  const isAlreadyRegistered = await unregisterButton.isEnabled().catch(() => false);

  if (isAlreadyRegistered) {
    const snapshot = await getRegistrationSnapshot();

    if (
      snapshot.statusText === 'Subscribed' &&
      snapshot.teamsCount > 0 &&
      snapshot.loginCount > 0
    ) {
      return;
    }

    await page
      .evaluate(() => {
        document.querySelector<HTMLButtonElement>('#webexcc-deregister')?.click();
      })
      .catch(() => {});
    await expect(registerButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
    await sleep(1000);
  }

  try {
    await expect(registerButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
    await page.evaluate(async (timeoutMs) => {
      const win = window as unknown as {
        register?: () => void;
        webex?: {
          cc?: {
            register?: (...args: unknown[]) => Promise<unknown>;
          };
          internal?: {
            services?: {
              waitForCatalog?: (catalog: string) => Promise<unknown>;
            };
          };
        };
      };

      const registerFn = win.register;
      const ccRegister = win.webex?.cc?.register;
      if (typeof registerFn !== 'function' || typeof ccRegister !== 'function') {
        throw new Error('Contact Center register() is unavailable on the page');
      }

      await win.webex?.internal?.services?.waitForCatalog?.('postauth');

      await new Promise<void>((resolve, reject) => {
        const originalRegister = ccRegister.bind(win.webex!.cc);
        let settled = false;

        const restore = () => {
          if (win.webex?.cc) {
            win.webex.cc.register = originalRegister;
          }
        };

        const timer = window.setTimeout(() => {
          if (settled) {
            return;
          }

          settled = true;
          restore();
          reject(new Error(`webex.cc.register() timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        win.webex!.cc!.register = (...args: unknown[]) => {
          const registerPromise = originalRegister(...args);

          Promise.resolve(registerPromise).then(
            () => {
              if (settled) {
                return;
              }

              settled = true;
              window.clearTimeout(timer);
              restore();
              resolve();
            },
            (error) => {
              if (settled) {
                return;
              }

              settled = true;
              window.clearTimeout(timer);
              restore();
              reject(error instanceof Error ? error : new Error(String(error)));
            }
          );

          return registerPromise;
        };

        try {
          registerFn();
        } catch (error) {
          if (settled) {
            return;
          }

          settled = true;
          window.clearTimeout(timer);
          restore();
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    }, OPERATION_TIMEOUT);

    await expect
      .poll(
        async () => {
          const snapshot = await getRegistrationSnapshot();

          return snapshot.statusText === 'Subscribed' || snapshot.unregisterEnabled;
        },
        {timeout: 10000, intervals: [500, 1000, 2000]}
      )
      .toBeTruthy();

    await expect
      .poll(
        async () => {
          const snapshot = await getRegistrationSnapshot();

          return (
            snapshot.statusText === 'Subscribed' &&
            snapshot.teamsCount > 0 &&
            snapshot.loginCount > 0
          );
        },
        {timeout: 45000, intervals: [500, 1000, 2000]}
      )
      .toBeTruthy();

    await page.locator('#teamsDropdown option:not([value=""])').first().waitFor({
      state: 'attached',
      timeout: 45000,
    });

    await page.locator('#AgentLogin option:not([value=""])').first().waitFor({
      state: 'attached',
      timeout: 10000,
    });
  } catch (error) {
    const snapshot = await getRegistrationSnapshot().catch(() => ({
      statusText: 'unknown',
      teamsCount: 0,
      loginCount: 0,
    }));

    if (retryStaleRegistration && !page.isClosed()) {
      await page
        .evaluate(() => {
          document.querySelector<HTMLButtonElement>('#webexcc-deregister')?.click();
        })
        .catch(() => {});
      await sleep(2000);

      let registerEnabledAfterReset = await registerButton.isEnabled().catch(() => false);
      if (!registerEnabledAfterReset) {
        await page.reload({waitUntil: 'domcontentloaded'}).catch(() => {});
        await sleep(3000);

        const initButton = page.locator('#access-token-save');
        registerEnabledAfterReset = await registerButton.isEnabled().catch(() => false);
        const initEnabled = await initButton.isEnabled().catch(() => false);
        if (!registerEnabledAfterReset && initEnabled) {
          await initializeSdk(page).catch(() => {});
        }
      }

      await registerContactCenter(page, false);

      return;
    }

    throw new Error(
      `Failed to register with Contact Center. ` +
        `Last error: ${error}. ` +
        `Current state: WS=${snapshot.statusText}, Teams options=${snapshot.teamsCount}, ` +
        `Login options=${snapshot.loginCount}`
    );
  }
};

/**
 * Reloads the page to simulate agent refresh
 * @param page - The Playwright page object
 * @description Useful for testing state persistence after page reload
 * @example
 * ```typescript
 * // Test state persistence
 * await changeUserState(page, 'Available');
 * await agentRelogin(page); // State should persist after reload
 * ```
 */
export const agentRelogin = async (page: Page): Promise<void> => {
  await page.reload();
  await sleep(UI_SETTLE_TIMEOUT);
};

/**
 * Ensures SDK is registered after page reload
 * @param page - The Playwright page object
 * @description Checks if WebSocket is subscribed, and if not, re-initializes and re-registers
 * @throws {Error} When registration fails
 * @example
 * ```typescript
 * await page.reload();
 * await ensureRegisteredAfterReload(page);
 * ```
 */
export const ensureRegisteredAfterReload = async (page: Page): Promise<void> => {
  await page.waitForLoadState('domcontentloaded');
  await sleep(3000);

  const currentStatus = await page.locator('#ws-connection-status').textContent();
  const isSubscribed = currentStatus?.trim() === 'Subscribed';

  if (!isSubscribed) {
    const registerButton = page.locator('#webexcc-register');
    const initButton = page.locator('#access-token-save');

    // Wait for SDK initialization to complete (either button state is stable)
    const isRegisterEnabled = await registerButton.isEnabled().catch(() => false);

    if (!isRegisterEnabled) {
      const isInitEnabled = await initButton.isEnabled().catch(() => false);

      if (isInitEnabled) {
        await initializeSdk(page);
      } else {
        await expect(registerButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
      }
    }

    await sleep(5000);

    await registerContactCenter(page);
  }

  await page
    .locator('#teamsDropdown option:not([value=""])')
    .first()
    .waitFor({state: 'attached', timeout: OPERATION_TIMEOUT});

  await page
    .locator('#AgentLogin option:not([value=""])')
    .first()
    .waitFor({state: 'attached', timeout: OPERATION_TIMEOUT});
};

/**
 * Creates a new page in the same browser context for multi-session testing
 * @param context - The Playwright browser context
 * @returns Promise<Page> - The new page ready for use
 * @description Useful for testing multi-session scenarios
 * @example
 * ```typescript
 * const context = await browser.newContext();
 * const primaryPage = await context.newPage();
 * const secondaryPage = await setupMultiLoginPage(context);
 *
 * // Test state synchronization between pages
 * await changeUserState(primaryPage, 'Available');
 * await verifyCurrentState(secondaryPage, 'Available');
 * ```
 */
export const setupMultiLoginPage = async (context: BrowserContext): Promise<Page> => {
  const multiLoginPage = await context.newPage();
  await multiLoginPage.goto(BASE_URL);

  return multiLoginPage;
};
