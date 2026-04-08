import {test, expect} from '@playwright/test';
import {
  navigateToCallingApp,
  initializeCallingSDK,
  verifySDKInitialized,
  setServiceIndicator,
  setServiceDomain,
  setEnvironmentToInt,
  setRegion,
  setCountry,
  waitForMobiusDiscoveryRequest,
  verifyMobiusServersDiscovered,
} from '../utils/setup';
import {
  CALLING_SELECTORS,
  SDK_INIT_TIMEOUT,
  AWAIT_TIMEOUT,
  CC_SERVICE_DOMAIN,
  REGION,
  COUNTRY,
} from '../constants';

const getToken = (envVar: string): string => {
  const token = process.env[envVar];
  if (!token) {
    throw new Error(`${envVar} not set. Run OAuth setup first.`);
  }

  return token;
};

test.describe('SDK Initialization', () => {
  test.describe.configure({mode: 'parallel'});

  test('Normal Calling - init with calling service indicator', async ({page}, testInfo) => {
    const isInt = (testInfo.project.use as any).testEnv === 'int';
    const envPrefix = isInt ? '_INT' : '';

    await navigateToCallingApp(page);
    if (isInt) await setEnvironmentToInt(page);
    await setServiceIndicator(page, 'calling');

    await initializeCallingSDK(page, getToken(`CALLER${envPrefix}_ACCESS_TOKEN`));
    await verifySDKInitialized(page);
  });

  test('Contact Center - init with contactcenter service indicator', async ({page}, testInfo) => {
    const isInt = (testInfo.project.use as any).testEnv === 'int';
    const envPrefix = isInt ? '_INT' : '';

    await navigateToCallingApp(page);
    if (isInt) await setEnvironmentToInt(page);
    await setServiceIndicator(page, 'contactcenter');
    await setServiceDomain(page, CC_SERVICE_DOMAIN);

    await initializeCallingSDK(page, getToken(`CALLER${envPrefix}_ACCESS_TOKEN`));
    await verifySDKInitialized(page);
  });

  test('Guest Calling - generate guest token and init', async ({page}, testInfo) => {
    const isInt = (testInfo.project.use as any).testEnv === 'int';
    test.skip(isInt, 'Guest calling is prod-only');

    await navigateToCallingApp(page);
    await setServiceIndicator(page, 'guestcalling');

    // Guest container should become visible after selecting guestcalling
    await expect(page.locator(CALLING_SELECTORS.GUEST_CONTAINER)).toBeVisible({
      timeout: AWAIT_TIMEOUT,
    });

    // Click "Generate Guest Token [Prod only]" - fetches JWT from AWS Lambda
    await page.locator(CALLING_SELECTORS.GENERATE_GUEST_TOKEN_BTN).click({timeout: AWAIT_TIMEOUT});

    // Wait for the token to be populated in the access token field
    await expect(page.locator(CALLING_SELECTORS.ACCESS_TOKEN_INPUT)).not.toHaveValue('', {
      timeout: SDK_INIT_TIMEOUT,
    });

    // Click "Initialize Calling" to init with the guest token
    await page.locator(CALLING_SELECTORS.INITIALIZE_CALLING_BTN).click({timeout: AWAIT_TIMEOUT});
    await verifySDKInitialized(page);
  });

  test('Normal Calling - init with explicit region and country', async ({page}, testInfo) => {
    const isInt = (testInfo.project.use as any).testEnv === 'int';
    const envPrefix = isInt ? '_INT' : '';

    await navigateToCallingApp(page);
    if (isInt) await setEnvironmentToInt(page);
    await setServiceIndicator(page, 'calling');
    await setCountry(page, COUNTRY);
    await setRegion(page, REGION);

    const mobiusDiscoveryRequest = waitForMobiusDiscoveryRequest(page, {
      region: REGION,
      country: COUNTRY,
    });

    await initializeCallingSDK(page, getToken(`CALLEE${envPrefix}_ACCESS_TOKEN`));
    await verifySDKInitialized(page);

    await expect(mobiusDiscoveryRequest).resolves.toContain(
      `regionCode=${encodeURIComponent(REGION)}`
    );
    await expect(mobiusDiscoveryRequest).resolves.toContain(
      `countryCode=${encodeURIComponent(COUNTRY)}`
    );
    await verifyMobiusServersDiscovered(page);
  });
});
