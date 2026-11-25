import {test as setup, Locator, Page} from '@playwright/test';
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

const COOKIE_BANNER_TIMEOUT = 5000;
const NAV_TIMEOUT = 60000;
const ELEMENT_TIMEOUT = 90000;
const CLICK_TIMEOUT = 15000;
const TOKEN_DIALOG_TIMEOUT = 90000;
const NAV_ATTEMPTS = 3;
const OAUTH_SETUP_TIMEOUT = 600000;

/**
 * Navigate to a portal URL, retrying transient failures.
 *
 * Every role authenticates in its own context at the same time, and that burst
 * intermittently produces DNS failures (net::ERR_NAME_NOT_RESOLVED) on the first attempt.
 *
 * Waits for 'commit' only: the portal holds its document stream open, so 'load' and
 * 'domcontentloaded' never fire and waiting on them hangs until the timeout expires.
 */
const gotoPortal = async (page: Page, url: string): Promise<void> => {
  // Retry loop intentionally serial — each attempt backs off before the next one.
  /* eslint-disable no-await-in-loop */
  for (let attempt = 1; ; attempt += 1) {
    try {
      await page.goto(url, {waitUntil: 'commit', timeout: NAV_TIMEOUT});

      return;
    } catch (error) {
      if (attempt >= NAV_ATTEMPTS) {
        throw error;
      }

      await page.waitForTimeout(2000 * attempt);
    }
  }
  /* eslint-enable no-await-in-loop */
};

/**
 * Dismiss the OneTrust cookie consent banner if it is currently on screen.
 *
 * The banner is an aria-modal overlay, and while it is up the portal swallows the
 * clicks that produce the access token: the Copy Token dialog's OK button stops
 * issuing its /api/atkn request and nothing reaches the clipboard.
 *
 * This only probes, never waits, because the banner renders well after the page is
 * otherwise usable (~13s) and does not appear at all on the sign-in domain. Callers
 * poll it from their own retry loops instead of blocking here.
 */
const dismissCookieBanner = async (page: Page): Promise<void> => {
  const acceptButton = page.locator('#onetrust-accept-btn-handler');

  if (!(await acceptButton.isVisible().catch(() => false))) {
    return;
  }

  await acceptButton.click({timeout: COOKIE_BANNER_TIMEOUT}).catch(() => {});
  await acceptButton.waitFor({state: 'hidden', timeout: COOKIE_BANNER_TIMEOUT}).catch(() => {});
};

/**
 * Open the "Copy Token" dialog and return its OK button.
 *
 * Two things swallow early clicks on the copy icon: the portal streams its HTML, so the
 * icon is painted before React attaches the handler, and the cookie banner may still be
 * covering the page. There is no load event to wait on, so clear the banner and retry
 * the click until the dialog actually opens.
 */
const openCopyTokenDialog = async (page: Page): Promise<Locator> => {
  const copyButton = page.locator('#personal-access-tokens-id #copy-token-modal-button');
  await copyButton.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});

  // exact matching is required: by default getByRole does a case-insensitive substring
  // match, and "Manage cookie settings" on the consent banner contains "ok" (c-OK-ie).
  const okButton = page.getByRole('button', {name: 'OK', exact: true});
  const deadline = Date.now() + TOKEN_DIALOG_TIMEOUT;

  // Retry loop intentionally serial — each click depends on the previous one's side effects.
  /* eslint-disable no-await-in-loop */
  while (Date.now() < deadline) {
    await dismissCookieBanner(page);
    await copyButton.click({timeout: CLICK_TIMEOUT, noWaitAfter: true}).catch(() => {});

    try {
      await okButton.waitFor({state: 'visible', timeout: 4000});

      return okButton;
    } catch {
      // Banner still up or handler not attached yet — click again.
    }
  }
  /* eslint-enable no-await-in-loop */

  throw new Error('Copy Token dialog did not open on the developer portal');
};

/**
 * Login via a Webex developer portal and grab the personal access token.
 *
 * Flow:
 * 1. Navigate straight to the portal's /login route, which redirects to Webex sign-in
 * 2. Enter email on Webex sign-in page, press Enter
 * 3. Enter password, click Sign In
 * 4. Redirects back to the portal root (now logged in)
 * 5. Open the getting-started page
 * 6. Dismiss the cookie banner and click the copy icon until the Copy Token dialog opens
 * 7. Click OK on the confirmation dialog (triggers GET /api/atkn)
 * 8. Read the token from the /api/atkn response, falling back to the clipboard
 *
 * Every wait uses 'commit' rather than 'load'/'domcontentloaded': the portal holds its
 * document stream open, so those lifecycle events never fire and any wait on them hangs
 * until it times out.
 */
const fetchAccessToken = async (
  browser: import('@playwright/test').Browser,
  email: string,
  password: string,
  tokenPortalUrl: string
): Promise<string> => {
  // Test-only: TLS verification bypass required only when the OAuth portal
  // presents a self-signed certificate. Controlled via PW_IGNORE_HTTPS_ERRORS
  // env var so the bypass is never a hardcoded source-code default.
  const context = await browser.newContext({
    ignoreHTTPSErrors: process.env.PW_IGNORE_HTTPS_ERRORS === 'true',
  });
  const page = await context.newPage();

  // Build a regex to match the portal's domain for post-login redirect
  const portalHostname = new URL(tokenPortalUrl).hostname.replace(/\./g, '\\.');
  const portalRedirectPattern = new RegExp(portalHostname);

  try {
    // 1. Go straight to /login. Clicking the header link from the docs page works too,
    // but the portal takes ~45s to hand off to the identity broker that way.
    await gotoPortal(page, new URL('/login', tokenPortalUrl).href);
    await dismissCookieBanner(page);

    // 2. Enter email on Webex sign-in page
    const emailInput = page.getByRole('textbox', {name: 'name@example.com'});
    await emailInput.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await emailInput.fill(email);
    await emailInput.press('Enter');

    // 3. Enter password and click Sign In
    const passwordInput = page
      .locator('input#IDToken2[name="IDToken2"][type="password"]')
      .or(page.getByPlaceholder('Password'));
    await passwordInput.waitFor({state: 'visible', timeout: ELEMENT_TIMEOUT});
    await passwordInput.fill(password);
    await page.getByRole('button', {name: 'Sign In'}).click({noWaitAfter: true});

    // 4. Wait for redirect back to the portal
    await page.waitForURL(portalRedirectPattern, {timeout: 120000, waitUntil: 'commit'});

    // 5. Login lands on the portal root, so open the getting-started page explicitly
    await gotoPortal(page, tokenPortalUrl);

    // 6. Clear the cookie banner and open the Copy Token dialog
    const okButton = await openCopyTokenDialog(page);

    // 7 & 8. Click OK — this triggers GET /api/atkn which returns the token as plain text.
    // The dialog also copies the token to the clipboard, but the clipboard is shared
    // across contexts and every role authenticates in parallel, so reading it there
    // would risk handing one role another role's token.
    const [atknResponse] = await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/atkn') && resp.status() === 200, {
        timeout: 30000,
      }),
      okButton.click({noWaitAfter: true}),
    ]);

    const token = (await atknResponse.text()).trim();

    if (!token) {
      throw new Error('Failed to read access token from the developer portal');
    }

    return token;
  } finally {
    await context.close().catch(() => {});
  }
};

// Collect unique account roles across all sets
const uniqueRoles: AccountRole[] = [
  ...new Set(Object.values(USER_SETS).flatMap((set) => set.accounts)),
];

setup('OAuth', async ({browser}, testInfo) => {
  // A single portal login takes 40-60s and every role authenticates in parallel on the
  // same slow portal, so the 120s default test timeout cannot cover this setup step.
  setup.setTimeout(OAUTH_SETUP_TIMEOUT);

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
