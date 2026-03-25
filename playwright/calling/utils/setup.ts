import {Page, expect} from '@playwright/test';
import {
  SAMPLE_APP_PATH,
  SELECTORS,
  AWAIT_TIMEOUT,
  SDK_INIT_TIMEOUT,
  ServiceIndicator,
} from './constants';

/**
 * Navigate to the calling sample app
 */
export const navigateToCallingApp = async (page: Page): Promise<void> => {
  await page.goto(SAMPLE_APP_PATH);
  await page.waitForLoadState('domcontentloaded');
};

/**
 * Fill in the access token and initialize the Calling SDK.
 * The sample app flow:
 * 1. Enter token in #access-token
 * 2. Click "Initialize Calling" (#access-token-save) which triggers initCalling()
 * 3. Calling.init() is called, then on 'ready' event:
 *    - authStatus shows "Saved access token!"
 *    - calling.register() is called automatically
 *    - After register, registerElm is enabled and callingClient + line are set up
 */
export const initializeCallingSDK = async (page: Page, accessToken: string): Promise<void> => {
  if (!accessToken) {
    throw new Error('Access token is required to initialize Calling SDK');
  }

  // Fill in the access token
  await page.locator(SELECTORS.ACCESS_TOKEN_INPUT).fill(accessToken, {timeout: AWAIT_TIMEOUT});

  // Click "Initialize Calling" (submits the credentials form)
  await page.locator(SELECTORS.INITIALIZE_CALLING_BTN).click({timeout: AWAIT_TIMEOUT});

  // Wait for SDK to initialize - status changes to "Saved access token!" on ready
  await expect(page.locator(SELECTORS.AUTH_STATUS)).toHaveText('Saved access token!', {
    timeout: SDK_INIT_TIMEOUT,
  });
};

/**
 * Verify the SDK initialized successfully:
 * - Auth status shows "Saved access token!"
 * - Register button is enabled
 * - window.callingClient is set (Calling object exists)
 */
export const verifySDKInitialized = async (page: Page): Promise<void> => {
  await expect(page.locator(SELECTORS.AUTH_STATUS)).toHaveText('Saved access token!', {
    timeout: SDK_INIT_TIMEOUT,
  });
  await expect(page.locator(SELECTORS.REGISTER_BTN)).toBeEnabled({timeout: SDK_INIT_TIMEOUT});

  const hasCallingClient = await page.evaluate(() => !!(window as any).callingClient);
  expect(hasCallingClient).toBe(true);
};

/**
 * Set service indicator before initialization (calling, contactcenter, guestcalling)
 */
export const setServiceIndicator = async (page: Page, service: ServiceIndicator): Promise<void> => {
  await page.locator(SELECTORS.SERVICE_INDICATOR).selectOption(service, {timeout: AWAIT_TIMEOUT});
};

/**
 * Set service domain before initialization (needed for contactcenter)
 */
export const setServiceDomain = async (page: Page, domain: string): Promise<void> => {
  await page.locator(SELECTORS.SERVICE_DOMAIN).fill(domain, {timeout: AWAIT_TIMEOUT});
};

/**
 * Navigate, init SDK, verify, and optionally set service and register line.
 */
export const initAndRegister = async (
  page: Page,
  accessToken: string,
  options: {registerLine?: boolean; service?: ServiceIndicator} = {}
): Promise<void> => {
  const {registerLine, verifyLineRegistered} = await import('./registration');

  await navigateToCallingApp(page);
  if (options.service) {
    await setServiceIndicator(page, options.service);
  }
  await initializeCallingSDK(page, accessToken);
  await verifySDKInitialized(page);
  if (options.registerLine) {
    await registerLine(page);
    await verifyLineRegistered(page);
  }
};
