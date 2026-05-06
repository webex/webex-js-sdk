import {test as setup} from '@playwright/test';
import fs from 'fs';
import {
  ENV_PATH,
  DEVELOPER_PORTAL_GETTING_STARTED_URL,
  DEVELOPER_PORTAL_INT_GETTING_STARTED_URL,
} from '../constants';
import {USER_SETS, REQUIRED_OAUTH_ROLES, AccountRole, tokenEnvVar} from '../test-data';

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
 * Login via a Webex developer portal and grab the personal access token.
 *
 * Flow:
 * 1. Navigate to the portal's getting-started page
 * 2. Click "Log in" link in the header
 * 3. Enter email on Webex sign-in page, click Sign In
 * 4. Enter password, click Sign In
 * 5. Redirects back to getting-started page (now logged in)
 * 6. Click copy icon on "Your Personal Access Token"
 * 7. Click OK on the confirmation dialog (triggers GET /api/atkn)
 * 8. Intercept the /api/atkn response (plain-text token)
 */
const fetchAccessToken = async (
  browser: import('@playwright/test').Browser,
  email: string,
  password: string,
  tokenPortalUrl: string
): Promise<string> => {
  const context = await browser.newContext({ignoreHTTPSErrors: true});
  const page = await context.newPage();

  // Build a regex to match the portal's domain for post-login redirect
  const portalHostname = new URL(tokenPortalUrl).hostname.replace(/\./g, '\\.');
  const portalRedirectPattern = new RegExp(portalHostname);

  try {
    // 1. Navigate to getting-started page
    await page.goto(tokenPortalUrl, {waitUntil: 'load', timeout: 30000});

    // 2. Click "Log in" link
    await page.locator('#header-login-link').click({timeout: 10000});

    // 3. Enter email on Webex sign-in page
    await page.getByRole('textbox', {name: 'name@example.com'}).fill(email, {timeout: 15000});
    await page.getByRole('textbox', {name: 'name@example.com'}).press('Enter');

    // 4. Enter password and click Sign In
    await page.getByPlaceholder('Password').fill(password, {timeout: 15000});
    await page.getByRole('button', {name: 'Sign In'}).click();

    // 5. Wait for redirect back to getting-started page
    await page.waitForURL(portalRedirectPattern, {timeout: 120000});

    // 6. Click copy icon on the personal access token
    const copyButton = page.locator('#personal-access-tokens-id button').first();
    await copyButton.waitFor({state: 'visible', timeout: 30000});
    await copyButton.click({timeout: 10000});

    // 7. Click OK — this triggers GET /api/atkn which returns the token as plain text
    const okButton = page.getByRole('button', {name: 'OK'});
    await okButton.waitFor({state: 'visible', timeout: 10000});

    // 8. Intercept the /api/atkn response
    const [atknResponse] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/atkn') && resp.status() === 200, {
        timeout: 30000,
      }),
      okButton.click(),
    ]);

    const token = await atknResponse.text();

    if (!token || token.trim() === '') {
      throw new Error('Failed to read access token from /api/atkn response');
    }

    return token.trim();
  } finally {
    await context.close().catch(() => {});
  }
};

// Collect unique account roles across all sets
const uniqueRoles: AccountRole[] = [
  ...new Set(Object.values(USER_SETS).flatMap((set) => set.accounts)),
];

setup('OAuth', async ({browser}, testInfo) => {
  const isInt = (testInfo.project.use as any).testEnv === 'int';
  const envPrefix = isInt ? '_INT' : '';
  const tokenPortalUrl = isInt
    ? DEVELOPER_PORTAL_INT_GETTING_STARTED_URL
    : DEVELOPER_PORTAL_GETTING_STARTED_URL;

  // Skip OAuth if SKIP_AUTH=true and tokens already exist in env
  if (
    process.env.SKIP_AUTH === 'true' &&
    uniqueRoles.every((role) => process.env[tokenEnvVar(role, isInt)])
  ) {
    return;
  }

  const tokenUpdates: EnvUpdateMap = {};
  const tokenFetches: Promise<void>[] = [];

  for (const role of uniqueRoles) {
    const email = process.env[`${role}${envPrefix}_EMAIL`];
    const password = process.env[`${role}${envPrefix}_PASSWORD`];

    // Fail early for roles used by currently enabled projects.
    if (!email || !password) {
      if (REQUIRED_OAUTH_ROLES.includes(role)) {
        throw new Error(
          `${role}${envPrefix}_EMAIL and ${role}${envPrefix}_PASSWORD must be set in .env`
        );
      }
    } else {
      tokenFetches.push(
        fetchAccessToken(browser, email, password, tokenPortalUrl).then((token) => {
          tokenUpdates[tokenEnvVar(role, isInt)] = token;
        })
      );
    }
  }

  await Promise.all(tokenFetches);
  upsertEnvVariables(tokenUpdates);
});
