import {Page, expect} from '@playwright/test';
import {
  SAMPLE_APP_PATH,
  SELECTORS,
  AWAIT_TIMEOUT,
  SDK_INIT_TIMEOUT,
  REGISTRATION_TIMEOUT,
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
export const setServiceIndicator = async (
  page: Page,
  service: 'calling' | 'contactcenter' | 'guestcalling'
): Promise<void> => {
  await page.locator(SELECTORS.SERVICE_INDICATOR).selectOption(service, {timeout: AWAIT_TIMEOUT});
};

/**
 * Set service domain before initialization (needed for contactcenter)
 */
export const setServiceDomain = async (page: Page, domain: string): Promise<void> => {
  await page.locator(SELECTORS.SERVICE_DOMAIN).fill(domain, {timeout: AWAIT_TIMEOUT});
};

export const registerLine = async (page: Page): Promise<void> => {
  await page.locator(SELECTORS.REGISTER_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.REGISTRATION_STATUS)).toContainText('Registered, deviceId:', {
    timeout: REGISTRATION_TIMEOUT,
  });
};

export const verifyLineRegistered = async (page: Page): Promise<void> => {
  await expect(page.locator(SELECTORS.REGISTRATION_STATUS)).toContainText('Registered, deviceId:', {
    timeout: REGISTRATION_TIMEOUT,
  });
  await expect(page.locator(SELECTORS.REGISTER_BTN)).toBeDisabled({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.UNREGISTER_BTN)).toBeEnabled({timeout: AWAIT_TIMEOUT});
};

export const unregisterLine = async (page: Page): Promise<void> => {
  await page.locator(SELECTORS.UNREGISTER_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.REGISTRATION_STATUS)).toContainText('Un registering', {
    timeout: REGISTRATION_TIMEOUT,
  });
};

export const fullSetup = async (
  page: Page,
  accessToken: string,
  options: {registerLine?: boolean; service?: 'calling' | 'contactcenter' | 'guestcalling'} = {}
): Promise<void> => {
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

// TODO: Uncomment these utilities as tests are added for calls, etc.
/*
export const getMediaStreams = async (page: Page): Promise<void> => {
  await page.locator(SELECTORS.GET_MEDIA_STREAMS_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.MAKE_CALL_BTN)).toBeEnabled({timeout: AWAIT_TIMEOUT});
};

export const makeCall = async (page: Page, destination: string): Promise<void> => {
  await page.locator(SELECTORS.DESTINATION_INPUT).fill(destination, {timeout: AWAIT_TIMEOUT});
  await page.locator(SELECTORS.MAKE_CALL_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.MAKE_CALL_BTN)).toBeDisabled({timeout: AWAIT_TIMEOUT});
};

export const waitForIncomingCall = async (page: Page, timeout = 60000): Promise<void> => {
  await expect(page.locator(SELECTORS.INCOMING_CALL)).toContainText('Call from', {timeout});
  await expect(page.locator(SELECTORS.ANSWER_BTN).first()).toBeEnabled({timeout: AWAIT_TIMEOUT});
};

export const answerCall = async (page: Page): Promise<void> => {
  await page.locator(SELECTORS.ANSWER_BTN).first().click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.ANSWER_BTN).first()).toBeDisabled({timeout: AWAIT_TIMEOUT});
};

export const waitForCallEstablished = async (page: Page, timeout = 20000): Promise<void> => {
  await expect(page.locator(SELECTORS.CALL_OBJECT)).toContainText('Call Established', {timeout});
};

export const endCall = async (page: Page): Promise<void> => {
  await page.locator(SELECTORS.END_CALL_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.CALL_OBJECT)).toContainText('Call Disconnected', {
    timeout: AWAIT_TIMEOUT,
  });
};

export const endIncomingCall = async (page: Page): Promise<void> => {
  await page.locator(SELECTORS.END_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.CALL_OBJECT)).toContainText('Call Disconnected', {
    timeout: AWAIT_TIMEOUT,
  });
};

export const rejectCall = async (page: Page): Promise<void> => {
  await page.locator(SELECTORS.END_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.CALL_OBJECT)).toContainText('Call Disconnected', {
    timeout: 30000,
  });
};

export const holdCall = async (page: Page): Promise<void> => {
  await expect(page.locator(SELECTORS.HOLD_BTN)).toHaveValue('Hold', {timeout: AWAIT_TIMEOUT});
  await page.locator(SELECTORS.HOLD_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.CALL_OBJECT)).toContainText('Call is held', {
    timeout: AWAIT_TIMEOUT,
  });
  await expect(page.locator(SELECTORS.HOLD_BTN)).toHaveValue('Resume', {timeout: AWAIT_TIMEOUT});
};

export const resumeCall = async (page: Page): Promise<void> => {
  await expect(page.locator(SELECTORS.HOLD_BTN)).toHaveValue('Resume', {timeout: AWAIT_TIMEOUT});
  await page.locator(SELECTORS.HOLD_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(SELECTORS.CALL_OBJECT)).toContainText('Call is Resumed', {
    timeout: AWAIT_TIMEOUT,
  });
  await expect(page.locator(SELECTORS.HOLD_BTN)).toHaveValue('Hold', {timeout: AWAIT_TIMEOUT});
};

export const sendDTMF = async (page: Page, digit: string): Promise<void> => {
  await page.locator(SELECTORS.DTMF_INPUT).fill(digit, {timeout: AWAIT_TIMEOUT});
  await page.locator(SELECTORS.SEND_DIGIT_BTN).click({timeout: AWAIT_TIMEOUT});
};

export const waitForCallDisconnect = async (page: Page, timeout = 30000): Promise<void> => {
  await expect(page.locator(SELECTORS.CALL_OBJECT)).toContainText('Call Disconnected', {timeout});
  await expect(page.locator(SELECTORS.MAKE_CALL_BTN)).toBeEnabled({timeout: AWAIT_TIMEOUT});
};
*/
