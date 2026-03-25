import {test, expect} from '@playwright/test';
import {
  navigateToCallingApp,
  initializeCallingSDK,
  verifySDKInitialized,
  setServiceIndicator,
  setServiceDomain,
} from '../utils/setup';
import {SELECTORS, SDK_INIT_TIMEOUT, AWAIT_TIMEOUT} from '../utils/constants';

const getCallerToken = (): string => {
  const token = process.env.CALLER_ACCESS_TOKEN;
  if (!token) {
    throw new Error('CALLER_ACCESS_TOKEN not set. Run OAuth setup first.');
  }

  return token;
};

test.describe('SDK Initialization', () => {
  test('Normal Calling - init with calling service indicator', async ({page}) => {
    await navigateToCallingApp(page);
    await setServiceIndicator(page, 'calling');

    const accessToken = getCallerToken();
    await initializeCallingSDK(page, accessToken);
    await verifySDKInitialized(page);
  });

  test('Contact Center - init with contactcenter service indicator', async ({page}) => {
    await navigateToCallingApp(page);
    await setServiceIndicator(page, 'contactcenter');
    await setServiceDomain(page, 'rtw.prod-us1.rtmsprod.net');

    const accessToken = getCallerToken();
    await initializeCallingSDK(page, accessToken);
    await verifySDKInitialized(page);
  });

  test('Guest Calling - generate guest token and init', async ({page}) => {
    await navigateToCallingApp(page);
    await setServiceIndicator(page, 'guestcalling');

    // Guest container should become visible after selecting guestcalling
    await expect(page.locator(SELECTORS.GUEST_CONTAINER)).toBeVisible({timeout: AWAIT_TIMEOUT});

    // Click "Generate Guest Token [Prod only]" - fetches JWT from AWS Lambda
    await page.locator(SELECTORS.GENERATE_GUEST_TOKEN_BTN).click({timeout: AWAIT_TIMEOUT});

    // Wait for the token to be populated in the access token field
    await expect(page.locator(SELECTORS.ACCESS_TOKEN_INPUT)).not.toHaveValue('', {
      timeout: SDK_INIT_TIMEOUT,
    });

    // Click "Initialize Calling" to init with the guest token
    await page.locator(SELECTORS.INITIALIZE_CALLING_BTN).click({timeout: AWAIT_TIMEOUT});

    // Wait for SDK to initialize
    await expect(page.locator(SELECTORS.AUTH_STATUS)).toHaveText('Saved access token!', {
      timeout: SDK_INIT_TIMEOUT,
    });
    await verifySDKInitialized(page);
  });
});
