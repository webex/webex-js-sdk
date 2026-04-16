import {Page, expect} from '@playwright/test';
import {
  SAMPLE_APP_PATH,
  CALLING_SELECTORS,
  AWAIT_TIMEOUT,
  SDK_INIT_TIMEOUT,
  ServiceIndicator,
} from '../constants';
import {registerLine, verifyLineRegistered} from './registration';

type DiscoveryLocation = {
  region: string;
  country: string;
};

export type MobiusDiscoveryResponse = {
  primary: {region: string; uris: string[]};
  backup: {region: string; uris: string[]};
};

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
  await page
    .locator(CALLING_SELECTORS.ACCESS_TOKEN_INPUT)
    .fill(accessToken, {timeout: AWAIT_TIMEOUT});

  // Click "Initialize Calling" (submits the credentials form)
  await page.locator(CALLING_SELECTORS.INITIALIZE_CALLING_BTN).click({timeout: AWAIT_TIMEOUT});

  // Wait for SDK to initialize - status changes to "Saved access token!" on ready
  await expect(page.locator(CALLING_SELECTORS.AUTH_STATUS)).toHaveText('Saved access token!', {
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
  await expect(page.locator(CALLING_SELECTORS.AUTH_STATUS)).toHaveText('Saved access token!', {
    timeout: SDK_INIT_TIMEOUT,
  });
  await expect(page.locator(CALLING_SELECTORS.REGISTER_BTN)).toBeEnabled({
    timeout: SDK_INIT_TIMEOUT,
  });

  const hasCallingClient = await page.evaluate(() => !!(window as any).callingClient);
  expect(hasCallingClient).toBe(true);

  // TODO: Based on the config passed during initialization, verify which clients are active.
  // Different configs can instantiate CallingClient, CallHistoryClient, Voicemail, etc.
  // Add expect statements for each client based on the service indicator / config used.
};

/**
 * Toggle the sample app to Integration environment (clicks "Enable Production" → "In Integration")
 */
export const setEnvironmentToInt = async (page: Page): Promise<void> => {
  await page.locator(CALLING_SELECTORS.ENABLE_PRODUCTION_BTN).click({timeout: AWAIT_TIMEOUT});
  await expect(page.locator(CALLING_SELECTORS.ENABLE_PRODUCTION_BTN)).toHaveText('In Integration', {
    timeout: AWAIT_TIMEOUT,
  });
};

/**
 * Verify the service indicator dropdown is visible and contains all expected options.
 */
export const verifyServiceIndicatorOptions = async (page: Page): Promise<void> => {
  const dropdown = page.locator(CALLING_SELECTORS.SERVICE_INDICATOR);

  await expect(dropdown).toBeVisible({timeout: AWAIT_TIMEOUT});

  const optionValues = await dropdown
    .locator('option:not([disabled])')
    .evaluateAll((opts) => (opts as HTMLOptionElement[]).map((o) => o.value));

  expect(optionValues).toEqual(['calling', 'contactcenter', 'guestcalling']);
};

/**
 * Set service indicator before initialization (calling, contactcenter, guestcalling).
 * Verifies the dropdown is present with the expected options before selecting.
 */
export const setServiceIndicator = async (page: Page, service: ServiceIndicator): Promise<void> => {
  await verifyServiceIndicatorOptions(page);
  await page
    .locator(CALLING_SELECTORS.SERVICE_INDICATOR)
    .selectOption(service, {timeout: AWAIT_TIMEOUT});
};

/**
 * Set service domain before initialization (needed for contactcenter)
 */
export const setServiceDomain = async (page: Page, domain: string): Promise<void> => {
  await page.locator(CALLING_SELECTORS.SERVICE_DOMAIN).fill(domain, {timeout: AWAIT_TIMEOUT});
};

/**
 * Set discovery region before initialization (e.g. 'US-EAST')
 */
export const setRegion = async (page: Page, region: string): Promise<void> => {
  await page.locator(CALLING_SELECTORS.REGION_INPUT).fill(region, {timeout: AWAIT_TIMEOUT});
};

/**
 * Set discovery country before initialization (e.g. 'US')
 */
export const setCountry = async (page: Page, country: string): Promise<void> => {
  await page.locator(CALLING_SELECTORS.COUNTRY_INPUT).fill(country, {timeout: AWAIT_TIMEOUT});
};

/**
 * Wait for the region-based Mobius discovery request triggered during initialization.
 */
export const waitForMobiusDiscoveryRequest = (
  page: Page,
  location: DiscoveryLocation
): Promise<string> =>
  page
    .waitForRequest(
      (request) => {
        if (request.method() !== 'GET' || !request.url().includes('/calling/web/')) {
          return false;
        }

        const url = new URL(request.url());

        return (
          url.searchParams.get('regionCode') === location.region &&
          url.searchParams.get('countryCode') === location.country
        );
      },
      {timeout: SDK_INIT_TIMEOUT}
    )
    .then((request) => request.url());

/**
 * Wait for the Mobius discovery response and return its parsed body.
 * Must be called before initializeCallingSDK triggers the request.
 */
export const captureMobiusDiscoveryResponse = (page: Page): Promise<MobiusDiscoveryResponse> =>
  page
    .waitForResponse(
      (response) =>
        response.request().method() === 'GET' && response.url().includes('/calling/web/'),
      {timeout: SDK_INIT_TIMEOUT}
    )
    .then((response) => response.json() as Promise<MobiusDiscoveryResponse>);

/**
 * Verify the client stored discovered Mobius servers after initialization.
 */
export const verifyMobiusServersDiscovered = async (page: Page): Promise<void> => {
  const mobiusServers = await page.evaluate(() => {
    const client = (window as any).callingClient;

    return {
      primary: client?.primaryMobiusUris ?? [],
      backup: client?.backupMobiusUris ?? [],
    };
  });

  expect(mobiusServers.primary.length + mobiusServers.backup.length).toBeGreaterThan(0);
  expect(
    [...mobiusServers.primary, ...mobiusServers.backup].every((uri: string) =>
      uri.includes('/calling/web/')
    )
  ).toBe(true);
};

/**
 * Navigate, init SDK, verify, and optionally set service and register line.
 */
export const initAndRegister = async (
  page: Page,
  accessToken: string,
  options: {registerLine?: boolean; service?: ServiceIndicator} = {}
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
