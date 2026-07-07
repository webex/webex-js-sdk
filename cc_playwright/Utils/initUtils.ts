import {Page, expect, BrowserContext} from '@playwright/test';
import dotenv from 'dotenv';
import * as path from 'path';
import {BASE_URL, AWAIT_TIMEOUT, UI_SETTLE_TIMEOUT, OPERATION_TIMEOUT} from '../constants';

dotenv.config({path: path.resolve(__dirname, '../.env')});

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
  customPassword?: string
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
  await Promise.all([
    page.waitForURL((url) => url.toString().includes('idbroker.webex.com'), {
      timeout: OPERATION_TIMEOUT,
    }),
    oauthLoginButton.click(),
  ]);

  // Fill in OAuth credentials on Webex login page
  await page
    .getByRole('textbox', {name: 'name@example.com'})
    .fill(username, {timeout: AWAIT_TIMEOUT});

  // Click "Sign in" link triggers navigation to password page
  await Promise.all([
    page.waitForLoadState('domcontentloaded', {timeout: OPERATION_TIMEOUT}),
    page.getByRole('link', {name: 'Sign in'}).click({timeout: AWAIT_TIMEOUT}),
  ]);

  await page.getByRole('textbox', {name: 'Password'}).fill(password, {timeout: AWAIT_TIMEOUT});
  await page.getByRole('button', {name: 'Sign in'}).click({timeout: AWAIT_TIMEOUT});

  // Wait for redirect back to sample app with extended timeout for OAuth flow
  await page.waitForURL((url) => url.toString().includes(BASE_URL), {
    timeout: OPERATION_TIMEOUT,
  });
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
export const registerContactCenter = async (page: Page): Promise<void> => {
  // Check if already registered
  const unregisterButton = page.locator('#webexcc-deregister');
  const isAlreadyRegistered = await unregisterButton.isEnabled().catch(() => false);

  if (isAlreadyRegistered) {
    // Already registered, verify teams loaded
    const teamsLoaded = await page
      .locator('#teamsDropdown option:not([value=""])')
      .first()
      .waitFor({state: 'attached', timeout: 5000})
      .then(() => true)
      .catch(() => false);

    if (teamsLoaded) {
      return;
    }
    // Teams not loaded despite being registered - fall through to re-register
  }

  // Try registration with retry on failure
  const maxRetries = 3;
  /* eslint-disable no-await-in-loop */
  // eslint-disable-next-line no-plusplus
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const registerButton = page.locator('#webexcc-register');
      await expect(registerButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
      await registerButton.click({timeout: AWAIT_TIMEOUT});

      // Wait for WebSocket to connect
      await expect(page.locator('#ws-connection-status')).toHaveText('Subscribed', {
        timeout: 45000,
      });

      // Wait for teams to populate - this confirms agent profile loaded
      await page.locator('#teamsDropdown option:not([value=""])').first().waitFor({
        state: 'attached',
        timeout: 45000,
      });

      // Verify login dropdown also populated
      await page.locator('#AgentLogin option:not([value=""])').first().waitFor({
        state: 'attached',
        timeout: 10000,
      });

      return; // Success
    } catch (error) {
      if (attempt === maxRetries - 1) {
        // Get current state for debugging
        const wsStatus = await page
          .locator('#ws-connection-status')
          .textContent()
          .catch(() => 'unknown');
        const teamsCount = await page
          .locator('#teamsDropdown option')
          .count()
          .catch(() => 0);
        const loginCount = await page
          .locator('#AgentLogin option')
          .count()
          .catch(() => 0);

        throw new Error(
          `Failed to register with Contact Center after ${maxRetries} attempts. ` +
            `Last error: ${error}. ` +
            `Current state: WS=${wsStatus}, Teams options=${teamsCount}, Login options=${loginCount}`
        );
      }

      // Retry: reload page and re-initialize
      await page.reload();
      await page.waitForTimeout(3000);
      await initializeSdk(page);
    }
  }
  /* eslint-enable no-await-in-loop */
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
  await page.waitForTimeout(UI_SETTLE_TIMEOUT);
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
  // Wait for page to fully load and SDK auto-initialization
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(3000); // Critical: Wait for SDK auto-init from localStorage

  // Check WebSocket connection status
  const currentStatus = await page.locator('#ws-connection-status').textContent();
  const isSubscribed = currentStatus?.trim() === 'Subscribed';

  if (!isSubscribed) {
    const registerButton = page.locator('#webexcc-register');
    const initButton = page.locator('#access-token-save');

    // Wait for SDK initialization to complete (either button state is stable)
    const isRegisterEnabled = await registerButton.isEnabled().catch(() => false);

    if (!isRegisterEnabled) {
      // SDK not initialized yet
      const isInitEnabled = await initButton.isEnabled().catch(() => false);

      if (isInitEnabled) {
        await initializeSdk(page);
      } else {
        // Init button disabled but register not enabled - wait for auto-init
        await expect(registerButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
      }
    }

    // CRITICAL: After register button is enabled, wait for CC plugin to be fully initialized
    // The button enables when webex.init() completes, but webex.cc needs extra time
    // to complete internal initialization before register() can be called successfully
    await page.waitForTimeout(5000);

    // Register with CC using existing retry logic
    await registerContactCenter(page);
  }

  // Verify dropdowns are populated (confirms successful registration)
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
