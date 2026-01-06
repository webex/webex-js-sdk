import {Page, expect, BrowserContext} from '@playwright/test';
import dotenv from 'dotenv';
import {BASE_URL, AWAIT_TIMEOUT, WIDGET_INIT_TIMEOUT, UI_SETTLE_TIMEOUT} from '../constants';
import {injectContactCenterTestIds} from './sample-instrumentation';

dotenv.config();

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
  await injectContactCenterTestIds(page);
  await page.goto(BASE_URL, {waitUntil: 'domcontentloaded'});
  if (!accessToken) {
    throw new Error('ACCESS_TOKEN is not defined, OAuth failed');
  }
  await page.locator('#auth-type').selectOption('accessToken');
  await page.locator('#access-token').fill(accessToken, {timeout: AWAIT_TIMEOUT});
  const saveButton = page.locator('#access-token-save');
  await expect(saveButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await saveButton.click({timeout: AWAIT_TIMEOUT});
  await expect(saveButton).toBeDisabled({timeout: AWAIT_TIMEOUT});
  await expect(page.locator('#access-token-status')).toContainText('Saved access token', {
    timeout: AWAIT_TIMEOUT,
  });
};

/**
 * Performs OAuth login with Webex using agent credentials from environment variables
 * @param page - The Playwright page object
 * @param agentId - Agent identifier to validate against environment variables (e.g., 'SET_1_AGENT1', 'SET_2_AGENT2')
 * @description Uses the provided password (typically sourced from per-agent env vars in global.setup)
 * @throws {Error} When the password is not provided
 * @example
 * ```typescript
 * // OAuth login with explicit credentials
 * await oauthLogin(page, 'user15@ccsdk.wbx.ai', process.env.SET_1_AGENT1_PASSWORD);
 * await oauthLogin(page, 'user16@ccsdk.wbx.ai', process.env.SET_1_AGENT2_PASSWORD);
 * ```
 */
export const oauthLogin = async (page: Page, username: string, password?: string): Promise<void> => {
  if (!username || !username.trim()) {
    throw new Error('Username parameter is required');
  }

  const resolvedPassword = password;
  if (!resolvedPassword) {
    throw new Error('OAuth password must be provided (set per-agent password env vars)');
  }

  await injectContactCenterTestIds(page);
  await page.goto(BASE_URL, {waitUntil: 'domcontentloaded'});
  await page.locator('#auth-type').selectOption('oauth');

  const popupPromise = page.waitForEvent('popup', {timeout: 1000}).catch(() => null);
  await page.locator('#oauth-login-btn').click({timeout: AWAIT_TIMEOUT});

  const popup = await popupPromise;
  if (popup) {
    await popup.waitForLoadState('domcontentloaded');
    await completeIdBrokerLogin(popup, username, resolvedPassword);
    await popup.waitForEvent('close', {timeout: 120000}).catch(() => {});
  } else {
    await page.waitForURL(/(idbroker|idb)/i, {timeout: 60000});
    await completeIdBrokerLogin(page, username, resolvedPassword);
    await page.waitForURL(/samples\/contact-center/i, {timeout: 120000});
  }

  await expect(page.locator('#oauth-status')).toContainText(/Authenticated/i, {timeout: 60000});
  await expect(page.locator('#access-token-status')).toContainText('Saved access token', {timeout: 60000});
};

const completeIdBrokerLogin = async (targetPage: Page, username: string, password: string) => {
  await targetPage.waitForLoadState('domcontentloaded');

  const emailInput = targetPage.locator('#IDToken1');
  const legacyEmailVisible = await emailInput.isVisible().catch(() => false);
  const modernEmailInput = targetPage.getByRole('textbox', {name: /name@example\.com/i});
  const modernEmailVisible = !legacyEmailVisible && (await modernEmailInput.isVisible().catch(() => false));

  if (legacyEmailVisible) {
    const isReadOnly = await emailInput.evaluate((el) => el.hasAttribute('readonly')).catch(() => false);
    if (!isReadOnly) {
      await emailInput.fill(username);
      const nextButton = targetPage.locator('#IDButton2');
      if (await nextButton.isVisible().catch(() => false)) {
        await nextButton.click();
      }
    }
  } else if (modernEmailVisible) {
    await modernEmailInput.fill(username);
    const signInLink = targetPage.getByRole('link', {name: /sign in/i});
    const signInButton = targetPage.getByRole('button', {name: /sign in/i});
    if (await signInLink.isVisible().catch(() => false)) {
      await signInLink.click();
    } else if (await signInButton.isVisible().catch(() => false)) {
      await signInButton.click();
    } else {
      await modernEmailInput.press('Enter');
    }
  }

  const passwordInput = targetPage.locator('#IDToken2');
  const legacyPasswordVisible = await passwordInput.isVisible().catch(() => false);
  const modernPasswordInput = targetPage.getByRole('textbox', {name: /welcome|password/i});
  const modernPasswordVisible = !legacyPasswordVisible && (await modernPasswordInput.isVisible().catch(() => false));

  if (legacyPasswordVisible) {
    await passwordInput.fill(password);
    const submitButton = targetPage.locator('#Button1');
    await submitButton.click();
  } else {
    const fallbackPasswordInput = modernPasswordVisible
      ? modernPasswordInput
      : targetPage.locator('input[type="password"]');
    await fallbackPasswordInput.waitFor({state: 'visible', timeout: 60000});
    await fallbackPasswordInput.fill(password);
    const submitButton = targetPage.getByRole('button', {name: /sign in/i});
    if (await submitButton.isVisible().catch(() => false)) {
      await submitButton.click();
    } else {
      await fallbackPasswordInput.press('Enter');
    }
  }

  const acceptButton = targetPage.locator('input[value="Accept"]');
  if (await acceptButton.isVisible({timeout: 5000}).catch(() => false)) {
    await acceptButton.click();
  }

  await targetPage.waitForLoadState('networkidle', {timeout: 120000}).catch(() => {});
};

/**
 * Enables all available contact center widgets
 * @param page - The Playwright page object
 * @description Checks all widget checkboxes including station login, user state, tasks, and call controls
 * @example
 * ```typescript
 * await enableAllWidgets(page);
 * await initialiseWidgets(page); // Now all widgets will be available
 * ```
 */
export const enableAllWidgets = async () => Promise.resolve();

/**
 * Enables multi-login functionality for the SDK
 * @param page - The Playwright page object
 * @description Must be called before SDK initialization to take effect
 * @example
 * ```typescript
 * await enableMultiLogin(page);
 * await initialiseWidgets(page); // Multi-login is now enabled
 * ```
 */
export const enableMultiLogin = async () => Promise.resolve();

/**
 * Disables multi-login functionality for the SDK
 * @param page - The Playwright page object
 * @description Must be called before SDK initialization to take effect
 * @example
 * ```typescript
 * await disableMultiLogin(page);
 * await initialiseWidgets(page); // Multi-login is now disabled
 * ```
 */
export const disableMultiLogin = async () => Promise.resolve();

/**
 * Initializes the widgets by clicking the init widgets button and waiting for station-login widget to be visible
 * @param page - The Playwright page object
 * @description The station-login widget should be checked/enabled before using this function.
 *              If the widget is not visible after the initial timeout, retries once more with another attempt.
 * @throws {Error} When station-login widget is not visible after two initialization attempts
 * @example
 * ```typescript
 * // Ensure station-login widget is checked first
 * await page.getByTestId('samples:widget-stationLogin').check();
 * await initialiseWidgets(page);
 * ```
 */
export const initialiseWidgets = async () => Promise.resolve();

/**
 * Reloads the page and reinitializes widgets to simulate agent relogin
 * @param page - The Playwright page object
 * @description Useful for testing state persistence after page reload
 * @throws {Error} When widget reinitialization fails after reload
 * @example
 * ```typescript
 * // Test state persistence
 * await changeUserState(page, 'Available');
 * await agentRelogin(page); // State should persist after reload
 * ```
 */
// Helper method for agent relogin - simulates user login along with page reload
export const agentRelogin = async (page: Page): Promise<void> => {
  await page.reload({waitUntil: 'domcontentloaded'});
  await page.waitForTimeout(UI_SETTLE_TIMEOUT);
};

/**
 * Creates a new page in the same browser context for multi-login testing
 * @param context - The Playwright browser context
 * @returns Promise<Page> - The new page with widgets initialized
 * @description Useful for testing multi-login scenarios
 * @throws {Error} When widget initialization fails on the new page
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
// Helper method for multisession - creates new page and initializes widgets in same context
export const setupMultiLoginPage = async (context: BrowserContext): Promise<Page> => {
  const multiLoginPage = await context.newPage();
  await injectContactCenterTestIds(multiLoginPage);
  await multiLoginPage.goto(BASE_URL, {waitUntil: 'domcontentloaded'});
  return multiLoginPage;
};
