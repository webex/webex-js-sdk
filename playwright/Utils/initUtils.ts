/* eslint-disable import/no-extraneous-dependencies */
import {BrowserContext, ConsoleMessage, Page} from '@playwright/test';
import dotenv from 'dotenv';
import {AWAIT_TIMEOUT, BASE_URL, OPERATION_TIMEOUT} from '../constants';
import {getSelector, requireEnvVar} from './helperUtils';

dotenv.config();

export interface CapturedConsole {
  messages: string[];
  dispose: () => void;
}

export interface SandboxEnvironment {
  sandbox: string;
  password: string;
  entryPoints: string[];
  chatUrl?: string;
  dialNumberAgent?: string;
}

async function fillFirstVisible(page: Page, selectors: string[], value: string): Promise<boolean> {
  // Sequential selector fallback - try each selector until one works
  // This must be sequential as we stop at the first visible element
  /* eslint-disable no-await-in-loop */
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      const isVisible = await locator.isVisible().catch(() => false);

      if (isVisible) {
        await locator.fill(value, {timeout: AWAIT_TIMEOUT});

        return true;
      }
    } catch {
      // Try next candidate selector.
    }
  }
  /* eslint-enable no-await-in-loop */

  return false;
}

async function clickFirstVisible(page: Page, selectors: string[]): Promise<boolean> {
  // Sequential selector fallback - try each selector until one works
  // This must be sequential as we stop at the first visible/enabled element
  /* eslint-disable no-await-in-loop, no-continue */
  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      const isVisible = await locator.isVisible().catch(() => false);

      if (!isVisible) continue;

      const disabled = await locator.isDisabled().catch(() => false);
      if (disabled) continue;

      await locator.click({timeout: AWAIT_TIMEOUT});

      return true;
    } catch {
      // Try next candidate selector.
    }
  }
  /* eslint-enable no-await-in-loop, no-continue */

  return false;
}

async function completeWebexLogin(
  loginPage: Page,
  username: string,
  password: string
): Promise<void> {
  await loginPage.waitForLoadState('domcontentloaded');

  const emailSelectors = [
    'input[type="email"]',
    'input[name="email"]',
    'input#email',
    'input[name="username"]',
    'input#IDToken1',
    'input[name="IDToken1"]',
  ];

  const passwordSelectors = [
    'input[type="password"]',
    'input[name="password"]',
    'input#password',
    'input#IDToken2',
    'input[name="IDToken2"]',
  ];

  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Next")',
    'button:has-text("Continue")',
    'button:has-text("Sign in")',
    'button:has-text("Sign In")',
    'a:has-text("Sign In")',
    'a:has-text("Sign in")',
    '[role="button"]:has-text("Sign In")',
  ];

  await fillFirstVisible(loginPage, emailSelectors, username);
  await clickFirstVisible(loginPage, submitSelectors);

  // Wait for navigation after clicking submit, then check for errors
  await loginPage.waitForLoadState('domcontentloaded', {timeout: 10000}).catch(() => {});

  // Check if we landed on a network error page
  const hasNetworkError = await loginPage
    .locator('h1:has-text("This site can"), h1:has-text("can\'t be reached")')
    .isVisible()
    .catch(() => false);

  if (hasNetworkError) {
    const errorText = await loginPage
      .locator('body')
      .innerText()
      .catch(() => 'Unknown error');
    throw new Error(
      `OAuth login failed: Network error reaching identity provider. ${errorText.substring(0, 200)}`
    );
  }

  await loginPage.waitForSelector(passwordSelectors.join(','), {timeout: OPERATION_TIMEOUT});
  await fillFirstVisible(loginPage, passwordSelectors, password);
  await clickFirstVisible(loginPage, submitSelectors);
}

export async function loginViaAccessToken(page: Page, accessToken: string): Promise<void> {
  if (!accessToken || !accessToken.trim()) {
    throw new Error('ACCESS_TOKEN is not defined or empty');
  }

  await page.goto(BASE_URL, {waitUntil: 'domcontentloaded'});
  await page.locator(getSelector('accessTokenInput')).fill(accessToken, {timeout: AWAIT_TIMEOUT});
  await page.locator(getSelector('accessTokenSubmit')).click({timeout: AWAIT_TIMEOUT});

  await page.waitForFunction(
    ({statusSelector, registerSelector}) => {
      const status = (document.querySelector(statusSelector)?.textContent || '').toLowerCase();
      const registerButton = document.querySelector(registerSelector) as HTMLButtonElement | null;

      return status.includes('saved access token') || (registerButton && !registerButton.disabled);
    },
    {
      statusSelector: getSelector('accessTokenStatus'),
      registerSelector: getSelector('registerButton'),
    },
    {timeout: OPERATION_TIMEOUT}
  );
}

export async function oauthLogin(
  page: Page,
  username: string,
  customPassword?: string
): Promise<void> {
  if (!username || !username.trim()) {
    throw new Error('Username parameter is required for OAuth login');
  }

  const password = customPassword || process.env.PW_SANDBOX_PASSWORD;
  if (!password || !password.trim()) {
    throw new Error('PW_SANDBOX_PASSWORD is required for OAuth login');
  }

  await page.goto(BASE_URL, {waitUntil: 'domcontentloaded'});
  await page.selectOption(getSelector('authTypeSelect'), {value: 'oauth'});

  const popupPromise = page.waitForEvent('popup', {timeout: 5000}).catch(() => null);
  await page.locator(getSelector('oauthLoginButton')).click({timeout: AWAIT_TIMEOUT});

  // Fast path: if OAuth already completed/session is reused, token appears without login form.
  const tokenReadyImmediately = await page
    .waitForFunction(
      ({tokenSelector}) => {
        const token =
          (document.querySelector(tokenSelector) as HTMLInputElement | null)?.value || '';
        const sessionToken = sessionStorage.getItem('access-token') || '';

        return token.trim().length > 20 || sessionToken.trim().length > 20;
      },
      {tokenSelector: getSelector('accessTokenInput')},
      {timeout: 5000}
    )
    .then(() => true)
    .catch(() => false);

  if (!tokenReadyImmediately) {
    const popup = await popupPromise;
    const authPage = popup ?? page;
    await completeWebexLogin(authPage, username, password);
  }

  await page.waitForFunction(
    ({tokenSelector}) => {
      const token = (document.querySelector(tokenSelector) as HTMLInputElement | null)?.value || '';
      const sessionToken = sessionStorage.getItem('access-token') || '';

      return token.trim().length > 20 || sessionToken.trim().length > 20;
    },
    {tokenSelector: getSelector('accessTokenInput')},
    {timeout: OPERATION_TIMEOUT}
  );
}

export async function register(page: Page): Promise<void> {
  const registerButton = page.locator(getSelector('registerButton'));
  await registerButton.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});

  if (await registerButton.isEnabled().catch(() => false)) {
    await registerButton.click({timeout: AWAIT_TIMEOUT});
  }

  await page.waitForFunction(
    (statusSelector) => {
      const statusText = (document.querySelector(statusSelector)?.textContent || '').toLowerCase();

      return statusText.includes('subscribed') || statusText.includes('connected');
    },
    getSelector('wsConnectionStatus'),
    {timeout: OPERATION_TIMEOUT}
  );
}

export async function deregister(page: Page): Promise<void> {
  const deregisterButton = page.locator(getSelector('deregisterButton'));
  if (await deregisterButton.isVisible().catch(() => false)) {
    if (await deregisterButton.isEnabled().catch(() => false)) {
      await deregisterButton.click({timeout: AWAIT_TIMEOUT}).catch(() => {});
    }
  }
}

// No widget toggles in the native sample app.
export async function enableAllWidgets(): Promise<void> {}
export async function enableMultiLogin(): Promise<void> {}
export async function disableMultiLogin(): Promise<void> {}

export async function initialiseWidgets(page: Page): Promise<void> {
  await register(page);
}

export async function agentRelogin(page: Page): Promise<void> {
  await page.reload({waitUntil: 'domcontentloaded'});
  await page.waitForTimeout(1000);

  const token = await page
    .evaluate(() => {
      const inputToken =
        (document.querySelector('#access-token') as HTMLInputElement | null)?.value || '';
      const sessionToken = sessionStorage.getItem('access-token') || '';

      return inputToken.trim() || sessionToken.trim();
    })
    .catch(() => '');

  if (!token) {
    throw new Error('agentRelogin failed: no saved access token found after reload');
  }

  const tokenInput = page.locator(getSelector('accessTokenInput'));
  if ((await tokenInput.inputValue().catch(() => '')).trim() === '') {
    await tokenInput.fill(token, {timeout: AWAIT_TIMEOUT});
  }

  const isRegisterEnabled = await page
    .locator(getSelector('registerButton'))
    .isEnabled()
    .catch(() => false);

  if (!isRegisterEnabled) {
    await page.locator(getSelector('accessTokenSubmit')).click({timeout: AWAIT_TIMEOUT});
    await page.waitForFunction(
      ({statusSelector, registerSelector}) => {
        const status = (document.querySelector(statusSelector)?.textContent || '').toLowerCase();
        const registerButton = document.querySelector(registerSelector) as HTMLButtonElement | null;

        return (
          status.includes('saved access token') ||
          Boolean(registerButton && !registerButton.disabled)
        );
      },
      {
        statusSelector: getSelector('accessTokenStatus'),
        registerSelector: getSelector('registerButton'),
      },
      {timeout: OPERATION_TIMEOUT}
    );
  }

  await register(page);
}

export async function setupMultiLoginPage(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(BASE_URL, {waitUntil: 'domcontentloaded'});

  return page;
}

export function captureConsole(page: Page, label = 'console'): CapturedConsole {
  const messages: string[] = [];
  const handler = (message: ConsoleMessage) => {
    messages.push(`[${label}] ${message.text()}`);
  };

  page.on('console', handler);

  return {
    messages,
    dispose: () => page.off('console', handler),
  };
}

export function loadSandboxEnv(): SandboxEnvironment {
  const sandbox = requireEnvVar('PW_SANDBOX');
  const password = requireEnvVar('PW_SANDBOX_PASSWORD');
  const entryPoints: string[] = [];

  for (let i = 1; i <= 6; i += 1) {
    const value = process.env[`PW_ENTRY_POINT${i}`];
    if (value) {
      entryPoints.push(value);
    }
  }

  return {
    sandbox,
    password,
    entryPoints,
    chatUrl: process.env.PW_CHAT_URL,
    dialNumberAgent: process.env.PW_DIAL_NUMBER_NAME,
  };
}
