import {test, expect} from '@playwright/test';
import {getToken, getUserSet, isIntProject} from '../test-data';
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

/**
 * SDK initialization tests: Normal Calling, Contact Center, Guest Calling, Region/Country.
 * All tests use a single account from the owning set.
 */
export function sdkInitTests() {
  test.describe('SDK Initialization', () => {
    test('Normal Calling - init with calling service indicator', async ({page}, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      const role = getUserSet(testInfo.project.name).accounts[0];

      await navigateToCallingApp(page);
      if (isInt) await setEnvironmentToInt(page);
      await setServiceIndicator(page, 'calling');

      await initializeCallingSDK(page, getToken(role, isInt));
      await verifySDKInitialized(page);
    });

    test('Contact Center - init with contactcenter service indicator', async ({page}, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      const role = getUserSet(testInfo.project.name).accounts[0];

      await navigateToCallingApp(page);
      if (isInt) await setEnvironmentToInt(page);
      await setServiceIndicator(page, 'contactcenter');
      await setServiceDomain(page, CC_SERVICE_DOMAIN);

      await initializeCallingSDK(page, getToken(role, isInt));
      await verifySDKInitialized(page);
    });

    test('Guest Calling - generate guest token and init', async ({page}, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      test.skip(isInt, 'Guest calling is prod-only');

      await navigateToCallingApp(page);
      await setServiceIndicator(page, 'guestcalling');

      await expect(page.locator(CALLING_SELECTORS.GUEST_CONTAINER)).toBeVisible({
        timeout: AWAIT_TIMEOUT,
      });

      await page
        .locator(CALLING_SELECTORS.GENERATE_GUEST_TOKEN_BTN)
        .click({timeout: AWAIT_TIMEOUT});

      await expect(page.locator(CALLING_SELECTORS.ACCESS_TOKEN_INPUT)).not.toHaveValue('', {
        timeout: SDK_INIT_TIMEOUT,
      });

      await page.locator(CALLING_SELECTORS.INITIALIZE_CALLING_BTN).click({timeout: AWAIT_TIMEOUT});
      await verifySDKInitialized(page);
    });

    test('Normal Calling - init with explicit region and country', async ({page}, testInfo) => {
      const isInt = isIntProject(testInfo.project.name);
      const role = getUserSet(testInfo.project.name).accounts[0];

      await navigateToCallingApp(page);
      if (isInt) await setEnvironmentToInt(page);
      await setServiceIndicator(page, 'calling');
      await setCountry(page, COUNTRY);
      await setRegion(page, REGION);

      const mobiusDiscoveryRequest = waitForMobiusDiscoveryRequest(page, {
        region: REGION,
        country: COUNTRY,
      });

      await initializeCallingSDK(page, getToken(role, isInt));
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
}
