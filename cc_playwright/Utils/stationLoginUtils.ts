/* eslint-disable import/no-extraneous-dependencies */
import {expect, Page} from '@playwright/test';
import dotenv from 'dotenv';
import * as path from 'path';
import {AWAIT_TIMEOUT, EXTENSION_REGISTRATION_TIMEOUT, LOGIN_MODE, LoginMode} from '../constants';
import {getSelector, handleStrayTasks} from './helperUtils';

dotenv.config({path: path.resolve(__dirname, '../.env')});

const MODE_VALUE_MAP: Record<string, string> = {
  [LOGIN_MODE.DESKTOP]: 'BROWSER',
  [LOGIN_MODE.EXTENSION]: 'EXTENSION',
  [LOGIN_MODE.DIAL_NUMBER]: 'AGENT_DN',
  BROWSER: 'BROWSER',
  EXTENSION: 'EXTENSION',
  AGENT_DN: 'AGENT_DN',
};

async function selectTeam(page: Page): Promise<void> {
  const teams = page.locator(getSelector('teamsDropdown'));
  await teams.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});

  const optionCount = await teams.locator('option').count();
  if (optionCount === 0) {
    throw new Error('No teams available in #teamsDropdown');
  }

  await teams.selectOption({index: 0});
}

async function setLoginMode(page: Page, mode: string): Promise<void> {
  if (page.isClosed()) {
    throw new Error('Cannot set login mode: page has been closed');
  }

  const select = page.locator(getSelector('agentLoginSelect'));
  await select.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});

  const targetValue = MODE_VALUE_MAP[mode] || mode;
  const selected = await select.selectOption({value: targetValue}).catch(() => []);

  if (selected.length === 0) {
    await select.selectOption({label: mode}).catch(() => []);
  }

  // Wait for page to stabilize after mode selection
  if (!page.isClosed()) {
    await page.waitForTimeout(200);
  }
}

async function submitLogin(page: Page): Promise<void> {
  const loginButton = page.locator(getSelector('loginButton'));
  const logoutButton = page.locator(getSelector('logoutButton'));

  await loginButton.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});

  // Some runs start with a server-side restored agent session.
  // In that case, logout is visible and login remains disabled by design.
  if (
    (await logoutButton.isVisible().catch(() => false)) &&
    !(await loginButton.isEnabled().catch(() => false))
  ) {
    return;
  }

  await expect(loginButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await loginButton.click({timeout: AWAIT_TIMEOUT});
  await logoutButton.waitFor({state: 'visible', timeout: EXTENSION_REGISTRATION_TIMEOUT});
}

export async function desktopLogin(page: Page): Promise<void> {
  if (page.isClosed()) {
    throw new Error('Cannot perform desktop login: page has been closed');
  }

  await setLoginMode(page, LOGIN_MODE.DESKTOP);
  await selectTeam(page);
  await submitLogin(page);
}

export async function extensionLogin(page: Page, extensionNumber?: string): Promise<void> {
  const number = extensionNumber || process.env.PW_EXTENSION_NUMBER;
  // Convert to string and validate
  const numberStr = number != null ? String(number) : '';
  if (!numberStr || !numberStr.trim()) {
    throw new Error('Extension number is required for extension login');
  }

  if (page.isClosed()) {
    throw new Error('Cannot perform extension login: page has been closed');
  }

  await setLoginMode(page, LOGIN_MODE.EXTENSION);

  const dialNumberInput = page.locator(getSelector('dialNumberInput'));
  await dialNumberInput.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
  await dialNumberInput.fill(numberStr, {timeout: AWAIT_TIMEOUT});
  await selectTeam(page);
  await submitLogin(page);
}

export async function dialLogin(page: Page, dialNumber?: string): Promise<void> {
  const number = dialNumber || process.env.PW_ENTRY_POINT1;
  // Convert to string and validate
  const numberStr = number != null ? String(number) : '';
  if (!numberStr || !numberStr.trim()) {
    throw new Error('Dial number is required for dial-number login');
  }

  if (page.isClosed()) {
    throw new Error('Cannot perform dial login: page has been closed');
  }

  await setLoginMode(page, LOGIN_MODE.DIAL_NUMBER);

  const dialNumberInput = page.locator(getSelector('dialNumberInput'));
  await dialNumberInput.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
  await dialNumberInput.fill(numberStr, {timeout: AWAIT_TIMEOUT});
  await selectTeam(page);
  await submitLogin(page);
}

export async function stationLogout(page: Page, throwOnFailure = true): Promise<void> {
  const logoutButton = page.locator(getSelector('logoutButton'));

  if (!(await logoutButton.isVisible().catch(() => false))) {
    return;
  }

  await logoutButton.click({timeout: AWAIT_TIMEOUT}).catch(() => {});

  const hidden = await logoutButton
    .waitFor({state: 'hidden', timeout: EXTENSION_REGISTRATION_TIMEOUT})
    .then(() => true)
    .catch(() => false);

  if (!hidden) {
    await handleStrayTasks(page).catch(() => {});
    await logoutButton.click({force: true, timeout: AWAIT_TIMEOUT}).catch(() => {});
    const hiddenAfterRetry = await logoutButton
      .waitFor({state: 'hidden', timeout: EXTENSION_REGISTRATION_TIMEOUT})
      .then(() => true)
      .catch(() => false);

    if (!hiddenAfterRetry && throwOnFailure) {
      throw new Error('Station logout failed: #logoutAgent is still visible after retry');
    }
  }
}

export async function telephonyLogin(page: Page, mode: string, number?: string): Promise<void> {
  if (mode === LOGIN_MODE.DESKTOP) {
    await desktopLogin(page);

    return;
  }

  if (mode === LOGIN_MODE.EXTENSION) {
    await extensionLogin(page, number);

    return;
  }

  if (mode === LOGIN_MODE.DIAL_NUMBER) {
    await dialLogin(page, number);

    return;
  }

  throw new Error(`Unsupported login mode '${mode}'`);
}

export async function verifyLoginMode(page: Page, expectedMode: string): Promise<void> {
  const select = page.locator(getSelector('agentLoginSelect'));
  await select.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});

  const expectedValue = MODE_VALUE_MAP[expectedMode] || expectedMode;

  // Use promise-based polling to avoid await-in-loop
  const checkLoginMode = async (): Promise<{
    matched: boolean;
    selectedValue: string;
    selectedLabel: string;
    sdkDeviceType: string;
  }> => {
    const selectedValue = (await select.inputValue().catch(() => '')).trim();
    const selectedLabel = (
      await select
        .locator('option:checked')
        .innerText()
        .catch(() => selectedValue)
    ).trim();
    const sdkDeviceType = await page
      .evaluate(() => {
        const maybeWebex = (
          window as unknown as {webex?: {cc?: {agentConfig?: {deviceType?: string}}}}
        ).webex;

        return maybeWebex?.cc?.agentConfig?.deviceType || '';
      })
      .catch(() => '');

    const matched =
      selectedValue.toLowerCase() === expectedValue.toLowerCase() ||
      selectedLabel.toLowerCase() === expectedMode.toLowerCase() ||
      sdkDeviceType.toLowerCase() === expectedValue.toLowerCase();

    return {matched, selectedValue, selectedLabel, sdkDeviceType};
  };

  // Poll using recursive setTimeout pattern
  const result = await new Promise<{
    success: boolean;
    selectedValue: string;
    selectedLabel: string;
    sdkDeviceType: string;
  }>((resolve) => {
    const startedAt = Date.now();
    const poll = async () => {
      const {matched, selectedValue, selectedLabel, sdkDeviceType} = await checkLoginMode();

      if (matched) {
        resolve({success: true, selectedValue, selectedLabel, sdkDeviceType});
      } else if (Date.now() - startedAt > EXTENSION_REGISTRATION_TIMEOUT) {
        resolve({success: false, selectedValue, selectedLabel, sdkDeviceType});
      } else {
        setTimeout(poll, 250);
      }
    };
    poll();
  });

  if (!result.success) {
    throw new Error(
      `Login mode mismatch. expected='${expectedMode}' (value='${expectedValue}'), actual value='${result.selectedValue}', label='${result.selectedLabel}', sdkDeviceType='${result.sdkDeviceType}'`
    );
  }
}

export async function ensureUserStateVisible(
  page: Page,
  loginMode: LoginMode,
  number?: string
): Promise<void> {
  const idleCodes = page.locator(getSelector('idleCodesDropdown'));
  const logoutButton = page.locator(getSelector('logoutButton'));
  const loginButton = page.locator(getSelector('loginButton'));

  const hasStateWidget = await idleCodes.isVisible().catch(() => false);
  const isLoggedIn =
    (await logoutButton.isVisible().catch(() => false)) ||
    !(await loginButton.isVisible().catch(() => false));

  if (hasStateWidget && isLoggedIn) {
    return;
  }

  await telephonyLogin(page, loginMode, number);
  await logoutButton.waitFor({state: 'visible', timeout: EXTENSION_REGISTRATION_TIMEOUT});
  await idleCodes.waitFor({state: 'visible', timeout: EXTENSION_REGISTRATION_TIMEOUT});
}

export async function verifyDesktopOptionVisibility(
  page: Page,
  shouldBeVisible: boolean
): Promise<void> {
  const options = await page
    .locator(getSelector('agentLoginSelect'))
    .locator('option')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));

  const hasDesktop = options.includes('BROWSER');
  if (shouldBeVisible && !hasDesktop) {
    throw new Error('Expected Desktop/BROWSER option to be visible in #AgentLogin');
  }
  if (!shouldBeVisible && hasDesktop) {
    throw new Error('Expected Desktop/BROWSER option to be hidden in #AgentLogin');
  }
}
