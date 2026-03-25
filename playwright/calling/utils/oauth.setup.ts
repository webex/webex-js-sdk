import {test as setup} from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.resolve(__dirname, '../../../.env');
const WIDGETS_URL = 'https://widgets.webex.com/samples-cc-react-app/index.html';

type EnvUpdateMap = Record<string, string>;

const readEnvFile = (): string => {
  if (!fs.existsSync(ENV_PATH)) {
    return '';
  }

  return fs.readFileSync(ENV_PATH, 'utf8');
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const upsertEnvVariables = (updates: EnvUpdateMap): void => {
  let envContent = readEnvFile();

  for (const [key, value] of Object.entries(updates)) {
    const keyPattern = new RegExp(`^${escapeRegExp(key)}=.*$\\n?`, 'm');
    envContent = envContent.replace(keyPattern, '');

    if (!envContent.endsWith('\n') && envContent.length > 0) {
      envContent += '\n';
    }
    envContent += `${key}=${value}\n`;
    process.env[key] = value;
  }

  envContent = envContent.replace(/\n{3,}/g, '\n\n');
  fs.writeFileSync(ENV_PATH, envContent, 'utf8');
};

/**
 * Login via widgets.webex.com OAuth flow and grab the access token.
 *
 * Flow:
 * 1. Navigate to widgets.webex.com sample app
 * 2. Switch login method to "Login with Webex"
 * 3. Click "Login with Webex" button → redirects to IdBroker
 * 4. Enter email, then password, then sign in
 * 5. Redirects back to widgets page with token
 * 6. Read token from the Access Token input box
 */
const fetchAccessToken = async (
  browser: import('@playwright/test').Browser,
  email: string,
  password: string
): Promise<string> => {
  const context = await browser.newContext({ignoreHTTPSErrors: true});
  const page = await context.newPage();

  try {
    // 1. Navigate to widgets sample app
    await page.goto(WIDGETS_URL, {waitUntil: 'load', timeout: 30000});

    // 2. Open the login method dropdown and select "Login with Webex"
    await page.getByRole('combobox', {name: 'Select Login Method'}).first().click({timeout: 10000});
    await page.getByTestId('samples:login_option_oauth').click({timeout: 10000});

    // 3. Click "Login with Webex" button → redirects to IdBroker
    await page.getByTestId('samples:login_with_webex_button').click({timeout: 10000});

    // 4. Enter email on Webex sign-in page
    await page.getByRole('textbox', {name: 'name@example.com'}).fill(email, {timeout: 15000});
    await page.getByRole('textbox', {name: 'name@example.com'}).press('Enter');

    // 5. Wait for password field and enter password
    await page.getByPlaceholder('Password').fill(password, {timeout: 15000});

    // 6. Click "Sign In"
    await page.getByRole('button', {name: 'Sign In'}).click();

    // 7. Wait for redirect back to widgets page
    await page.waitForURL(/widgets\.webex\.com/, {timeout: 120000});

    // 8. Read the access token from the input box next to "Your access token:"
    const tokenInput = page.getByRole('textbox').first();
    await tokenInput.waitFor({state: 'visible', timeout: 15000});
    const token = await tokenInput.inputValue({timeout: 10000});

    if (!token || token.trim() === '') {
      throw new Error('Failed to read access token from input box');
    }

    return token.trim();
  } finally {
    await context.close().catch(() => {});
  }
};

setup('OAuth', async ({browser}) => {
  // Skip OAuth if SKIP_AUTH=true and tokens already exist in env
  if (
    process.env.SKIP_AUTH === 'true' &&
    process.env.CALLER_ACCESS_TOKEN &&
    process.env.CALLEE_ACCESS_TOKEN &&
    process.env.TRANSFER_ACCESS_TOKEN
  ) {
    return;
  }

  const tokenUpdates: EnvUpdateMap = {};

  const callerEmail = process.env.CALLER_EMAIL;
  const callerPassword = process.env.CALLER_PASSWORD;

  if (!callerEmail || !callerPassword) {
    throw new Error('CALLER_EMAIL and CALLER_PASSWORD must be set in .env');
  }

  // Build list of token fetches to run in parallel
  const tokenFetches: Promise<void>[] = [];

  tokenFetches.push(
    fetchAccessToken(browser, callerEmail, callerPassword).then((token) => {
      tokenUpdates.CALLER_ACCESS_TOKEN = token;
    })
  );

  const calleeEmail = process.env.CALLEE_EMAIL;
  const calleePassword = process.env.CALLEE_PASSWORD;

  if (calleeEmail && calleePassword) {
    tokenFetches.push(
      fetchAccessToken(browser, calleeEmail, calleePassword).then((token) => {
        tokenUpdates.CALLEE_ACCESS_TOKEN = token;
      })
    );
  }

  const transferEmail = process.env.TRANSFER_EMAIL;
  const transferPassword = process.env.TRANSFER_PASSWORD;

  if (transferEmail && transferPassword) {
    tokenFetches.push(
      fetchAccessToken(browser, transferEmail, transferPassword).then((token) => {
        tokenUpdates.TRANSFER_ACCESS_TOKEN = token;
      })
    );
  }

  await Promise.all(tokenFetches);
  upsertEnvVariables(tokenUpdates);
});
