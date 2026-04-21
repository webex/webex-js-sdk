/**
 * Playwright-driven manual validation for updatePreferredWebexSite() and getMeetingSiteList()
 *
 * Flow:
 * 1. Login to web.webex.com → capture bearer token from network
 * 2. Navigate to SDK sample app
 * 3. Paste token, test each method via the UI
 * 4. Capture screenshots at each step as evidence
 *
 * Usage: npx playwright test docs/samples/browser-plugin-user/validate-site-selection.spec.js
 */

const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = path.join(__dirname, 'evidence');
const SAMPLE_APP_URL = 'https://localhost:8443/samples/browser-plugin-user/index.html';

test.beforeAll(() => {
  if (!fs.existsSync(EVIDENCE_DIR)) {
    fs.mkdirSync(EVIDENCE_DIR, {recursive: true});
  }
});

test('validate updatePreferredWebexSite and getMeetingSiteList via sample app', async ({browser}) => {
  test.setTimeout(120_000);

  // Read token from file (captured by captureCredentials.test.ts)
  // Use JWT token — the SDK's credentials layer will exchange it for a CI token
  const capturedToken = fs.readFileSync('/tmp/sdk-test-token.txt', 'utf8').trim();

  expect(capturedToken.length, 'Token file should contain a valid token').toBeGreaterThan(50);
  console.log(`[TOKEN] Using CI token from file (length: ${capturedToken.length})`);

  // Step 1: Navigate to sample app
  const appContext = await browser.newContext({ignoreHTTPSErrors: true});
  const page = await appContext.newPage();

  // Capture console output
  const consoleLogs = [];

  page.on('console', (msg) => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  console.log('[APP] Navigating to sample app...');
  await page.goto(SAMPLE_APP_URL, {waitUntil: 'domcontentloaded', timeout: 15_000});
  await page.screenshot({path: path.join(EVIDENCE_DIR, '06-sample-app-loaded.png')});

  // Step 3: Paste token and initialize SDK
  console.log('[APP] Pasting token and initializing SDK...');
  await page.fill('#token', capturedToken);
  await page.click('#btn-init');

  // Wait for SDK initialization + device registration
  await page.waitForFunction(
    () => document.getElementById('init-status')?.textContent?.includes('✅') ||
          document.getElementById('init-status')?.textContent?.includes('Error'),
    {timeout: 30_000}
  );
  await page.screenshot({path: path.join(EVIDENCE_DIR, '07-sdk-initialized.png')});

  const initStatus = await page.textContent('#init-status');

  console.log(`[APP] Init status: ${initStatus}`);
  expect(initStatus).toContain('✅');

  // Step 4: Get user profile + getMeetingSiteList
  console.log('[APP] Getting user profile and site list...');
  await page.click('#btn-get-user');

  await page.waitForFunction(
    () => document.getElementById('user-result')?.textContent?.includes('trainSiteNames') ||
          document.getElementById('user-result')?.textContent?.includes('Error'),
    {timeout: 30_000}
  );
  await page.screenshot({path: path.join(EVIDENCE_DIR, '08-user-profile.png')});

  const userResult = await page.textContent('#user-result');
  const sitesResult = await page.textContent('#sites-result');

  console.log(`[APP] User result: ${userResult?.substring(0, 200)}`);
  console.log(`[APP] Sites result: ${sitesResult}`);
  expect(userResult).toContain('trainSiteNames');

  // Check if we have multiple sites
  const siteRadios = await page.locator('input[name="site"]').count();

  console.log(`[APP] Found ${siteRadios} site radio buttons`);

  if (siteRadios < 2) {
    console.log('[APP] Only one site available — cannot test switching. Capturing evidence and exiting.');
    await page.screenshot({path: path.join(EVIDENCE_DIR, '09-single-site-only.png')});
  } else {
    // Step 5: Select a different site and update
    console.log('[APP] Selecting alternative site...');

    // No radio may be pre-checked if preferredWebExSite is undefined
    const hasChecked = await page.locator('input[name="site"]:checked').count();
    let originalSite;

    if (hasChecked > 0) {
      originalSite = await page.locator('input[name="site"]:checked').getAttribute('value');
      // Click the first unchecked radio
      await page.locator('input[name="site"]:not(:checked)').first().click();
    } else {
      // Nothing checked — pick the second site so we can restore to first
      const allRadios = page.locator('input[name="site"]');

      originalSite = await allRadios.nth(0).getAttribute('value');
      await allRadios.nth(1).click();
    }
    const newSelection = await page.locator('input[name="site"]:checked').getAttribute('value');

    console.log(`[APP] Switching from "${originalSite}" to "${newSelection}"`);
    await page.screenshot({path: path.join(EVIDENCE_DIR, '09-site-selected.png')});

    console.log('[APP] Clicking update...');
    await page.click('#btn-update-site');

    await page.waitForFunction(
      () => document.getElementById('update-result')?.textContent?.includes('✅') ||
            document.getElementById('update-result')?.textContent?.includes('Error'),
      {timeout: 30_000}
    );
    await page.screenshot({path: path.join(EVIDENCE_DIR, '10-site-updated.png')});

    const updateResult = await page.textContent('#update-result');

    console.log(`[APP] Update result: ${updateResult?.substring(0, 200)}`);
    expect(updateResult).toContain('✅');

    // Step 6: Verify persistence
    console.log('[APP] Verifying persistence...');
    await page.click('#btn-verify');

    await page.waitForFunction(
      () => document.getElementById('verify-result')?.textContent?.includes('✅') ||
            document.getElementById('verify-result')?.textContent?.includes('❌') ||
            document.getElementById('verify-result')?.textContent?.includes('Error'),
      {timeout: 30_000}
    );
    await page.screenshot({path: path.join(EVIDENCE_DIR, '11-verification.png')});

    const verifyResult = await page.textContent('#verify-result');

    console.log(`[APP] Verify result: ${verifyResult}`);
    expect(verifyResult).toContain('✅');

    // Step 7: Restore original (select it and update again)
    console.log('[APP] Restoring original site...');
    await page.locator(`input[name="site"][value="${originalSite}"]`).click();
    // Clear previous update result so waitForFunction doesn't match stale content
    await page.evaluate(() => { document.getElementById('update-result').textContent = ''; });
    await page.click('#btn-update-site');

    await page.waitForFunction(
      () => document.getElementById('update-result')?.textContent?.includes('✅') ||
            document.getElementById('update-result')?.textContent?.includes('Error'),
      {timeout: 30_000}
    );
    await page.screenshot({path: path.join(EVIDENCE_DIR, '12-site-restored.png')});
  }

  // Capture final evidence log
  const evidenceLog = await page.textContent('#evidence-log');

  fs.writeFileSync(path.join(EVIDENCE_DIR, 'evidence-log.txt'), evidenceLog || '');
  fs.writeFileSync(path.join(EVIDENCE_DIR, 'console-log.txt'), consoleLogs.join('\n'));

  await page.screenshot({path: path.join(EVIDENCE_DIR, '13-final-state.png'), fullPage: true});
  console.log('[APP] Evidence captured successfully');

  await appContext.close();
});
