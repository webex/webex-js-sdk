/* eslint-disable import/no-extraneous-dependencies, no-await-in-loop */
import {expect, Page} from '@playwright/test';
import dotenv from 'dotenv';
import * as path from 'path';
import {AWAIT_TIMEOUT, EXTENSION_REGISTRATION_TIMEOUT, LOGIN_MODE, LoginMode} from '../constants';
import {getSelector, handleStrayTasks} from './helperUtils';
import {ensureRegisteredAfterReload, registerContactCenter} from './initUtils';

dotenv.config({path: path.resolve(__dirname, '../.env')});

const MODE_VALUE_MAP: Record<string, string> = {
  [LOGIN_MODE.DESKTOP]: 'BROWSER',
  [LOGIN_MODE.EXTENSION]: 'EXTENSION',
  [LOGIN_MODE.DIAL_NUMBER]: 'AGENT_DN',
  BROWSER: 'BROWSER',
  EXTENSION: 'EXTENSION',
  AGENT_DN: 'AGENT_DN',
};
const STATION_LOGIN_ERROR_TEXT = 'An error occurred while logging in to the station';
const MULTI_AGENT_LOGIN_ERROR_TEXT = 'Multiple Agent Login Session Detected!';

export async function hasBrokenStationState(page: Page): Promise<boolean> {
  const hasLoginErrorBanner = await page
    .getByText(STATION_LOGIN_ERROR_TEXT)
    .isVisible()
    .catch(() => false);
  if (hasLoginErrorBanner) {
    return true;
  }

  return page
    .getByText(MULTI_AGENT_LOGIN_ERROR_TEXT)
    .isVisible()
    .catch(() => false);
}

export async function hasStationReadyState(page: Page, expectedMode?: string): Promise<boolean> {
  if (await hasBrokenStationState(page)) {
    return false;
  }

  const logoutButton = page.locator(getSelector('logoutButton'));
  const loginButton = page.locator(getSelector('loginButton'));
  const idleCodes = page.locator(getSelector('idleCodesDropdown'));
  const loginModeSelect = page.locator(getSelector('agentLoginSelect'));

  const logoutVisible = await logoutButton.isVisible().catch(() => false);
  const idleCodesVisible = await idleCodes.isVisible().catch(() => false);
  const loginEnabled = await loginButton.isEnabled().catch(() => false);
  const selectedMode = await loginModeSelect.inputValue().catch(() => '');
  const idleCodeValue = await idleCodes.inputValue().catch(() => '');

  const validModeValues = new Set(Object.values(MODE_VALUE_MAP));
  const normalizedExpectedMode = expectedMode
    ? MODE_VALUE_MAP[expectedMode] || expectedMode
    : undefined;
  const hasConcreteMode = validModeValues.has(selectedMode);
  const modeMatches = normalizedExpectedMode ? selectedMode === normalizedExpectedMode : true;
  const hasConcreteState = Boolean(idleCodeValue.trim());

  return (
    logoutVisible ||
    (idleCodesVisible && !loginEnabled && hasConcreteMode && modeMatches && hasConcreteState)
  );
}

async function getStationLoginStatus(page: Page): Promise<'ready' | 'error' | 'pending'> {
  if (await hasStationReadyState(page)) {
    return 'ready';
  }

  if (await hasBrokenStationState(page)) {
    return 'error';
  }

  return 'pending';
}

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

  if (!page.isClosed()) {
    await page.waitForTimeout(200);
  }
}

async function submitLogin(page: Page): Promise<void> {
  const loginButton = page.locator(getSelector('loginButton'));
  const maxLoginAttempts = 2;

  await loginButton.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});

  if (await hasBrokenStationState(page)) {
    await stationLogout(page, false);
    await loginButton.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
  }

  if (await hasStationReadyState(page)) {
    return;
  }
  for (let attempt = 0; attempt < maxLoginAttempts; attempt += 1) {
    await expect(loginButton).toBeEnabled({timeout: AWAIT_TIMEOUT});
    await loginButton.click({timeout: AWAIT_TIMEOUT});

    const loginStatus = await expect
      .poll(() => getStationLoginStatus(page), {
        timeout: EXTENSION_REGISTRATION_TIMEOUT,
        intervals: [500, 1000, 2000],
      })
      .not.toBe('pending')
      .then(() => getStationLoginStatus(page))
      .catch(() => 'pending' as const);

    if (loginStatus === 'ready') {
      return;
    }

    if (attempt === maxLoginAttempts - 1) {
      if (loginStatus === 'error') {
        throw new Error('Station login failed: explicit station error banner is visible');
      }

      throw new Error('Station login failed: timed out waiting for station-ready state');
    }

    await page.waitForTimeout(1000);
    await selectTeam(page);
  }
}

async function resetContactCenterSession(page: Page): Promise<void> {
  const registerButton = page.locator('#webexcc-register');
  const unregisterButton = page.locator('#webexcc-deregister');

  const canUnregister = await unregisterButton.isEnabled().catch(() => false);
  if (canUnregister) {
    await unregisterButton.click({timeout: AWAIT_TIMEOUT}).catch(() => {});
    await expect(registerButton)
      .toBeEnabled({timeout: EXTENSION_REGISTRATION_TIMEOUT})
      .catch(() => {});
    await page.waitForTimeout(1000);
  }

  await registerContactCenter(page);
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
  const loginButton = page.locator(getSelector('loginButton'));

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

    if (!hiddenAfterRetry) {
      await resetContactCenterSession(page).catch(() => {});

      if (!page.isClosed()) {
        await page.reload().catch(() => {});
        await ensureRegisteredAfterReload(page).catch(() => {});
      }

      const recovered = await expect
        .poll(
          async () => {
            const logoutVisible = await logoutButton.isVisible().catch(() => false);
            const loginVisible = await loginButton.isVisible().catch(() => false);

            return !logoutVisible || loginVisible;
          },
          {timeout: 15000, intervals: [500, 1000, 2000]}
        )
        .toBeTruthy()
        .then(() => true)
        .catch(() => false);

      if (!recovered && throwOnFailure) {
        throw new Error('Station logout failed: #logoutAgent is still visible after recovery');
      }
    }
  }
}

async function recoverStationLoginPage(page: Page): Promise<void> {
  if (page.isClosed()) {
    return;
  }

  await stationLogout(page, false).catch(() => {});

  try {
    await page.reload();
    await ensureRegisteredAfterReload(page);
  } catch {
    await resetContactCenterSession(page).catch(() => {});
  }

  await page.locator(getSelector('agentLoginSelect')).waitFor({
    state: 'visible',
    timeout: AWAIT_TIMEOUT,
  });
}

export async function telephonyLogin(page: Page, mode: string, number?: string): Promise<void> {
  const performLogin = async (): Promise<void> => {
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
  };

  const maxAttempts = 2;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await performLogin();

      return;
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts - 1 || page.isClosed()) {
        break;
      }

      await recoverStationLoginPage(page).catch(() => {});
      await page.waitForTimeout(1000);
    }
  }

  throw lastError;
}

export async function verifyLoginMode(page: Page, expectedMode: string): Promise<void> {
  const select = page.locator(getSelector('agentLoginSelect'));
  await select.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});

  const expectedValue = MODE_VALUE_MAP[expectedMode] || expectedMode;

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

  const hasStateWidget = await idleCodes.isVisible().catch(() => false);
  const isLoggedIn = await hasStationReadyState(page, loginMode);

  if (hasStateWidget && isLoggedIn) {
    return;
  }

  await telephonyLogin(page, loginMode, number);
  await expect
    .poll(() => hasStationReadyState(page, loginMode), {
      timeout: EXTENSION_REGISTRATION_TIMEOUT,
      intervals: [500, 1000, 2000],
    })
    .toBeTruthy();
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
