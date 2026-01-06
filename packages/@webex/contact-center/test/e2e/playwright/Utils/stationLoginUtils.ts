import {Page, expect} from '@playwright/test';
import dotenv from 'dotenv';
import {LOGIN_MODE, LONG_WAIT, AWAIT_TIMEOUT, OPERATION_TIMEOUT} from '../constants';
import {handleStrayTasks} from './helperUtils';

dotenv.config();

const LOGIN_OPTION_MAP: Record<string, string> = {
  [LOGIN_MODE.DESKTOP]: 'BROWSER',
  [LOGIN_MODE.EXTENSION]: 'EXTENSION',
  [LOGIN_MODE.DIAL_NUMBER]: 'AGENT_DN',
};

const selectLoginOption = async (page: Page, mode: string): Promise<void> => {
  const value = LOGIN_OPTION_MAP[mode];
  if (!value) {
    throw new Error(`Unsupported login mode: ${mode}`);
  }
  const select = page.locator('#AgentLogin');
  await select.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
  await expect(select).toBeEnabled({timeout: AWAIT_TIMEOUT});
  await page.waitForFunction(
    (optionValue) => {
      const teams = document.querySelector('#teamsDropdown') as HTMLSelectElement | null;
      const loginSelect = document.querySelector('#AgentLogin') as HTMLSelectElement | null;
      if (!teams || !loginSelect) return false;
      const hasTeam = teams.options.length > 0 && Boolean(teams.value);
      const hasOption = Array.from(loginSelect.options).some((option) => option.value === optionValue);
      return hasTeam && hasOption;
    },
    value,
    {timeout: AWAIT_TIMEOUT}
  );
  await select.selectOption(value, {timeout: AWAIT_TIMEOUT});
};

/**
 * Performs desktop login for contact center agents
 * @param page - The Playwright page object
 * @throws {Error} When login fails or required elements are not found
 * @example
 * ```typescript
 * await desktopLogin(page);
 * ```
 */
export const desktopLogin = async (page: Page): Promise<void> => {
  await selectLoginOption(page, LOGIN_MODE.DESKTOP);
  await page.getByTestId('login-button').click({timeout: AWAIT_TIMEOUT});
};

/**
 * Performs extension-based login for contact center agents
 * @param page - The Playwright page object
 * @param extensionNumber - Optional extension number. Falls back to PW_EXTENSION_NUMBER env variable
 * @throws {Error} When extension number is not provided or empty
 * @throws {Error} When login fails or required elements are not found
 * @example
 * ```typescript
 * // Using environment variable
 * await extensionLogin(page);
 *
 * // Using custom extension number
 * await extensionLogin(page, "1234");
 * ```
 */
export const extensionLogin = async (page: Page, extensionNumber?: string): Promise<void> => {
  const number = extensionNumber;
  if (!number) {
    throw new Error('extensionNumber must be provided');
  }

  if (number.trim() === '') {
    throw new Error('Extension number is empty. Please provide a valid extension number.');
  }

  await selectLoginOption(page, LOGIN_MODE.EXTENSION);
  await page.getByTestId('dial-number-input').locator('input').fill(number, {timeout: AWAIT_TIMEOUT});
  await page.getByTestId('login-button').click({timeout: AWAIT_TIMEOUT});
};

/**
 * Performs dial number-based login for contact center agents
 * @param page - The Playwright page object
 * @param dialNumber - Optional dial number. Falls back to PW_ENTRY_POINT env variable
 * @throws {Error} When dial number is not provided or empty
 * @throws {Error} When login fails or required elements are not found
 * @example
 * ```typescript
 * // Using environment variable
 * await dialLogin(page);
 *
 * // Using custom dial number
 * await dialLogin(page, "+1234567890");
 * ```
 */
export const dialLogin = async (page: Page, dialNumber?: string): Promise<void> => {
  if (!dialNumber) {
    throw new Error('Dial number is required but not provided');
  }

  if (dialNumber.trim() === '') {
    throw new Error('Dial number is empty. Please provide a valid dial number.');
  }

  await selectLoginOption(page, LOGIN_MODE.DIAL_NUMBER);
  await page.getByTestId('dial-number-input').locator('input').fill(dialNumber, {timeout: AWAIT_TIMEOUT});
  await page.getByTestId('login-button').click({timeout: AWAIT_TIMEOUT});
};

/**
 * Performs station logout for contact center agents
 * @param page - The Playwright page object
 * @throws {Error} When logout fails or button remains visible after logout
 * @example
 * ```typescript
 * await stationLogout(page);
 * ```
 */
export const stationLogout = async (page: Page): Promise<void> => {
  // Ensure the logout button is visible before clicking
  const logoutButton = page.getByTestId('samples:station-logout-button');
  const isLogoutButtonVisible = await logoutButton.isVisible().catch(() => false);
  if (!isLogoutButtonVisible) {
    throw new Error('Station logout button is not visible. Cannot perform logout.');
  }
  await page.getByTestId('samples:station-logout-button').click({timeout: AWAIT_TIMEOUT});
  //check if the station logout button is hidden after logouts
  const isLogoutButtonHidden = await page
    .getByTestId('samples:station-logout-button')
    .waitFor({state: 'hidden', timeout: OPERATION_TIMEOUT})
    .then(() => true)
    .catch(() => false);
  if (!isLogoutButtonHidden) {
    try {
      await handleStrayTasks(page);
      await page.getByTestId('samples:station-logout-button').click({timeout: AWAIT_TIMEOUT});
      // Verify logout was successful after retry
      const isLogoutSuccessfulAfterRetry = await page
        .getByTestId('samples:station-logout-button')
        .waitFor({state: 'hidden', timeout: OPERATION_TIMEOUT})
        .then(() => true)
        .catch(() => false);
      if (!isLogoutSuccessfulAfterRetry) {
        throw new Error('Station logout button is still visible after retry attempt');
      }
    } catch (e) {
      throw new Error(`Station logout failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  }
};

/**
 * Unified telephony login function that supports multiple login modes
 * @param page - The Playwright page object
 * @param mode - The login mode (Desktop, Extension, or Dial Number)
 * @param number - Optional number for Extension or Dial Number modes
 * @throws {Error} When unsupported login mode is provided
 * @throws {Error} When number is required but not provided
 * @example
 * ```typescript
 * // Desktop login
 * await telephonyLogin(page, LOGIN_MODE.DESKTOP);
 *
 * // Extension login with env variable
 * await telephonyLogin(page, LOGIN_MODE.EXTENSION);
 *
 * // Extension login with custom number
 * await telephonyLogin(page, LOGIN_MODE.EXTENSION, "1234");
 *
 * // Dial number login with custom number
 * await telephonyLogin(page, LOGIN_MODE.DIAL_NUMBER, "+1234567890");
 * ```
 */
export const telephonyLogin = async (page: Page, mode: string, number?: string): Promise<void> => {
  if (mode === LOGIN_MODE.DESKTOP) {
    await desktopLogin(page);
  } else if (mode === LOGIN_MODE.EXTENSION) {
    await extensionLogin(page, number);
  } else if (mode === LOGIN_MODE.DIAL_NUMBER) {
    await dialLogin(page, number);
  } else {
    throw new Error(`Unsupported login mode: ${mode}. Use one of: ${Object.values(LOGIN_MODE).join(', ')}`);
  }
  await page.locator('#logoutAgent').waitFor({state: 'visible', timeout: LONG_WAIT});
};

/**
 * Verifies that the login mode selector displays the expected login mode
 * @param page - The Playwright page object
 * @param expectedMode - The expected login mode text to verify (e.g., 'Dial Number', 'Extension', 'Desktop')
 * @description Checks the login option select element's trigger text to ensure it matches the expected mode
 * @throws {Error} When the login mode doesn't match the expected value
 * @example
 * ```typescript
 * await verifyLoginMode(page, LOGIN_MODE.DIAL_NUMBER);
 * await verifyLoginMode(page, LOGIN_MODE.EXTENSION);
 * await verifyLoginMode(page, LOGIN_MODE.DESKTOP);
 * ```
 */
export async function verifyLoginMode(page: Page, expectedMode: string): Promise<void> {
  const select = page.locator('#AgentLogin');
  await select.waitFor({state: 'visible', timeout: AWAIT_TIMEOUT});
  const value = await select.inputValue();
  const expectedValue = LOGIN_OPTION_MAP[expectedMode] ?? expectedMode;
  expect(value).toBe(expectedValue);
}

/**
 * Ensures the user state widget is visible by checking its current state and logging in if necessary
 * @param page - The Playwright page object
 * @param loginMode - The login mode to use if login is required (from LOGIN_MODE constants)
 * @param number - Optional number for Extension or Dial Number modes
 * @description Checks if the state-select widget is visible; if not, performs telephony login and waits for it to appear
 * @throws {Error} When telephony login fails or state widget doesn't become visible
 * @example
 * ```typescript
 * await ensureUserStateVisible(page, LOGIN_MODE.DIAL_NUMBER, dialNumber);
 * await ensureUserStateVisible(page, LOGIN_MODE.EXTENSION, extensionNumber);
 * await ensureUserStateVisible(page, LOGIN_MODE.DESKTOP);
 * ```
 */
export async function ensureUserStateVisible(page: Page, loginMode: string, number?: string): Promise<void> {
  const isUserStateWidgetVisible = await page
    .getByTestId('state-select')
    .isVisible()
    .catch(() => false);
  if (!isUserStateWidgetVisible) {
    await telephonyLogin(page, loginMode, number);
    await expect(page.getByTestId('state-select')).toBeVisible({timeout: LONG_WAIT});
  }
}

/**
 * Verifies if Desktop login option is visible or hidden in the login dropdown
 * @param page - The Playwright page object
 * @param shouldBeVisible - Whether Desktop option should be visible (true) or hidden (false)
 * @throws {Error} When the Desktop option visibility doesn't match expectation
 * @example
 * ```typescript
 * // Verify Desktop is visible
 * await verifyDesktopOptionVisibility(page, true);
 *
 * // Verify Desktop is hidden (when hideDesktopLogin is true)
 * await verifyDesktopOptionVisibility(page, false);
 * ```
 */
export async function verifyDesktopOptionVisibility(page: Page, shouldBeVisible: boolean): Promise<void> {
  const desktopOption = await page
    .locator('#AgentLogin option')
    .filter({hasText: 'BROWSER'})
    .first();
  if (shouldBeVisible) {
    await expect(desktopOption).toBeVisible({timeout: AWAIT_TIMEOUT});
  } else {
    const isHidden = await desktopOption.evaluate((el) => (el as HTMLOptionElement).hidden).catch(() => false);
    if (!isHidden) {
      throw new Error('Desktop option should be hidden but is still visible');
    }
  }
}
