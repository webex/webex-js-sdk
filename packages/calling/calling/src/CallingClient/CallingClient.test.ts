import {Mutex} from 'async-mutex';
import {LOGGER} from '../Logger/types';
import {
  getMockDeviceInfo,
  getTestUtilsWebex,
  getMobiusDiscoveryResponse,
  getMockRequestTemplate,
} from '../common/testUtil';
import {
  CallDirection,
  CallType,
  MobiusServers,
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
import {CALLING_CLIENT_FILE, URL_ENDPOINT} from './constants';
import {MOCK_MULTIPLE_SESSIONS_EVENT, MOCK_SESSION_EVENT} from './callRecordFixtures';
import * as regUtils from './registration/register';

describe('CallingClient Tests', () => {
  // Common initializers

  const handleErrorSpy = jest.spyOn(utils, 'handleRegistrationErrors');
  const webex = getTestUtilsWebex();
  const defaultServiceIndicator = ServiceIndicator.CALLING;
  const callManager = getCallManager(webex, defaultServiceIndicator);

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
      expect(createRegistrationSpy).toBeCalledWith(
        webex,
        defaultServiceData,
        expect.any(Mutex),
        expect.anything(),
        expect.any(String)
      );
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
      expect(createRegistrationSpy).toBeCalledWith(
        webex,
        defaultServiceData,
        expect.any(Mutex),
        expect.anything(),
        expect.any(String)
      );
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
      expect(createRegistrationSpy).toBeCalledWith(
        webex,
        defaultServiceData,
        expect.any(Mutex),
        expect.anything(),
        expect.any(String)
      );
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
      expect(createRegistrationSpy).toBeCalledWith(
        webex,
        defaultServiceData,
        expect.any(Mutex),
        expect.anything(),
        expect.any(String)
      );
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
      expect(createRegistrationSpy).toBeCalledWith(
        webex,
        serviceDataObj,
        expect.any(Mutex),
        expect.anything(),
        expect.any(String)
      );
    });
  });

  describe('Registration tests', () => {
    let callingClient: ICallingClient;

    const warnSpy = jest.spyOn(log, 'warn');

    const mockRegistrationBody = getMockDeviceInfo();

    const mockIPReturnBody = {
      ipv4: '1.1.1.1',
      ipv6: '2.2.2.2',
    };

    const ipPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockIPReturnBody,
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

    const discoveryBody: MobiusServers = getMobiusDiscoveryResponse();
    const primaryUrl = `${discoveryBody.primary.uris[0]}/calling/web/`;
    const discoveryPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: discoveryBody,
    });

    const registrationPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockRegistrationBody,
    });

    const mockBody = {
      userId: webex.internal.device.userId,
      clientDeviceUri: webex.internal.device.url,
      serviceData: {
        domain: '',
        indicator: 'calling',
      },
    };

    beforeEach(() => {
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

    it('verify successful Registration cases and keepalive', async () => {
      webex.request
        .mockResolvedValueOnce(ipPayload)
        .mockResolvedValueOnce(regionPayload)
        .mockResolvedValueOnce(discoveryPayload)
        .mockReturnValue(registrationPayload);

      expect(callingClient.getRegistrationStatus()).toEqual(MobiusStatus.DEFAULT);
      await callingClient.register();

      expect(webex.request).toBeCalledTimes(4);
      expect(handleErrorSpy).not.toHaveBeenCalled();
      expect(callingClient.getRegistrationStatus()).toEqual(MobiusStatus.ACTIVE);
      expect(callingClient.getActiveMobiusUrl()).toEqual(primaryUrl);

      /** trigger sendKeepAlive and verify whether keepalive request is sent or not */

      jest.useFakeTimers();
      webex.request.mockClear();
      const body = getMockDeviceInfo();

      /* specify keepalive interval as 30 seconds and advance timers by 30 */
      callingClient.sendKeepAlive({...body, keepaliveInterval: 30});

      jest.advanceTimersByTime(30 * 1000);
      await Promise.resolve();

      expect(webex.request).toBeCalledOnceWith({
        ...getMockRequestTemplate(),
        uri: `${body.device.uri}/status`,
        method: 'POST',
      });
    });

    it('verify successful Registration cases when region discovery fails', async () => {
      const failurePayload = {
        statusCode: 500,
      };

      webex.request
        .mockRejectedValueOnce(failurePayload)
        .mockResolvedValueOnce(registrationPayload);

      expect(callingClient.getRegistrationStatus()).toBe(MobiusStatus.DEFAULT);
      await callingClient.register();

      expect(handleErrorSpy).toBeCalledOnceWith(failurePayload, expect.anything(), {
        file: CALLING_CLIENT_FILE,
        method: 'getMobiusServers',
      });

      expect(callingClient.getRegistrationStatus()).toEqual(MobiusStatus.ACTIVE);

      const uri = `${webex.internal.services._serviceUrls.mobius}${URL_ENDPOINT}`;

      expect(callingClient.getActiveMobiusUrl()).toBe(uri);
      expect(webex.request).toBeCalledTimes(2);

      expect(webex.request).toHaveBeenNthCalledWith(1, {
        method: 'GET',
        ...getMockRequestTemplate(),
        uri: `${uri}myip`,
      });
      expect(webex.request).toHaveBeenNthCalledWith(2, {
        method: 'POST',
        ...getMockRequestTemplate(),
        uri: `${uri}device`,
        body: mockBody,
      });

      expect(warnSpy).toBeCalledWith(
        'Error in finding Mobius Servers. Will use the default URL.',
        ''
      );
    });

    it('verify failure Registration cases all requests fail ', async () => {
      webex.request.mockImplementation(() => {
        throw new Error();
      });

      expect(callingClient.getRegistrationStatus()).toBe(MobiusStatus.DEFAULT);
      callingClient.register();
      await utils.waitForMsecs(20);
      expect(callingClient.getRegistrationStatus()).toBe(MobiusStatus.DEFAULT);
      expect(handleErrorSpy).toHaveBeenCalled();
      expect(warnSpy).toBeCalledWith(
        'Error in finding Mobius Servers. Will use the default URL.',
        ''
      );
    });

    it('verify successful Registration cases when region discovery succeeds but region based Mobius Url fails', async () => {
      webex.request
        .mockResolvedValueOnce(ipPayload)
        .mockResolvedValueOnce(regionPayload)
        .mockRejectedValueOnce({statusCode: 404})
        .mockResolvedValue(registrationPayload);

      expect(callingClient.getRegistrationStatus()).toBe(MobiusStatus.DEFAULT);
      await callingClient.register();
      await utils.waitForMsecs(50);

      expect(handleErrorSpy).toHaveBeenCalled();
      expect(callingClient.getRegistrationStatus()).toBe(MobiusStatus.ACTIVE);

      const uri = `${webex.internal.services._serviceUrls.mobius}${URL_ENDPOINT}`;
      expect(callingClient.getActiveMobiusUrl()).toEqual(uri);
      expect(warnSpy).toBeCalledWith(
        'Error in finding Mobius Servers. Will use the default URL.',
        ''
      );
    });

    it('verify failure Registration cases', async () => {
      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 401,
        body: mockRegistrationBody,
      });

      expect(callingClient.getRegistrationStatus()).toBe(MobiusStatus.DEFAULT);

      webex.request
        .mockResolvedValueOnce(ipPayload)
        .mockResolvedValueOnce(regionPayload)
        .mockResolvedValueOnce(discoveryPayload)
        .mockRejectedValue(failurePayload);

      await callingClient.register();
      await utils.waitForMsecs(100);
      expect(callingClient.getRegistrationStatus()).toBe(MobiusStatus.DEFAULT);
      expect(handleErrorSpy).toHaveBeenCalled();
    });

    it('Verify successful registration after initializing callingClient through a config', async () => {
      const infoSpy = jest.spyOn(log, 'info');
      webex.request.mockResolvedValueOnce(discoveryPayload).mockReturnValue(registrationPayload);

      callingClient = new CallingClient(webex, {
        discovery: {
          region: 'AP-SOUTHEAST',
          country: 'IN',
        },
        logger: {
          level: LOGGER.INFO,
        },
      });

      expect(callingClient.getRegistrationStatus()).toBe(MobiusStatus.DEFAULT);
      await callingClient.register();
      expect(callingClient.getRegistrationStatus()).toBe(MobiusStatus.ACTIVE);

      expect(callingClient.getActiveMobiusUrl()).toBe(primaryUrl);
      expect(infoSpy).toHaveBeenCalledWith('Updating region and country from the SDK config', {
        file: 'CallingClient',
        method: 'getMobiusServers',
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
});
