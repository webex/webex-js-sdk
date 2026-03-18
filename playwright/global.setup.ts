import {test as setup} from '@playwright/test';
import fs from 'fs';
import path from 'path';

const ENV_PATH = path.resolve(__dirname, '../.env');
const DEVELOPER_PORTAL_URL = 'https://developer.webex.com/docs/getting-started';

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
 * Login to developer.webex.com and grab the personal access token.
 *
 * Flow:
 * 1. Navigate to developer.webex.com/docs/getting-started
 * 2. Click "Log in"
 * 3. Enter email on Webex IdBroker sign-in page
 * 4. Enter password
 * 5. Click "Sign In"
 * 6. Back on developer portal, click copy icon on the personal access token
 * 7. Accept the "Copy Token" dialog
 * 8. Read token from clipboard
 */
const fetchAccessTokenFromDevPortal = async (
  browser: import('@playwright/test').Browser,
  email: string,
  password: string
): Promise<string> => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const page = await context.newPage();

  try {
    // 1. Navigate to developer portal getting-started page
    await page.goto(DEVELOPER_PORTAL_URL, {waitUntil: 'load', timeout: 30000});

    // 2. Click "Log in"
    await page.locator('a[href="/login"]').first().waitFor({state: 'visible', timeout: 20000});
    await page.locator('a[href="/login"]').first().click();

    // 3. Enter email on the Webex sign-in page
    await page.getByRole('textbox', {name: 'name@example.com'}).fill(email, {timeout: 15000});
    await page.getByRole('textbox', {name: 'name@example.com'}).press('Enter');

    // 4. Wait for password field and enter password
    await page.getByPlaceholder('Password').fill(password, {timeout: 15000});

    // 5. Click "Sign In"
    await page.getByRole('button', {name: 'Sign In'}).click();

    // 6. Wait for redirect back to developer portal (logged in)
    await page.waitForURL(/developer\.webex\.com/, {timeout: 30000});

    // Wait for the personal access token section to load
    await page
      .getByText('Your Personal Access Token')
      .first()
      .waitFor({state: 'visible', timeout: 15000});

    // 7. Clear clipboard to avoid stale content
    await page.evaluate(() => navigator.clipboard.writeText(''));

    // 8. Click the copy icon on the first token field
    await page.getByLabel('copy').first().click({timeout: 10000});

    // 9. Accept the "Copy Token" confirmation dialog
    await page.getByRole('button', {name: 'OK'}).click({timeout: 10000});

    // 10. Wait briefly then read token from clipboard
    await page.waitForTimeout(500);
    const token = await page.evaluate(() => navigator.clipboard.readText());

    if (!token || token === '****************************' || token === '') {
      throw new Error('Failed to read access token from clipboard');
    }

    return token;
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
    fetchAccessTokenFromDevPortal(browser, callerEmail, callerPassword).then((token) => {
      tokenUpdates.CALLER_ACCESS_TOKEN = token;
    })
  );

  const calleeEmail = process.env.CALLEE_EMAIL;
  const calleePassword = process.env.CALLEE_PASSWORD;

  if (calleeEmail && calleePassword) {
    tokenFetches.push(
      fetchAccessTokenFromDevPortal(browser, calleeEmail, calleePassword).then((token) => {
        tokenUpdates.CALLEE_ACCESS_TOKEN = token;
      })
    );
  }

  const transferEmail = process.env.TRANSFER_EMAIL;
  const transferPassword = process.env.TRANSFER_PASSWORD;

  if (transferEmail && transferPassword) {
    tokenFetches.push(
      fetchAccessTokenFromDevPortal(browser, transferEmail, transferPassword).then((token) => {
        tokenUpdates.TRANSFER_ACCESS_TOKEN = token;
      })
    );
  }

  await Promise.all(tokenFetches);
  upsertEnvVariables(tokenUpdates);
});
