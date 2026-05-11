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
  captureMobiusDiscoveryResponse,
} from '../utils/setup';
import {
  CALLING_SELECTORS,
  SDK_INIT_TIMEOUT,
  AWAIT_TIMEOUT,
  CC_SERVICE_DOMAIN,
  REGION,
  COUNTRY,
  EXPECTED_PRIMARY_REGION,
  EXPECTED_BACKUP_REGION,
} from '../constants';

/**
 * SDK initialization tests: Normal Calling, Contact Center, Guest Calling, Region/Country,
 * and negative cases (registration blocked without valid init).
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

      // Track region auto-discovery request (ds.ciscospark.com/v1/region)
      const regionDiscoveryRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/v1/region')) {
          regionDiscoveryRequests.push(request.url());
        }
      });

      // Capture the Mobius discovery response before init triggers it
      const discoveryResponsePromise = captureMobiusDiscoveryResponse(page);

      await initializeCallingSDK(page, getToken(role, isInt));
      await verifySDKInitialized(page);

      // Without explicit region, SDK must auto-discover via ds.ciscospark.com
      expect(regionDiscoveryRequests.length).toBeGreaterThanOrEqual(1);

      // Verify discovery response includes primary and backup with regions and URIs.
      // Auto-discovered region depends on the runner's location; primary and backup
      // regions are not guaranteed to differ.
      const discoveryResponse = await discoveryResponsePromise;
      expect(discoveryResponse.primary?.uris?.length).toBeGreaterThan(0);
      expect(discoveryResponse.backup?.uris?.length).toBeGreaterThan(0);
      expect(discoveryResponse.primary.region).toBeTruthy();
      expect(discoveryResponse.backup.region).toBeTruthy();

      // Primary and backup should be different server groups
      expect(discoveryResponse.primary.uris[0]).not.toBe(discoveryResponse.backup.uris[0]);

      // Verify SDK stored the discovered servers correctly
      await verifyMobiusServersDiscovered(page);
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

      // Track any region discovery requests — there should be none when region is explicit
      const regionDiscoveryRequests: string[] = [];
      page.on('request', (request) => {
        if (request.url().includes('/v1/region')) {
          regionDiscoveryRequests.push(request.url());
        }
      });

      const mobiusDiscoveryRequest = waitForMobiusDiscoveryRequest(page, {
        region: REGION,
        country: COUNTRY,
      });

      // Capture the Mobius discovery response to verify primary/backup assignment
      const discoveryResponsePromise = captureMobiusDiscoveryResponse(page);

      await initializeCallingSDK(page, getToken(role, isInt));
      await verifySDKInitialized(page);

      // Verify no region discovery was performed (explicit region bypasses it)
      expect(regionDiscoveryRequests).toHaveLength(0);

      await expect(mobiusDiscoveryRequest).resolves.toContain(
        `regionCode=${encodeURIComponent(REGION)}`
      );
      await expect(mobiusDiscoveryRequest).resolves.toContain(
        `countryCode=${encodeURIComponent(COUNTRY)}`
      );

      // Verify discovery response returned the expected server regions for US-EAST.
      // primary.region / backup.region are internal server names, not the logical regionCode.
      const discoveryResponse = await discoveryResponsePromise;
      const expectedPrimary = isInt ? EXPECTED_PRIMARY_REGION.INT : EXPECTED_PRIMARY_REGION.PROD;
      const expectedBackup = isInt ? EXPECTED_BACKUP_REGION.INT : EXPECTED_BACKUP_REGION.PROD;
      expect(discoveryResponse.primary?.uris?.length).toBeGreaterThan(0);
      expect(discoveryResponse.primary.region).toBe(expectedPrimary);

      // Primary and backup should be different server groups
      if (discoveryResponse.backup?.uris?.length > 0) {
        expect(discoveryResponse.backup.region).toBe(expectedBackup);
        expect(discoveryResponse.primary.uris[0]).not.toBe(discoveryResponse.backup.uris[0]);
      }

      // Verify SDK stored the servers and primary URIs match the response
      await verifyMobiusServersDiscovered(page);

      const storedServers = await page.evaluate(() => {
        const client = (window as any).callingClient;

        return {
          primary: client?.primaryMobiusUris ?? [],
          backup: client?.backupMobiusUris ?? [],
        };
      });

      // Each URI from the discovery primary should appear in the SDK's primary list
      for (const uri of discoveryResponse.primary.uris) {
        expect(storedServers.primary.some((stored: string) => stored.startsWith(uri))).toBe(true);
      }
    });

    test('SDK init - registration blocked without valid initialization', async ({
      page,
      context,
    }) => {
      let mobiusDiscoveryRequests = 0;

      await context.route(/\/calling\/web\//, async (route) => {
        mobiusDiscoveryRequests += 1;
        await route.continue();
      });

      await navigateToCallingApp(page);

      // Before any init attempt: no client, buttons disabled
      expect(await page.evaluate(() => !!(window as any).callingClient)).toBe(false);
      await expect(page.locator(CALLING_SELECTORS.REGISTER_BTN)).toBeDisabled({
        timeout: AWAIT_TIMEOUT,
      });
      await expect(page.locator(CALLING_SELECTORS.UNREGISTER_BTN)).toBeDisabled({
        timeout: AWAIT_TIMEOUT,
      });

      // Attempt init with empty token — should not create a client
      await setServiceIndicator(page, 'calling');
      await page.locator(CALLING_SELECTORS.INITIALIZE_CALLING_BTN).click({timeout: AWAIT_TIMEOUT});
      await page.waitForTimeout(5000);

      expect(mobiusDiscoveryRequests).toBe(0);
      expect(await page.evaluate(() => !!(window as any).callingClient)).toBe(false);
      await expect(page.locator(CALLING_SELECTORS.REGISTER_BTN)).toBeDisabled({
        timeout: AWAIT_TIMEOUT,
      });
    });
  });
}
