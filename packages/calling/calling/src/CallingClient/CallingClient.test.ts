import {LOGGER} from '../Logger/types';
import {getMockDeviceInfo, registration, getTestUtilsWebex} from '../common/testUtil';
import {
  CallDirection,
  CallType,
  MobiusStatus,
  ServiceIndicator,
  WebexRequestPayload,
} from '../common/types';
/* eslint-disable dot-notation */
import {CallSessionEvent, EVENT_KEYS, MOBIUS_EVENT_KEYS} from '../Events/types';
import log from '../Logger';
import {CallingClient, createClient} from './CallingClient';
import {ICallingClient} from './types';
import * as utils from '../common/Utils';
import {getCallManager} from './calling/callManager';
import {
  CALLING_CLIENT_FILE,
  CALLS_CLEARED_HANDLER_UTIL,
  DEFAULT_REHOMING_INTERVAL_MAX,
  DEFAULT_REHOMING_INTERVAL_MIN,
  DEVICES_ENDPOINT_RESOURCE,
  DISCOVERY_URL,
  FAILBACK_429_RETRY_UTIL,
  FAILBACK_UTIL,
  KEEPALIVE_UTIL,
  MINUTES_TO_SEC_MFACTOR,
  NETWORK_CHANGE_DETECTION_UTIL,
  RECONNECT_UTIL,
  REGISTER_UTIL,
  REG_TRY_BACKUP_TIMER_VAL_IN_SEC,
  SEC_TO_MSEC_MFACTOR,
  URL_ENDPOINT,
} from './constants';
import {MOCK_MULTIPLE_SESSIONS_EVENT, MOCK_SESSION_EVENT} from './callRecordFixtures';
import * as regUtils from './registration/register';
import {ICall} from './calling/types';

describe('CallingClient Tests', () => {
  // Common initializers

  const handleErrorSpy = jest.spyOn(utils, 'handleErrors');
  const emitFinalFailureSpy = jest.spyOn(utils, 'emitFinalFailure');
  const webex = getTestUtilsWebex();
  const defaultServiceIndicator = ServiceIndicator.CALLING;
  const callManager = getCallManager(webex, defaultServiceIndicator);

  const originalProcessNextTick = process.nextTick;

  function flushPromises() {
    return new Promise((resolve) => {
      originalProcessNextTick(resolve);
    });
  }

  describe('ServiceData tests', () => {
    let callingClient: ICallingClient | undefined;
    const defaultServiceData = {indicator: ServiceIndicator.CALLING, domain: ''};
    const createRegistrationSpy = jest.spyOn(regUtils, 'createRegistration');

    afterEach(() => {
      callManager.removeAllListeners();
      callingClient = undefined;
    });

    /**
     * No input sdk config to callingClient, it should default to service type
     * calling and empty domain value.
     */
    it('Verify valid calling serviceData with no input sdk config', async () => {
      expect(() => {
        callingClient = createClient(webex);
      }).not.toThrow(Error);
      expect(callingClient).toBeTruthy();
      expect(createRegistrationSpy).toBeCalledWith(webex, defaultServiceData);
    });

    /**
     * Input sdk config to callingClient but no serviceData in it, it should default to
     * service type calling and empty domain value.
     */
    it('Verify valid calling serviceData with no input sdk config', async () => {
      expect(() => {
        callingClient = createClient(webex, {logger: {level: LOGGER.INFO}});
      }).not.toThrow(Error);
      expect(callingClient).toBeTruthy();
      expect(createRegistrationSpy).toBeCalledWith(webex, defaultServiceData);
    });

    /**
     * Input sdk config to callingClient with serviceData carrying empty string for
     * both indicator and domain in it.
     *
     * It should default to service type calling and empty domain value.
     *
     */
    it('Verify invalid empty service indicator, empty domain', async () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const serviceDataObj: any = {indicator: '', domain: ''};

      expect(() => {
        callingClient = createClient(webex, {serviceData: serviceDataObj});
      }).not.toThrow(Error);
      expect(callingClient).toBeTruthy();
      expect(createRegistrationSpy).toBeCalledWith(webex, defaultServiceData);
    });

    /**
     * Input sdk config to callingClient with serviceData carrying invalid value for indicator
     * and empty string for domain field in it.
     *
     * It should throw error and abort execution as indicator value is invalid.
     *
     * INDICATOR value MUST MATCH with one of the values in ServiceIndicator enum.
     */
    it('Verify invalid service indicator, empty domain', async () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const serviceDataObj: any = {indicator: 'test', domain: ''};

      expect(() => {
        callingClient = createClient(webex, {serviceData: serviceDataObj});
      }).toThrow(Error);
      expect(callingClient).toBe(undefined);
      expect(createRegistrationSpy).not.toHaveBeenCalled();
    });

    /**
     * Input sdk config to callingClient with serviceData carrying invalid value for indicator
     * and valid domain type string for domain field in it.
     *
     * It should throw error and abort execution as indicator value is invalid.
     *
     * INDICATOR value MUST MATCH with one of the values in ServiceIndicator enum.
     */
    it('Verify invalid service indicator, valid domain', async () => {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const serviceDataObj: any = {indicator: 'test', domain: 'test.example.com'};

      expect(() => {
        callingClient = createClient(webex, {serviceData: serviceDataObj});
      }).toThrow(Error);
      expect(callingClient).toBe(undefined);
      expect(createRegistrationSpy).not.toHaveBeenCalled();
    });

    /**
     * Input sdk config to callingClient with serviceData carrying valid value for indicator
     * 'calling', but an invalid domain type string for domain field in it.
     *
     * It should throw error and abort execution as domain value is invalid.
     *
     * DOMAIN field for service type calling is allowed to be empty but if it carries a non-empty
     * string then it must be of valid domain type.
     */
    it('CALLING: verify invalid service domain', async () => {
      const serviceDataObj = {indicator: ServiceIndicator.CALLING, domain: 'test'};

      expect(() => {
        callingClient = createClient(webex, {serviceData: serviceDataObj});
      }).toThrow(Error);
      expect(callingClient).toBe(undefined);
      expect(createRegistrationSpy).not.toHaveBeenCalled();
    });

    /**
     * Input sdk config to callingClient with serviceData carrying valid value for indicator
     * 'calling', and an empty string for domain field in it.
     *
     * Execution should proceed properly and createRegistration should be called with same serviceData.
     *
     * DOMAIN field for service type 'calling' is allowed to be empty.
     */
    it('CALLING: verify valid empty service domain', async () => {
      const serviceDataObj = {indicator: ServiceIndicator.CALLING, domain: ''};

      expect(() => {
        callingClient = createClient(webex, {serviceData: serviceDataObj});
      }).not.toThrow(Error);
      expect(callingClient).toBeTruthy();
      expect(createRegistrationSpy).toBeCalledWith(webex, serviceDataObj);
    });

    /**
     * Input sdk config to callingClient with serviceData carrying valid value for indicator
     * 'contactcenter', but an empty string for domain field in it.
     *
     * It should throw error and abort execution as domain value is invalid.
     *
     * DOMAIN field for service type 'contactcenter' must carry a non-empty valid domain type string.
     */
    it('ContactCenter: verify empty invalid service domain', async () => {
      const serviceDataObj = {indicator: ServiceIndicator.CONTACT_CENTER, domain: ''};

      expect(() => {
        callingClient = createClient(webex, {serviceData: serviceDataObj});
      }).toThrow(Error);
      expect(callingClient).toBe(undefined);
      expect(createRegistrationSpy).not.toHaveBeenCalled();
    });

    /**
     * Input sdk config to callingClient with serviceData carrying valid value for indicator
     * 'contactcenter', but an invalid(not of valid domain pattern) string for domain field in it.
     *
     * It should throw error and abort execution as domain value is invalid.
     *
     * DOMAIN field for service type 'contactcenter' must carry a non-empty valid domain type string.
     */
    it('ContactCenter: verify invalid service domain', async () => {
      const serviceDataObj = {indicator: ServiceIndicator.CONTACT_CENTER, domain: 'test'};

      expect(() => {
        callingClient = createClient(webex, {serviceData: serviceDataObj});
      }).toThrow(Error);
      expect(callingClient).toBe(undefined);
      expect(createRegistrationSpy).not.toHaveBeenCalled();
    });

    /**
     * Input sdk config to callingClient with serviceData carrying valid value for indicator
     * 'contactcenter', and a valid domain type string for domain field in it.
     *
     * Execution should proceed properly and createRegistration should be called with same serviceData.
     *
     * DOMAIN field for service type 'contactcenter' must carry a non-empty valid domain type string.
     */
    it('ContactCenter: verify valid service domain', async () => {
      const serviceDataObj = {
        indicator: ServiceIndicator.CONTACT_CENTER,
        domain: 'test.example.com',
      };

      expect(() => {
        callingClient = createClient(webex, {serviceData: serviceDataObj});
      }).not.toThrow(Error);
      expect(callingClient).toBeTruthy();
      expect(createRegistrationSpy).toBeCalledWith(webex, serviceDataObj);
    });
  });

  describe('Registration tests', () => {
    let callingClient: ICallingClient;

    beforeAll(() => {
      callingClient = new CallingClient(webex, {logger: {level: LOGGER.INFO}});
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.clearAllMocks();
      callingClient.removeAllListeners(EVENT_KEYS.ERROR);
      callingClient.removeAllListeners(EVENT_KEYS.REGISTERED);
      callManager.removeAllListeners();
      jest.useRealTimers();
    });

    const mockRegistrationBody = getMockDeviceInfo();

    const mockIPReturnBody = {
      ipv4: '1.1.1.1',
      ipv6: '2.2.2.2',
    };

    const ipPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockIPReturnBody,
    });

    it('verify successful Registration cases', async () => {
      const registrationPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockRegistrationBody,
      });

      callingClient['isRegistered'] = MobiusStatus.DEFAULT;

      const stringToReplace = `${DEVICES_ENDPOINT_RESOURCE}/${mockRegistrationBody.device.deviceId}`;
      const uri = mockRegistrationBody.device.uri.replace(stringToReplace, '');

      callingClient['primaryMobiusUris'] = [uri];
      webex.request.mockReturnValue(registrationPayload);
      registration.createDevice.mockResolvedValue(registrationPayload);

      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      callingClient.register(true);
      await utils.waitForMsecs(100);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      expect(callingClient.getDeviceId()).toBe('beb3c025-8c6a-3c44-8f3d-9b7d65363ac1');
      expect(callingClient.getMobiusUrl()).toBe(
        'https://mobius.aintgen-a-1.int.infra.webex.com/api/v1/calling/web/'
      );
      expect(handleErrorSpy).not.toHaveBeenCalled();
    });

    it('verify successful Registration cases when region discovery fails', async () => {
      const logSpy = jest.spyOn(log, 'warn');
      const registrationPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockRegistrationBody,
      });

      callingClient['isRegistered'] = MobiusStatus.DEFAULT;

      webex.request.mockReturnValueOnce(ipPayload).mockReturnValue(registrationPayload);
      registration.createDevice.mockResolvedValue(registrationPayload);

      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      callingClient.register(false);

      await utils.waitForMsecs(20);

      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      expect(handleErrorSpy).not.toHaveBeenCalled();
      const stringToReplace = `${DEVICES_ENDPOINT_RESOURCE}/${mockRegistrationBody.device.deviceId}`;

      const uri = mockRegistrationBody.device.uri.replace(stringToReplace, '');

      expect(callingClient.getMobiusUrl()).toBe(uri);
      expect(webex.request).toBeCalledWith({
        addAuthHeader: false,
        headers: {'spark-user-agent': null},
        method: 'GET',
        uri: `${DISCOVERY_URL}/${mockIPReturnBody.ipv4}`,
      });
      expect(logSpy).toBeCalledTimes(1);
      expect(logSpy).toBeCalledWith(
        'Error in finding Mobius Servers. Will use the default URL.',
        ''
      );
    });

    it('verify failure Registration cases all requests fail ', async () => {
      const logSpy = jest.spyOn(log, 'warn');

      callingClient['isRegistered'] = MobiusStatus.DEFAULT;
      webex.request.mockImplementation(() => {
        throw new Error();
      });

      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      callingClient.register(false);
      await utils.waitForMsecs(20);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      expect(handleErrorSpy).toHaveBeenCalled();
      expect(logSpy).toBeCalledWith(
        'Error in finding Mobius Servers. Will use the default URL.',
        ''
      );
    });

    it('verify successful Registration cases when region discovery succeeds but region based Mobius Url fails', async () => {
      const logSpy = jest.spyOn(log, 'warn');
      const registrationPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockRegistrationBody,
      });

      const regionBody = {
        attribution:
          'This product includes GeoLite2 data created by MaxMind, available from http://www.maxmind.com',
        clientAddress: '72.163.220.6',
        clientRegion: 'AP-SOUTHEAST',
        countryCode: 'IN',
        disclaimer:
          'This service is intended for use by Webex Team only. Unauthorized use is prohibited.',
        regionCode: 'AP-SOUTHEAST',
        timezone: 'Asia/Kolkata',
      };

      const regionPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: regionBody,
      });

      callingClient['isRegistered'] = MobiusStatus.DEFAULT;

      jest
        .spyOn(webex, 'request')
        .mockResolvedValueOnce(ipPayload)
        .mockResolvedValueOnce(regionPayload)
        .mockRejectedValueOnce({statusCode: 404})
        .mockResolvedValue(registrationPayload);

      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      await callingClient.register(false);
      await utils.waitForMsecs(50);

      expect(handleErrorSpy).toHaveBeenCalled();
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);

      const stringToReplace = `${DEVICES_ENDPOINT_RESOURCE}/${mockRegistrationBody.device.deviceId}`;

      const uri = mockRegistrationBody.device.uri.replace(stringToReplace, '');

      expect(callingClient.getMobiusUrl()).toBe(uri);
      expect(logSpy).toBeCalledWith(
        'Error in finding Mobius Servers. Will use the default URL.',
        ''
      );
    });

    it('verify failure Registration cases', async () => {
      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 401,
        body: mockRegistrationBody,
      });

      callingClient['isRegistered'] = MobiusStatus.DEFAULT;
      webex.request.mockRejectedValue(failurePayload);
      const stringToReplace = `${DEVICES_ENDPOINT_RESOURCE}/${mockRegistrationBody.device.deviceId}`;
      const uri = mockRegistrationBody.device.uri.replace(stringToReplace, '');

      callingClient['primaryMobiusUris'] = [uri];
      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      callingClient.register(true);
      await utils.waitForMsecs(100);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      expect(handleErrorSpy).toHaveBeenCalled();
    });

    it('verify failure Registration case with 403-101: Restore success', async () => {
      const restoreSpy = jest.spyOn(callingClient, 'restorePreviousRegistration');
      const deRegSpy = jest.spyOn(callingClient, 'deregister');
      const registerSpy = jest.spyOn(callingClient as any, REGISTER_UTIL);
      const successPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockRegistrationBody,
      });
      const mobiusUri = 'https://mobius.webex.com/api/v1/calling/web/';
      const deviceId = '30d84f70-eb44-3ef0-8e59-28d0b8c7cad7';

      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 403,
        headers: {
          trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
        },
        body: {
          userId: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
          errorCode: 101,
          devices: [
            {
              deviceId,
              uri: `${mobiusUri}${DEVICES_ENDPOINT_RESOURCE}/${deviceId}`,
              status: 'active',
              lastSeen: '2022-04-07T18:00:40Z',
              addresses: ['sip:sipAddress@webex.com'],
            },
          ],
        },
      });

      callingClient['isRegistered'] = MobiusStatus.DEFAULT;
      jest
        .spyOn(callingClient['registration'], 'createDevice')
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValueOnce(successPayload);

      callingClient['primaryMobiusUris'] = [mobiusUri];
      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      let unregistered = false;

      callingClient.on(EVENT_KEYS.UNREGISTERED, () => {
        unregistered = true;
      });
      await callingClient.register(true);
      expect(unregistered).toBe(false);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      expect(handleErrorSpy).toHaveBeenCalled();
      expect(callingClient.getMobiusUrl()).toBe(mobiusUri);
      expect(deRegSpy).toBeCalledOnceWith();
      expect(restoreSpy).toBeCalledOnceWith(REGISTER_UTIL);
      expect(registerSpy).toBeCalledTimes(2);
    });

    it('verify unreachable Primary with reachable Backup Mobius', async () => {
      jest.useFakeTimers();
      const catalogBody = {
        primary: {
          region: 'ap-southeast-2',
          uris: ['https://mobius.asydm-m-1.prod.infra.webex.com/api/v1'],
        },
        backup: {
          region: 'us-east-1',
          uris: ['https://mobius.aiadgen-a-1.prod.infra.webex.com/api/v1'],
        },
      };

      const regionBody = {
        attribution:
          'This product includes GeoLite2 data created by MaxMind, available from http://www.maxmind.com',
        clientAddress: '72.163.220.6',
        clientRegion: 'AP-SOUTHEAST',
        countryCode: 'IN',
        disclaimer:
          'This service is intended for use by Webex Team only. Unauthorized use is prohibited.',
        regionCode: 'AP-SOUTHEAST',
        timezone: 'Asia/Kolkata',
      };

      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 500,
        body: mockRegistrationBody,
      });

      const catalogPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: catalogBody,
      });

      const successPayload = {
        statusCode: 200,
        body: mockRegistrationBody,
      };

      const regionPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: regionBody,
      });

      jest
        .spyOn(webex, 'request')
        .mockResolvedValueOnce(ipPayload)
        .mockResolvedValueOnce(regionPayload)
        .mockResolvedValueOnce(catalogPayload);

      callingClient['isRegistered'] = MobiusStatus.DEFAULT;
      callingClient['deviceInfo'] = {};

      jest
        .spyOn(callingClient['registration'], 'createDevice')
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValueOnce(successPayload);

      await callingClient.register(false);
      jest.advanceTimersByTime(REG_TRY_BACKUP_TIMER_VAL_IN_SEC * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      const activeUrl = callingClient.getMobiusUrl();
      const backupUrl = `${catalogBody.backup.uris[0]}${URL_ENDPOINT}`;

      expect(handleErrorSpy).toBeCalledTimes(2);
      /* Active Url must match with the backup url as per the test */
      expect(activeUrl).toStrictEqual(backupUrl);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
    });

    it('verify unreachable Primary and Backup Mobius', async () => {
      jest.useFakeTimers();
      /* Adding same url twice to validate duplicate entries get removed in final mobius uri array. */
      const catalogBody = {
        primary: {
          region: 'ap-southeast-2',
          uris: [
            'https://mobius.asydm-m-1.prod.infra.webex.com/api/v1',
            'https://mobius.asydm-m-1.prod.infra.webex.com/api/v1',
          ],
        },
        backup: {
          region: 'us-east-1',
          uris: [
            'https://mobius.aiadgen-a-1.prod.infra.webex.com/api/v1',
            'https://mobius.aiadgen-a-1.prod.infra.webex.com/api/v1',
          ],
        },
      };

      const regionBody = {
        attribution:
          'This product includes GeoLite2 data created by MaxMind, available from http://www.maxmind.com',
        clientAddress: '72.163.220.6',
        clientRegion: 'AP-SOUTHEAST',
        countryCode: 'IN',
        disclaimer:
          'This service is intended for use by Webex Team only. Unauthorized use is prohibited.',
        regionCode: 'AP-SOUTHEAST',
        timezone: 'Asia/Kolkata',
      };

      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 500,
        body: mockRegistrationBody,
      });

      const catalogPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: catalogBody,
      });

      const regionPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: regionBody,
      });

      jest
        .spyOn(webex, 'request')
        .mockResolvedValueOnce(ipPayload)
        .mockResolvedValueOnce(regionPayload)
        .mockResolvedValueOnce(catalogPayload);

      callingClient['isRegistered'] = MobiusStatus.DEFAULT;
      callingClient['deviceInfo'] = {};

      jest.spyOn(callingClient['registration'], 'createDevice').mockRejectedValue(failurePayload);

      await callingClient.register(false);
      jest.advanceTimersByTime(REG_TRY_BACKUP_TIMER_VAL_IN_SEC * SEC_TO_MSEC_MFACTOR);
      await flushPromises();
      jest.advanceTimersByTime(REG_TRY_BACKUP_TIMER_VAL_IN_SEC * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      /*
       * 2 calls for primary -> initial and after timer expiry.
       * 2 calls for each backup entry -> 2 * 2 = 4.
       * So a total of 6 calls to handleErrors.
       */
      expect(handleErrorSpy).toBeCalledTimes(6);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      expect(emitFinalFailureSpy).toBeCalledOnceWith(
        callingClient,
        'startFailoverTimer',
        'CallingClient'
      );
      /* Validate duplicate entries are removed, primary should have 1 and backup should have 1 + 1(default uri) */
      expect(callingClient['primaryMobiusUris'].length).toBe(1);
      expect(callingClient['backupMobiusUris'].length).toBe(2);
    });

    it('verify registration failure with only unreachable default url in server list', async () => {
      jest.useFakeTimers();

      const catalogBody = {
        primary: {},
        backup: {},
      };

      const regionBody = {
        attribution:
          'This product includes GeoLite2 data created by MaxMind, available from http://www.maxmind.com',
        clientAddress: '72.163.220.6',
        clientRegion: 'AP-SOUTHEAST',
        countryCode: 'IN',
        disclaimer:
          'This service is intended for use by Webex Team only. Unauthorized use is prohibited.',
        regionCode: 'AP-SOUTHEAST',
        timezone: 'Asia/Kolkata',
      };

      const catalogPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: catalogBody,
      });

      const regionPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: regionBody,
      });

      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 500,
        body: '',
      });

      jest
        .spyOn(webex, 'request')
        .mockResolvedValueOnce(ipPayload)
        .mockResolvedValueOnce(regionPayload)
        .mockResolvedValueOnce(catalogPayload);

      callingClient['isRegistered'] = MobiusStatus.DEFAULT;

      jest
        .spyOn(callingClient['registration'], 'createDevice')
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload);

      callingClient['primaryMobiusUris'] = [];
      callingClient['backupMobiusUris'] = [];
      await callingClient.register(false);
      jest.advanceTimersByTime(REG_TRY_BACKUP_TIMER_VAL_IN_SEC * SEC_TO_MSEC_MFACTOR);
      await flushPromises();

      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      expect(handleErrorSpy).toHaveBeenCalledTimes(2);
      expect(emitFinalFailureSpy).toBeCalledOnceWith(
        callingClient,
        'startFailoverTimer',
        'CallingClient'
      );
    });

    it('Verify successful registration after initializing callingClient through a config', async () => {
      const logSpy = jest.spyOn(log, 'info');

      const catalogBody = {
        primary: {
          region: 'ap-southeast-2',
          uris: ['https://mobius.asydm-m-1.prod.infra.webex.com/api/v1'],
        },
        backup: {
          region: 'us-east-1',
          uris: ['https://mobius.aiadgen-a-1.prod.infra.webex.com/api/v1'],
        },
      };

      const registrationPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 500,
        body: mockRegistrationBody,
      });

      const catalogPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: catalogBody,
      });

      callingClient = new CallingClient(webex, {
        discovery: {
          region: 'AP-SOUTHEAST',
          country: 'IN',
        },
        logger: {
          level: LOGGER.INFO,
        },
      });

      callingClient['isRegistered'] = MobiusStatus.DEFAULT;
      webex.request.mockResolvedValue(catalogPayload);
      registration.createDevice.mockResolvedValue(registrationPayload);

      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      callingClient.register(false);
      await utils.waitForMsecs(50);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);

      const uri = `${catalogBody.primary.uris[0]}${URL_ENDPOINT}`;

      expect(callingClient.getMobiusUrl()).toBe(uri);
      expect(logSpy).toHaveBeenCalledWith('Updating region and country from the SDK config', {
        file: 'CallingClient',
        method: 'getMobiusServers',
      });
    });
  });

  describe('Registration failback tests', () => {
    const callingClient: ICallingClient = new CallingClient(webex, {logger: {level: LOGGER.INFO}});
    const failbackSpy = jest.spyOn(callingClient as any, FAILBACK_UTIL);
    const restartSpy = jest.spyOn(callingClient as any, 'restartRegistration');
    const failbackRetry429Spy = jest.spyOn(callingClient as any, FAILBACK_429_RETRY_UTIL);
    const restoreSpy = jest.spyOn(callingClient, 'restorePreviousRegistration');
    const deRegSpy = jest.spyOn(callingClient, 'deregister');
    const regUtilSpy = jest.spyOn(callingClient as any, REGISTER_UTIL);
    const logSpy = jest.spyOn(log, 'log');
    const warnSpy = jest.spyOn(log, 'warn');

    const catalogBody = {
      primary: {
        region: 'ap-southeast-2',
        uris: ['https://mobius.asydm-m-1.prod.infra.webex.com/api/v1'],
      },
      backup: {
        region: 'us-east-1',
        uris: ['https://mobius.aiadgen-a-1.prod.infra.webex.com/api/v1'],
      },
    };

    const backupUrl = `${catalogBody.backup.uris[0]}${URL_ENDPOINT}`;
    const primaryUrl = `${catalogBody.primary.uris[0]}${URL_ENDPOINT}`;

    const regionBody = {
      attribution:
        'This product includes GeoLite2 data created by MaxMind, available from http://www.maxmind.com',
      clientAddress: '72.163.220.6',
      clientRegion: 'AP-SOUTHEAST',
      countryCode: 'IN',
      disclaimer:
        'This service is intended for use by Webex Team only. Unauthorized use is prohibited.',
      regionCode: 'AP-SOUTHEAST',
      timezone: 'Asia/Kolkata',
    };

    const mockRegistrationBody = {
      device: {
        deviceId: 'beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
        uri: 'https://mobius.aiadgen-a-1.prod.infra.webex.com/api/v1/calling/web/devices/beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
        status: 'active',
        lastSeen: '2022-04-05T05:08:46Z',
        addresses: ['sip:pbs9p4cbr9_G6JJNI5DD5NP@64941297.int10.bcld.webex.com'],
        clientDeviceUri: 'https://clientDeviceUrl',
      },
      rehomingIntervalMin: 90,
      rehomingIntervalMax: 180,
    };

    const mockIPReturnBody = {
      ipv4: '1.1.1.1',
      ipv6: '2.2.2.2',
    };

    const ipPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockIPReturnBody,
    });

    const failurePayload = <WebexRequestPayload>(<unknown>{
      statusCode: 500,
      body: mockRegistrationBody,
    });

    const failurePayload429 = <WebexRequestPayload>(<unknown>{
      statusCode: 429,
      body: mockRegistrationBody,
    });

    const catalogPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: catalogBody,
    });

    const successPayload = {
      statusCode: 200,
      body: mockRegistrationBody,
    };

    const regionPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: regionBody,
    });

    const createDeviceSpy = jest.spyOn(callingClient['registration'], 'createDevice');

    afterEach(() => {
      jest.clearAllTimers();
      jest.clearAllMocks();

      const calls = Object.values(callingClient['callManager']['getActiveCalls']()) as ICall[];

      calls.forEach((call) => {
        call.end();
      });

      callingClient.removeAllListeners(EVENT_KEYS.ERROR);
      callingClient.removeAllListeners(EVENT_KEYS.REGISTERED);
      callManager.removeAllListeners();
      callingClient['clearFailbackTimer']();
      jest.useRealTimers();
    });

    beforeEach(async () => {
      callingClient['isRegistered'] = MobiusStatus.DEFAULT;
      callingClient['deviceInfo'] = {};
      callingClient['rehomingIntervalMin'] = DEFAULT_REHOMING_INTERVAL_MIN;
      callingClient['rehomingIntervalMax'] = DEFAULT_REHOMING_INTERVAL_MAX;
      jest.useFakeTimers();
      jest
        .spyOn(webex, 'request')
        .mockResolvedValueOnce(ipPayload)
        .mockResolvedValueOnce(regionPayload)
        .mockResolvedValueOnce(catalogPayload);

      createDeviceSpy
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValueOnce(successPayload);

      await callingClient.register(false);
      jest.advanceTimersByTime(REG_TRY_BACKUP_TIMER_VAL_IN_SEC * SEC_TO_MSEC_MFACTOR);
      await flushPromises();
    });

    it('verify 429 error with failback to primary after initial registration with backup: Restore failure', async () => {
      /* These 2 calls to handleErrorSpy are for primary after which it fails over to backup */
      expect(handleErrorSpy).toBeCalledTimes(2);
      /* Active Url must match with the backup url as per the test */
      expect(callingClient.getMobiusUrl()).toStrictEqual(backupUrl);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);

      createDeviceSpy.mockRejectedValueOnce(failurePayload429).mockRejectedValue(failurePayload);

      /* Wait for failback to be triggered. */
      jest.advanceTimersByTime(
        callingClient['rehomingIntervalMax'] * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );
      await flushPromises();

      expect(failbackSpy).toBeCalledOnceWith();
      expect(failbackRetry429Spy).toBeCalledOnceWith();
      expect(callingClient['failback429RetryAttempts']).toBe(0);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      expect(restoreSpy).toBeCalledOnceWith(FAILBACK_429_RETRY_UTIL);
      expect(restartSpy).toBeCalledOnceWith(FAILBACK_429_RETRY_UTIL);
      expect(callingClient['failbackTimer']).toBe(undefined);
      expect(callingClient['rehomingIntervalMin']).toBe(DEFAULT_REHOMING_INTERVAL_MIN);
      expect(callingClient['rehomingIntervalMax']).toBe(DEFAULT_REHOMING_INTERVAL_MAX);
    });

    it('verify 429 error with failback to primary after initial registration with backup: Restore success', async () => {
      /* These 2 calls to handleErrorSpy are for primary after which it fails over to backup */
      expect(handleErrorSpy).toBeCalledTimes(2);
      /* Active Url must match with the backup url as per the test */
      expect(callingClient.getMobiusUrl()).toStrictEqual(backupUrl);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);

      createDeviceSpy.mockRejectedValueOnce(failurePayload429).mockResolvedValue(successPayload);

      /* Wait for failback to be triggered. */
      jest.advanceTimersByTime(
        callingClient['rehomingIntervalMax'] * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );
      await flushPromises();

      expect(failbackSpy).toBeCalledOnceWith();
      expect(failbackRetry429Spy).toBeCalledOnceWith();
      expect(callingClient['failback429RetryAttempts']).toBeGreaterThan(0);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      expect(callingClient.getMobiusUrl()).toStrictEqual(backupUrl);
      expect(restoreSpy).toBeCalledOnceWith(FAILBACK_429_RETRY_UTIL);
      expect(restartSpy).not.toBeCalled();
      expect(callingClient['failbackTimer']).toBeTruthy();
      expect(callingClient['rehomingIntervalMin']).toBe(DEFAULT_REHOMING_INTERVAL_MIN);
      expect(callingClient['rehomingIntervalMax']).toBe(DEFAULT_REHOMING_INTERVAL_MAX);
    });

    it('verify unsuccessful failback to primary after initial registration with backup: Restore failure', async () => {
      /* These 2 calls to handleErrorSpy are for primary after which it fails over to backup */
      expect(handleErrorSpy).toBeCalledTimes(2);
      /* Active Url must match with the backup url as per the test */
      expect(callingClient.getMobiusUrl()).toStrictEqual(backupUrl);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);

      createDeviceSpy.mockRejectedValue(failurePayload);

      /* Wait for failback to be triggered. */
      jest.advanceTimersByTime(
        callingClient['rehomingIntervalMax'] * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );
      await flushPromises();

      expect(failbackSpy).toBeCalledOnceWith();
      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      expect(restoreSpy).toBeCalledOnceWith(FAILBACK_UTIL);
      expect(restartSpy).toBeCalledOnceWith(FAILBACK_UTIL);
      expect(callingClient['rehomingIntervalMin']).toBe(DEFAULT_REHOMING_INTERVAL_MIN);
      expect(callingClient['rehomingIntervalMax']).toBe(DEFAULT_REHOMING_INTERVAL_MAX);
    });

    it('verify unsuccessful failback to primary after initial registration with backup: Restore failure with final error', async () => {
      /* These 2 calls to handleErrorSpy are for primary after which it fails over to backup */
      expect(handleErrorSpy).toBeCalledTimes(2);
      /* Active Url must match with the backup url as per the test */
      expect(callingClient.getMobiusUrl()).toStrictEqual(backupUrl);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);

      const finalErrorPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 401,
        body: mockRegistrationBody,
      });

      createDeviceSpy.mockRejectedValueOnce(failurePayload).mockRejectedValue(finalErrorPayload);

      /* Wait for failback to be triggered. */
      jest.advanceTimersByTime(
        callingClient['rehomingIntervalMax'] * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );
      await flushPromises();

      expect(failbackSpy).toBeCalledOnceWith();
      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      expect(restoreSpy).toBeCalledOnceWith(FAILBACK_UTIL);
      expect(restartSpy).not.toBeCalled();
      expect(callingClient['failbackTimer']).toBe(undefined);
      expect(callingClient['rehomingIntervalMin']).toBe(DEFAULT_REHOMING_INTERVAL_MIN);
      expect(callingClient['rehomingIntervalMax']).toBe(DEFAULT_REHOMING_INTERVAL_MAX);
    });

    it('verify unsuccessful failback to primary after initial registration with backup: Restore success', async () => {
      /* These 2 calls to handleErrorSpy are for primary after which it fails over to backup */
      expect(handleErrorSpy).toBeCalledTimes(2);
      /* Active Url must match with the backup url as per the test */
      expect(callingClient.getMobiusUrl()).toStrictEqual(backupUrl);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);

      createDeviceSpy.mockRejectedValueOnce(failurePayload).mockResolvedValue(successPayload);

      /* Wait for failback to be triggered. */
      jest.advanceTimersByTime(
        callingClient['rehomingIntervalMax'] * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );
      await flushPromises();

      expect(failbackSpy).toBeCalledOnceWith();
      /* Active Url should still match backup url */
      expect(callingClient.getMobiusUrl()).toStrictEqual(backupUrl);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      expect(restoreSpy).toBeCalledOnceWith(FAILBACK_UTIL);
      expect(restartSpy).not.toBeCalled();
      expect(callingClient['rehomingIntervalMin']).toBe(DEFAULT_REHOMING_INTERVAL_MIN);
      expect(callingClient['rehomingIntervalMax']).toBe(DEFAULT_REHOMING_INTERVAL_MAX);
    });

    it('verify successful failback to primary after initial registration with backup', async () => {
      /* These 2 calls to handleErrorSpy are for primary after which it fails over to backup */
      expect(handleErrorSpy).toBeCalledTimes(2);
      /* Active Url must match with the backup url as per the test */
      expect(callingClient.getMobiusUrl()).toStrictEqual(backupUrl);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);

      createDeviceSpy.mockResolvedValue(successPayload);

      /* Wait for failback to be triggered. */
      jest.advanceTimersByTime(
        callingClient['rehomingIntervalMax'] * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );
      await flushPromises();

      expect(failbackSpy).toBeCalledOnceWith();
      /* Active Url must now match with the primary url */
      expect(callingClient.getMobiusUrl()).toStrictEqual(primaryUrl);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      expect(callingClient['failbackTimer']).toBe(undefined);
      expect(restoreSpy).not.toBeCalled();
      expect(callingClient['rehomingIntervalMin']).toBe(
        mockRegistrationBody['rehomingIntervalMin']
      );
      expect(callingClient['rehomingIntervalMax']).toBe(
        mockRegistrationBody['rehomingIntervalMax']
      );
    });

    it('verify rehoming to primary due to network flap before failback timer fires', async () => {
      /* These 2 calls to handleErrorSpy are for primary after which it fails over to backup */
      expect(handleErrorSpy).toBeCalledTimes(2);
      /* Active Url must match with the backup url as per the test */
      expect(callingClient.getMobiusUrl()).toStrictEqual(backupUrl);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);

      createDeviceSpy.mockRejectedValueOnce(failurePayload).mockResolvedValue(successPayload);

      callingClient[NETWORK_CHANGE_DETECTION_UTIL]();

      /* Set mercury connection to be down and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = false;
      jest.advanceTimersByTime(2500);

      /* We should be detecting the network flap */
      expect(warnSpy).toHaveBeenCalledWith(
        'Network has flapped, waiting for mercury connection to be up',
        {file: 'CallingClient', method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      /* Set mercury connection to be up and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = true;
      jest.advanceTimersByTime(
        callingClient['rehomingIntervalMax'] * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );

      await flushPromises();

      /* We should be detecting the network recovery */
      expect(logSpy).toHaveBeenCalledWith(
        'Mercury connection is up again, Re-registering with Mobius',
        {file: 'CallingClient', method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      /* Active Url must now match with the primary url */
      expect(callingClient.getMobiusUrl()).toStrictEqual(primaryUrl);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      expect(callingClient['failbackTimer']).toBe(undefined);
      expect(restoreSpy).toBeCalledOnceWith(NETWORK_CHANGE_DETECTION_UTIL);
      expect(restartSpy).toBeCalledOnceWith(NETWORK_CHANGE_DETECTION_UTIL);
      expect(regUtilSpy).toHaveBeenCalledWith(NETWORK_CHANGE_DETECTION_UTIL);
      expect(failbackSpy).toBeCalledOnceWith();
      expect(regUtilSpy).not.toBeCalledWith(FAILBACK_UTIL);
      expect(callingClient['rehomingIntervalMin']).toBe(
        mockRegistrationBody['rehomingIntervalMin']
      );
      expect(callingClient['rehomingIntervalMax']).toBe(
        mockRegistrationBody['rehomingIntervalMax']
      );
    });

    it('verify unsuccessful failback attempt due to active call', async () => {
      /* These 2 calls to handleErrorSpy are for primary after which it fails over to backup */
      expect(handleErrorSpy).toBeCalledTimes(2);
      /* Active Url must match with the backup url as per the test */
      expect(callingClient.getMobiusUrl()).toStrictEqual(backupUrl);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);

      callingClient.makeCall({address: '*25', type: CallType.URI});
      expect(Object.keys(callingClient['callManager']['getActiveCalls']()).length).toBe(1);

      createDeviceSpy.mockRejectedValueOnce(failurePayload).mockResolvedValue(successPayload);

      /* Wait for failback to be triggered. */
      jest.advanceTimersByTime(
        callingClient['rehomingIntervalMax'] * MINUTES_TO_SEC_MFACTOR * SEC_TO_MSEC_MFACTOR
      );
      await flushPromises();

      expect(failbackSpy).toBeCalledOnceWith();
      /* Active Url should still match backup url */
      expect(callingClient.getMobiusUrl()).toStrictEqual(backupUrl);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      expect(restoreSpy).not.toBeCalled();
      expect(restartSpy).not.toBeCalled();
      expect(deRegSpy).not.toBeCalled();
      expect(logSpy).toHaveBeenCalledWith(
        'Active calls present, deferring failback to next cycle.',
        {file: 'CallingClient', method: FAILBACK_UTIL}
      );
      expect(callingClient['rehomingIntervalMin']).toBe(DEFAULT_REHOMING_INTERVAL_MIN);
      expect(callingClient['rehomingIntervalMax']).toBe(DEFAULT_REHOMING_INTERVAL_MAX);
    });
  });

  // Keep-alive related test cases
  describe('Keep-alive Tests', () => {
    let callingClient: ICallingClient;

    beforeAll(() => {
      callingClient = new CallingClient(webex, {logger: {level: LOGGER.INFO}});
    });

    afterAll(() => {
      callManager.removeAllListeners();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.clearAllMocks();
      callingClient.removeAllListeners(EVENT_KEYS.ERROR);
      callingClient.removeAllListeners(EVENT_KEYS.REGISTERED);
      if (callingClient['keepaliveTimer']) {
        clearInterval(callingClient['keepaliveTimer']);
        callingClient['keepaliveTimer'] = undefined;
      }
      callingClient['reconnectPending'] = false;
      const calls = Object.values(callingClient['callManager']['getActiveCalls']()) as ICall[];

      calls.forEach((call) => {
        call.end();
      });
    });

    const logSpy = jest.spyOn(log, 'log');
    const logObj = {
      file: 'CallingClient',
      method: 'sendKeepAlive',
    };
    const mockKeepAliveBody = {
      device: {
        deviceId: 'beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
        uri: 'https://mobius.aintgen-a-1.int.infra.webex.com/api/v1/calling/web/devices/beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
        status: 'active',
        lastSeen: '2022-04-05T05:08:46Z',
        addresses: ['sip:pbs9p4cbr9_G6JJNI5DD5NP@64941297.int10.bcld.webex.com'],
        clientDeviceUri: 'https://clientDeviceUrl',
      },
    };

    it('verify successful keep-alive cases', async () => {
      expect.assertions(3);
      jest.clearAllTimers();
      const keepAlivePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockKeepAliveBody,
      });

      webex.request.mockReturnValue(keepAlivePayload);
      jest.spyOn(global, 'setInterval');
      const funcSpy = jest.spyOn(callingClient['registration'], 'postKeepAlive');

      registration.postKeepAlive.mockResolvedValue(keepAlivePayload);
      // We can access private property during runtime.
      callingClient['isRegistered'] = MobiusStatus.ACTIVE;
      callingClient['sendKeepAlive']({
        device: {
          deviceId: 'beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
          uri: 'https://mobius.aintgen-a-1.int.infra.webex.com/api/v1/calling/web/devices/beb3c025-8c6a-3c44-8f3d-9b7d65363ac1',
          status: 'active',
          lastSeen: '2022-04-05T05:08:46Z',
          addresses: ['sip:pbs9p4cbr9_G6JJNI5DD5NP@64941297.int10.bcld.webex.com'],
          clientDeviceUri: 'https://clientDeviceUrl',
        },
        keepaliveInterval: 0.5,
      });
      expect(setInterval).toHaveBeenCalledTimes(1);
      // simulate keep-alive interval of 500 msecs for simplicity.
      await utils.waitForMsecs(500);
      await utils.waitForMsecs(500);
      expect(funcSpy).toBeCalledTimes(2); // should be called 2 times: first try and after the interval.
      expect(logSpy).toHaveBeenLastCalledWith('Sent Keepalive, status: 200', logObj);
    });

    it('verify failure keep-alive for unregistered device', () => {
      const warnSpy = jest.spyOn(log, 'warn');

      callingClient['isRegistered'] = MobiusStatus.DEFAULT;
      callingClient.sendKeepAlive(mockKeepAliveBody);

      expect(callingClient.getRegistrationStatus()).toBe(MobiusStatus.DEFAULT);
      expect(warnSpy).toHaveBeenCalledWith('Device is not active, exiting.', {
        file: 'CallingClient',
        method: callingClient.sendKeepAlive.name,
      });
      // for coverage
      callingClient.getLoggingLevel();
    });

    it('verify failure keep-alive cases: Retry Success', async () => {
      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
        body: mockKeepAliveBody,
      });
      const successPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockKeepAliveBody,
      });

      const emitSpy = jest.spyOn(callingClient, 'emit');

      jest
        .spyOn(callingClient['registration'], 'postKeepAlive')
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValue(successPayload);

      callingClient['isRegistered'] = MobiusStatus.ACTIVE;

      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      await callingClient.sendKeepAlive(mockKeepAliveBody);
      const timer = callingClient['keepaliveTimer'];

      await utils.waitForMsecs(50);

      expect(handleErrorSpy).toBeCalledOnceWith(
        callingClient,
        failurePayload,
        KEEPALIVE_UTIL,
        CALLING_CLIENT_FILE
      );
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      expect(callingClient['keepaliveTimer']).toBe(timer);
      expect(emitSpy).toHaveBeenNthCalledWith(1, EVENT_KEYS.RECONNECTING);
      expect(emitSpy).toHaveBeenNthCalledWith(2, EVENT_KEYS.RECONNECTED);
      expect(emitSpy).toBeCalledTimes(2);
    });

    it('verify failure keep-alive cases: Restore failure', async () => {
      const restoreSpy = jest.spyOn(callingClient as any, 'restorePreviousRegistration');
      const restartRegSpy = jest.spyOn(callingClient as any, 'restartRegistration');
      const reconnectSpy = jest.spyOn(callingClient as any, 'reconnectOnFailure');
      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
        body: mockKeepAliveBody,
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const emitSpy = jest.spyOn(callingClient, 'emit');

      const funcSpy = jest
        .spyOn(callingClient['registration'], 'postKeepAlive')
        .mockRejectedValue(failurePayload);

      jest.spyOn(callingClient['registration'], 'createDevice').mockRejectedValue(failurePayload);

      callingClient['isRegistered'] = MobiusStatus.ACTIVE;

      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      callingClient.sendKeepAlive(mockKeepAliveBody);
      const timer = callingClient['keepaliveTimer'];

      await utils.waitForMsecs(50);

      // sendKeepAlive tries to retry 5 times before accepting failure
      expect(clearIntervalSpy).toBeCalledOnceWith(timer);
      expect(handleErrorSpy).toBeCalledTimes(5);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      expect(callingClient['reconnectPending']).toStrictEqual(false);
      expect(reconnectSpy).toBeCalledOnceWith(KEEPALIVE_UTIL);
      expect(restoreSpy).toBeCalledOnceWith(KEEPALIVE_UTIL);
      expect(restartRegSpy).toBeCalledOnceWith(KEEPALIVE_UTIL);
      expect(funcSpy).toBeCalledTimes(5);
      expect(callingClient['keepaliveTimer']).toBe(undefined);
      expect(emitSpy).toHaveBeenNthCalledWith(1, EVENT_KEYS.RECONNECTING);
      expect(emitSpy).toHaveBeenNthCalledWith(4, EVENT_KEYS.RECONNECTING);
      expect(emitSpy).toHaveBeenNthCalledWith(5, EVENT_KEYS.UNREGISTERED);
      expect(emitSpy).toBeCalledTimes(5);
    });

    it('verify failure keep-alive cases: Restore Success', async () => {
      const restoreSpy = jest.spyOn(callingClient as any, 'restorePreviousRegistration');
      const restartRegSpy = jest.spyOn(callingClient as any, 'restartRegistration');
      const reconnectSpy = jest.spyOn(callingClient as any, 'reconnectOnFailure');
      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
        body: mockKeepAliveBody,
      });

      const successPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockKeepAliveBody,
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      jest
        .spyOn(callingClient['registration'], 'postKeepAlive')
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValue(successPayload);

      jest.spyOn(callingClient['registration'], 'createDevice').mockResolvedValue(successPayload);

      callingClient['isRegistered'] = MobiusStatus.ACTIVE;
      const url = 'https://mobius.asydm-m-1.prod.infra.webex.com/api/v1';

      callingClient.setMobiusUrl(url);

      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      callingClient.sendKeepAlive(mockKeepAliveBody);
      const timer = callingClient['keepaliveTimer'];

      await utils.waitForMsecs(50);

      expect(clearIntervalSpy).toBeCalledOnceWith(timer);
      expect(handleErrorSpy).toBeCalledTimes(5);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      expect(reconnectSpy).toBeCalledOnceWith(KEEPALIVE_UTIL);
      expect(restoreSpy).toBeCalledOnceWith(KEEPALIVE_UTIL);
      expect(restartRegSpy).not.toBeCalled();
      expect(callingClient.getMobiusUrl()).toStrictEqual(url);
      expect(callingClient['reconnectPending']).toStrictEqual(false);
      expect(callingClient['keepaliveTimer']).toBeTruthy();
      expect(callingClient['keepaliveTimer']).not.toBe(timer);
    });

    it('verify failure followed by recovery of keepalive', async () => {
      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
        body: mockKeepAliveBody,
      });
      const successPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockKeepAliveBody,
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const funcSpy = jest
        .spyOn(callingClient['registration'], 'postKeepAlive')
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValue(successPayload);

      callingClient['isRegistered'] = MobiusStatus.ACTIVE;

      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      callingClient.sendKeepAlive(mockKeepAliveBody);
      const timer = callingClient['keepaliveTimer'];

      await utils.waitForMsecs(50);

      // sendKeepAlive tries to retry 3 times before receiving success
      const callCondition = funcSpy.mock.calls.length > 5;

      expect(callCondition).toEqual(true);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      expect(handleErrorSpy).toBeCalledTimes(2);
      expect(clearIntervalSpy).not.toHaveBeenCalled();
      expect(callingClient['keepaliveTimer']).toBe(timer);
    });

    it('verify final error for keep-alive', async () => {
      const restoreSpy = jest.spyOn(callingClient as any, 'restorePreviousRegistration');
      const restartRegSpy = jest.spyOn(callingClient as any, 'restartRegistration');
      const reconnectSpy = jest.spyOn(callingClient as any, 'reconnectOnFailure');
      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 404,
        body: mockKeepAliveBody,
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      const funcSpy = jest
        .spyOn(callingClient['registration'], 'postKeepAlive')
        .mockRejectedValue(failurePayload);

      jest.spyOn(callingClient['registration'], 'createDevice').mockRejectedValue(failurePayload);

      callingClient['isRegistered'] = MobiusStatus.ACTIVE;

      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      callingClient.sendKeepAlive(mockKeepAliveBody);
      await utils.waitForMsecs(50);

      expect(clearIntervalSpy).toBeCalledTimes(1);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      expect(reconnectSpy).not.toBeCalled();
      expect(restoreSpy).not.toBeCalled();
      expect(restartRegSpy).not.toBeCalled();
      expect(callingClient['reconnectPending']).toStrictEqual(false);
      expect(funcSpy).toBeCalledOnceWith(mockKeepAliveBody.device.uri);
      expect(handleErrorSpy).toBeCalledOnceWith(
        callingClient,
        failurePayload,
        KEEPALIVE_UTIL,
        CALLING_CLIENT_FILE
      );
      expect(callingClient['keepaliveTimer']).toBe(undefined);
    });

    it('verify failure keep-alive case with active call present: Restore Success after call ends', async () => {
      const restoreSpy = jest.spyOn(callingClient as any, 'restorePreviousRegistration');
      const restartRegSpy = jest.spyOn(callingClient as any, 'restartRegistration');
      const reconnectSpy = jest.spyOn(callingClient as any, 'reconnectOnFailure');
      const logSpy = jest.spyOn(log, 'log');
      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
        body: mockKeepAliveBody,
      });

      const successPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockKeepAliveBody,
      });

      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      const emitSpy = jest.spyOn(callingClient, 'emit');

      jest
        .spyOn(callingClient['registration'], 'postKeepAlive')
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValue(successPayload);

      jest.spyOn(callingClient['registration'], 'createDevice').mockResolvedValue(successPayload);

      callingClient['isRegistered'] = MobiusStatus.ACTIVE;
      const url = 'https://mobius.asydm-m-1.prod.infra.webex.com/api/v1';

      callingClient.setMobiusUrl(url);

      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      expect(callingClient['reconnectPending']).toStrictEqual(false);
      callingClient.sendKeepAlive(mockKeepAliveBody);
      const timer = callingClient['keepaliveTimer'];

      const call = callingClient.makeCall({address: '*25', type: CallType.URI});

      expect(call).toBeTruthy();
      expect(call ? call['direction'] : undefined).toStrictEqual(CallDirection.OUTBOUND);

      await utils.waitForMsecs(50);

      expect(clearIntervalSpy).toBeCalledOnceWith(timer);
      expect(handleErrorSpy).toBeCalledTimes(5);
      expect(callingClient['keepaliveTimer']).toStrictEqual(undefined);
      expect(callingClient['failbackTimer']).toStrictEqual(undefined);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);
      expect(emitSpy).toHaveBeenLastCalledWith(EVENT_KEYS.UNREGISTERED);
      expect(reconnectSpy).toBeCalledOnceWith(KEEPALIVE_UTIL);
      expect(restoreSpy).not.toBeCalled();
      expect(restartRegSpy).not.toBeCalled();
      expect(callingClient['reconnectPending']).toStrictEqual(true);
      expect(logSpy).toHaveBeenCalledWith(
        'Active call(s) present, deferred reconnect till call cleanup.',
        {file: CALLING_CLIENT_FILE, method: RECONNECT_UTIL}
      );

      reconnectSpy.mockClear();
      call?.end();
      await utils.waitForMsecs(50);
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      expect(reconnectSpy).toBeCalledOnceWith(CALLS_CLEARED_HANDLER_UTIL);
      expect(restoreSpy).toBeCalledOnceWith(CALLS_CLEARED_HANDLER_UTIL);
      expect(restartRegSpy).not.toBeCalled();
      expect(callingClient['reconnectPending']).toStrictEqual(false);
      expect(callingClient.getMobiusUrl()).toStrictEqual(url);
      expect(callingClient['keepaliveTimer']).toBeTruthy();
      expect(callingClient['keepaliveTimer']).not.toBe(timer);
      expect(logSpy).toHaveBeenCalledWith('All calls cleared, reconnecting', {
        file: CALLING_CLIENT_FILE,
        method: CALLS_CLEARED_HANDLER_UTIL,
      });
    });
  });

  // Calling related test cases
  describe('Calling tests', () => {
    let callingClient: ICallingClient;

    beforeAll(() => {
      callingClient = new CallingClient(webex, {logger: {level: LOGGER.INFO}});
    });

    afterAll(() => {
      callingClient.removeAllListeners();
      callManager.removeAllListeners();
    });

    it('verify calling client object', () => {
      expect(callingClient.getSDKConnector().getWebex().internal.device.userId).toBe(
        '8a67806f-fc4d-446b-a131-31e71ea5b0e9'
      );
    });

    it('Return a successful call object while making call', () => {
      const call = callingClient.makeCall({address: '5003', type: CallType.URI});

      expect(call).toBeTruthy();
      expect(callingClient.getCall(call ? call.getCorrelationId() : '')).toBe(call);
      expect(call ? call['direction'] : undefined).toStrictEqual(CallDirection.OUTBOUND);
      call?.end();
    });

    it('Return a successful call object while making call to FAC codes', () => {
      const call = callingClient.makeCall({address: '*25', type: CallType.URI});

      expect(call).toBeTruthy();
      expect(call ? call['direction'] : undefined).toStrictEqual(CallDirection.OUTBOUND);
      call?.end();
    });

    it('Remove spaces from dialled number while making call', () => {
      const call = callingClient.makeCall({address: '+91 123 456 7890', type: CallType.URI});

      expect(call).toBeTruthy();
      expect(call ? call['direction'] : undefined).toStrictEqual(CallDirection.OUTBOUND);
      expect(call ? call['destination']['address'] : undefined).toStrictEqual('tel:+911234567890');
      call?.end();
    });

    it('attempt to create call with incorrect number format 1', (done) => {
      // There may be other listeners , which may create race
      callingClient.removeAllListeners(EVENT_KEYS.ERROR);
      const createCallSpy = jest.spyOn(callManager, 'createCall');

      callingClient.on(EVENT_KEYS.ERROR, (error) => {
        expect(error.message).toBe(
          'An invalid phone number was detected. Check the number and try again.'
        );
        done();
      });
      try {
        const call = callingClient.makeCall({address: 'select#$@^^', type: CallType.URI});

        expect(call).toBeUndefined();
        expect(createCallSpy).toBeCalledTimes(0);
      } catch (error) {
        done(error);
      }
    });

    it('attempt to create call with incorrect number format 2', (done) => {
      expect.assertions(3);
      // There may be other listeners , which may create race
      callingClient.removeAllListeners(EVENT_KEYS.ERROR);
      const createCallSpy = jest.spyOn(callManager, 'createCall');

      callingClient.on(EVENT_KEYS.ERROR, (error) => {
        expect(error.message).toBe(
          'An invalid phone number was detected. Check the number and try again.'
        );
        done();
      });

      try {
        const call = callingClient.makeCall({address: '+1@8883332505', type: CallType.URI});

        expect(call).toBeUndefined();
        expect(createCallSpy).toBeCalledTimes(0);
      } catch (error) {
        done(error);
      }
    });
  });

  describe('Call Session Event test', () => {
    const mockOn = webex.internal.mercury.on;
    let callingClient: ICallingClient;

    beforeEach(() => {
      callingClient = new CallingClient(webex, {logger: {level: LOGGER.INFO}});
    });

    afterEach(() => {
      callingClient.removeAllListeners();
      callManager.removeAllListeners();
    });

    it('verify the recent user session event ', (done) => {
      expect.assertions(2);
      callingClient.on(EVENT_KEYS.USER_SESSION_INFO, (event: CallSessionEvent) => {
        expect(event.data).toEqual(MOCK_SESSION_EVENT.data);
        done();
      });

      expect(mockOn.mock.calls[0][0]).toEqual(MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_INCLUSIVE);
      const callSessionCallback = mockOn.mock.calls[0][1];

      callSessionCallback(MOCK_SESSION_EVENT);
    });

    it('drop the recent user session if there is no webex calling type', (done) => {
      expect.assertions(2);
      callingClient.on(EVENT_KEYS.USER_SESSION_INFO, (event: CallSessionEvent) => {
        expect(event.data.userSessions.userSessions.length).toEqual(1);
        done();
      });

      expect(mockOn.mock.calls[0][0]).toEqual(MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_INCLUSIVE);
      const callSessionCallback = mockOn.mock.calls[0][1];

      callSessionCallback(MOCK_MULTIPLE_SESSIONS_EVENT);
    });
  });

  describe('Network activity detection tests', () => {
    let callingClient: ICallingClient;

    const warnSpy = jest.spyOn(log, 'warn');
    const logSpy = jest.spyOn(log, 'log');

    beforeAll(() => {
      callingClient = new CallingClient(webex, {logger: {level: LOGGER.INFO}});

      const mockRegistrationBody = getMockDeviceInfo();
      const registrationPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockRegistrationBody,
      });

      callingClient['isRegistered'] = MobiusStatus.DEFAULT;
      callingClient['primaryMobiusUris'] = [mockRegistrationBody.device.uri];
      webex.request.mockReturnValue(registrationPayload);
      registration.createDevice.mockResolvedValue(registrationPayload);
      callingClient.register(true);
      jest.advanceTimersByTime(2000);
    });

    afterAll(() => {
      callingClient.removeAllListeners();
      callManager.removeAllListeners();
    });

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
    });

    it('Simulate a network flap with no active calls and re-verify registration: Restore Success', async () => {
      const restoreSpy = jest.spyOn(callingClient, 'restorePreviousRegistration');
      const deRegSpy = jest.spyOn(callingClient, 'deregister');
      const registerSpy = jest.spyOn(callingClient as any, REGISTER_UTIL);

      /* Mocking clearInterval because fakeTimers can't clear real timers */
      jest.spyOn(global, 'clearInterval').mockReturnValue();

      /* Should be registered with Mobius */
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);
      const url = callingClient.getMobiusUrl();

      callingClient[NETWORK_CHANGE_DETECTION_UTIL]();

      /* Set mercury connection to be down and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = false;
      jest.advanceTimersByTime(2500);

      /* We should be detecting the network flap */
      expect(warnSpy).toHaveBeenCalledWith(
        'Network has flapped, waiting for mercury connection to be up',
        {file: 'CallingClient', method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      /* Set mercury connection to be up and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = true;
      jest.advanceTimersByTime(2500);

      await flushPromises();

      /* We should be detecting the network recovery */
      expect(logSpy).toHaveBeenCalledWith(
        'Mercury connection is up again, Re-registering with Mobius',
        {file: 'CallingClient', method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      expect(deRegSpy).toBeCalledOnceWith();
      expect(restoreSpy).toBeCalledOnceWith(NETWORK_CHANGE_DETECTION_UTIL);
      expect(registerSpy).toBeCalledOnceWith(NETWORK_CHANGE_DETECTION_UTIL, [url]);
    });

    it('Simulate a network flap with no active calls and re-verify registration: Restore Failure', async () => {
      const restoreSpy = jest.spyOn(callingClient, 'restorePreviousRegistration');
      const deRegSpy = jest.spyOn(callingClient, 'deregister');
      const registerSpy = jest.spyOn(callingClient as any, REGISTER_UTIL);
      const restartRegisterSpy = jest.spyOn(callingClient as any, 'restartRegistration');

      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 500,
        body: '',
      });

      const mockRegistrationBody = getMockDeviceInfo();
      const successPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockRegistrationBody,
      });

      /* Mocking clearInterval because fakeTimers can't clear real timers */
      jest.spyOn(global, 'clearInterval').mockReturnValue();

      /* Should be registered with Mobius */
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);

      const url = callingClient.getMobiusUrl();

      webex.request.mockRejectedValueOnce(failurePayload).mockResolvedValueOnce(successPayload);
      callingClient[NETWORK_CHANGE_DETECTION_UTIL]();

      /* Set mercury connection to be down and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = false;
      jest.advanceTimersByTime(2500);

      /* We should be detecting the network flap */
      expect(warnSpy).toHaveBeenCalledWith(
        'Network has flapped, waiting for mercury connection to be up',
        {file: 'CallingClient', method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      /* Set mercury connection to be up and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = true;
      jest.advanceTimersByTime(2500);

      await flushPromises();
      /* We should be detecting the network recovery */
      expect(logSpy).toHaveBeenCalledWith(
        'Mercury connection is up again, Re-registering with Mobius',
        {file: 'CallingClient', method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      expect(deRegSpy).toBeCalledOnceWith();
      expect(restoreSpy).toBeCalledOnceWith(NETWORK_CHANGE_DETECTION_UTIL);
      expect(restartRegisterSpy).toBeCalledOnceWith(NETWORK_CHANGE_DETECTION_UTIL);
      expect(registerSpy).toHaveBeenCalledTimes(2);
      expect(registerSpy).toHaveBeenCalledWith(NETWORK_CHANGE_DETECTION_UTIL, [url]);
      expect(registerSpy).toHaveBeenLastCalledWith(NETWORK_CHANGE_DETECTION_UTIL);
    });

    it('Simulate a network flap before initial registration is done', async () => {
      const newCallingClient = new CallingClient(webex, {logger: {level: LOGGER.INFO}});
      const restoreSpy = jest.spyOn(newCallingClient, 'restorePreviousRegistration');
      const deRegSpy = jest.spyOn(newCallingClient, 'deregister');
      const registerSpy = jest.spyOn(newCallingClient as any, REGISTER_UTIL);

      /* Mocking clearInterval because fakeTimers can't clear real timers */
      jest.spyOn(global, 'clearInterval').mockReturnValue();

      /* Should not be registered with Mobius */
      expect(newCallingClient['isRegistered']).toBe(MobiusStatus.DEFAULT);

      // webex.request.mockRejectedValue(failurePayload);
      newCallingClient[NETWORK_CHANGE_DETECTION_UTIL]();

      /* Set mercury connection to be down and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = false;
      jest.advanceTimersByTime(2500);

      /* We should be detecting the network flap */
      expect(warnSpy).toHaveBeenCalledWith(
        'Network has flapped, waiting for mercury connection to be up',
        {file: 'CallingClient', method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      /* Set mercury connection to be up and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = true;
      jest.advanceTimersByTime(2500);

      await flushPromises();
      /* We should be detecting the network recovery */
      expect(logSpy).toHaveBeenCalledWith(
        'Mercury connection is up again, Re-registering with Mobius',
        {file: 'CallingClient', method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      /*
       * When initial registration is not done, network flap
       * will not trigger de-registration/registration
       */
      expect(deRegSpy).not.toBeCalled();
      expect(restoreSpy).not.toBeCalled();
      expect(registerSpy).not.toBeCalled();
    });

    it('Simulate a network flap with 1 active call', async () => {
      const registerSpy = jest.spyOn(callingClient, 'register');

      /* Should be registered with Mobius */
      expect(callingClient['isRegistered']).toBe(MobiusStatus.ACTIVE);

      callingClient.makeCall({address: '*25', type: CallType.URI});

      expect(Object.keys(callingClient['callManager']['getActiveCalls']()).length).toBe(1);

      callingClient[NETWORK_CHANGE_DETECTION_UTIL]();

      /* Set mercury connection to be down and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = false;
      jest.advanceTimersByTime(2500);

      /* We should be detecting the network flap */
      expect(warnSpy).not.toHaveBeenCalledWith(
        'Network has flapped, waiting for mercury connection to be up',
        {file: 'CallingClient', method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      /* Set mercury connection to be up and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = true;
      jest.advanceTimersByTime(2500);

      await Promise.resolve();
      await Promise.resolve();

      /* We should be detecting the network recovery */
      expect(logSpy).not.toHaveBeenCalledWith(
        'Mercury connection is up again, Re-registering with Mobius',
        {file: 'CallingClient', method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      expect(registerSpy).not.toHaveBeenCalledWith(true);
      expect(registerSpy).toHaveBeenCalledTimes(0);
    });
  });
});
