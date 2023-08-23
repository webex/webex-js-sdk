import {LOGGER} from '../Logger/types';
import {
  getTestUtilsWebex,
  getMobiusDiscoveryResponse,
  getMockRequestTemplate,
  getMockDeviceInfo,
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
import {createClient} from './CallingClient';
import {ICallingClient} from './types';
import * as utils from '../common/Utils';
import {getCallManager} from './calling/callManager';
import {
  CALLING_CLIENT_FILE,
  DISCOVERY_URL,
  NETWORK_CHANGE_DETECTION_UTIL,
  NETWORK_FLAP_TIMEOUT,
  REGISTRATION_FILE,
  SPARK_USER_AGENT,
  URL_ENDPOINT,
} from './constants';
import {MOCK_MULTIPLE_SESSIONS_EVENT, MOCK_SESSION_EVENT} from './callRecordFixtures';
import {ILine} from './line/types';
import {mockPostResponse} from './registration/registerFixtures';

describe('CallingClient Tests', () => {
  // Common initializers

  const handleErrorSpy = jest.spyOn(utils, 'handleCallingClientErrors');
  const webex = getTestUtilsWebex();
  const defaultServiceIndicator = ServiceIndicator.CALLING;
  const callManager = getCallManager(webex, defaultServiceIndicator);

  const logSpy = jest.spyOn(log, 'info');
  const warnSpy = jest.spyOn(log, 'warn');

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
    body: mockPostResponse,
  });

  const uri = `${webex.internal.services._serviceUrls.mobius}${URL_ENDPOINT}`;
  const myIP = mockIPReturnBody.ipv4;

  const originalProcessNextTick = process.nextTick;
  function flushPromises() {
    return new Promise((resolve) => {
      originalProcessNextTick(resolve);
    });
  }

  describe('ServiceData tests', () => {
    let callingClient: ICallingClient | undefined;

    afterEach(() => {
      callManager.removeAllListeners();
      callingClient = undefined;
    });

    /**
     * No input sdk config to callingClient, it should default to service type
     * calling and empty domain value.
     */
    it('Verify valid calling serviceData with no input sdk config', async () => {
      expect(async () => {
        callingClient = await createClient(webex);
      }).not.toThrow(Error);
    });

    /**
     * Input sdk config to callingClient but no serviceData in it, it should default to
     * service type calling and empty domain value.
     */
    it('Verify valid calling serviceData with no input sdk config', async () => {
      expect(async () => {
        callingClient = await createClient(webex, {logger: {level: LOGGER.INFO}});
      }).not.toThrow(Error);
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

      expect(async () => {
        callingClient = await createClient(webex, {serviceData: serviceDataObj});
      }).not.toThrow(Error);
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
      try {
        callingClient = await createClient(webex, {serviceData: serviceDataObj});
      } catch (e) {
        expect(e.message).toMatch(
          'Invalid service indicator, Allowed values are: calling,contactcenter'
        );
      }
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

      try {
        callingClient = await createClient(webex, {serviceData: serviceDataObj});
      } catch (e) {
        expect(e.message).toMatch(
          'Invalid service indicator, Allowed values are: calling,contactcenter'
        );
      }
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

      try {
        callingClient = await createClient(webex, {serviceData: serviceDataObj});
      } catch (e) {
        expect(e.message).toMatch('Invalid service domain.');
      }
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

      expect(async () => {
        callingClient = await createClient(webex, {serviceData: serviceDataObj});
      }).not.toThrow(Error);
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

      try {
        callingClient = await createClient(webex, {serviceData: serviceDataObj});
      } catch (e) {
        expect(e.message).toMatch('Invalid service domain.');
      }
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

      try {
        callingClient = await createClient(webex, {serviceData: serviceDataObj});
      } catch (e) {
        expect(e.message).toMatch('Invalid service domain.');
      }
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

      expect(async () => {
        callingClient = await createClient(webex, {serviceData: serviceDataObj});
      }).not.toThrow(Error);
    });

    it('Get current log level', async () => {
      callingClient = await createClient(webex, {logger: {level: LOGGER.INFO}});
      expect(callingClient).toBeTruthy();
      expect(callingClient.getLoggingLevel).toBeTruthy();
      expect(callingClient.getLoggingLevel()).toEqual(LOGGER.INFO);
    });
  });

  describe('Mobius Server discovery tests', () => {
    let callingClient;

    afterEach(() => {
      jest.clearAllTimers();
      jest.clearAllMocks();
      callingClient.removeAllListeners();
      callManager.removeAllListeners();
      callingClient = undefined;
      jest.useRealTimers();
    });

    it('verify successful mobius server url discovery', async () => {
      webex.request
        .mockResolvedValueOnce(ipPayload)
        .mockResolvedValueOnce(regionPayload)
        .mockResolvedValueOnce(discoveryPayload);

      callingClient = await createClient(webex, {logger: {level: LOGGER.INFO}});

      expect(webex.request).toBeCalledTimes(3);
      expect(callingClient.primaryMobiusUris).toEqual([primaryUrl]);
      expect(handleErrorSpy).not.toBeCalled();

      expect(webex.request).nthCalledWith(1, {
        method: 'GET',
        ...getMockRequestTemplate(),
        uri: `${uri}myip`,
      });

      expect(webex.request).nthCalledWith(2, {
        method: 'GET',
        uri: `${DISCOVERY_URL}/${myIP}`,
        addAuthHeader: false,
        headers: {
          [SPARK_USER_AGENT]: null,
        },
      });

      expect(webex.request).nthCalledWith(3, {
        method: 'GET',
        ...getMockRequestTemplate(),
        uri: `${uri}?regionCode=${regionBody.clientRegion}&countryCode=${regionBody.countryCode}`,
      });
    });

    it('case when region discovery fails', async () => {
      const failurePayload = {
        statusCode: 500,
      };

      webex.request.mockRejectedValueOnce(failurePayload);

      callingClient = await createClient(webex, {logger: {level: LOGGER.INFO}});

      expect(handleErrorSpy).toBeCalledOnceWith(failurePayload, expect.anything(), {
        file: CALLING_CLIENT_FILE,
        method: 'getMobiusServers',
      });

      expect(webex.request).toBeCalledTimes(1);

      expect(callingClient.primaryMobiusUris).toEqual([uri]);

      expect(webex.request).nthCalledWith(1, {
        method: 'GET',
        ...getMockRequestTemplate(),
        uri: `${uri}myip`,
      });

      expect(warnSpy).toBeCalledWith(
        'Error in finding Mobius Servers. Will use the default URL.',
        ''
      );
    });

    it('when region discovery succeeds but region based mobius url discovery fails', async () => {
      const failurePayload = {
        statusCode: 500,
      };

      webex.request
        .mockResolvedValueOnce(ipPayload)
        .mockResolvedValueOnce(regionPayload)
        .mockRejectedValueOnce(failurePayload);

      callingClient = await createClient(webex, {logger: {level: LOGGER.INFO}});

      expect(handleErrorSpy).toBeCalledWith(failurePayload, expect.anything(), {
        file: CALLING_CLIENT_FILE,
        method: 'getMobiusServers',
      });
      expect(webex.request).toBeCalledTimes(3);

      expect(callingClient.primaryMobiusUris).toEqual([uri]);

      expect(webex.request).nthCalledWith(1, {
        method: 'GET',
        ...getMockRequestTemplate(),
        uri: `${uri}myip`,
      });

      expect(webex.request).nthCalledWith(2, {
        method: 'GET',
        uri: `${DISCOVERY_URL}/${myIP}`,
        addAuthHeader: false,
        headers: {
          [SPARK_USER_AGENT]: null,
        },
      });

      expect(warnSpy).toBeCalledWith(
        'Error in finding Mobius Servers. Will use the default URL.',
        ''
      );
    });

    it('Verify successful mobius server url discovery after initializing callingClient through a config', async () => {
      const infoSpy = jest.spyOn(log, 'info');
      webex.request.mockResolvedValueOnce(discoveryPayload);

      callingClient = await createClient(webex, {
        discovery: {
          region: 'AP-SOUTHEAST',
          country: 'IN',
        },
        logger: {
          level: LOGGER.INFO,
        },
      });

      expect(callingClient.primaryMobiusUris).toEqual([primaryUrl]);

      expect(infoSpy).toBeCalledWith('Updating region and country from the SDK config', {
        file: 'CallingClient',
        method: 'getMobiusServers',
      });
      expect(webex.request).toBeCalledTimes(1);
      expect(handleErrorSpy).not.toBeCalled();
    });
  });

  describe('Network activity detection tests', () => {
    let callingClient;
    let line;
    let reg;

    beforeEach(async () => {
      jest.useFakeTimers();

      webex.request
        .mockResolvedValueOnce(ipPayload)
        .mockResolvedValueOnce(regionPayload)
        .mockResolvedValueOnce(discoveryPayload)
        .mockResolvedValueOnce(registrationPayload);

      callingClient = await createClient(webex, {logger: {level: LOGGER.INFO}});
      line = Object.values(callingClient.lineDict)[0] as ILine;
      reg = line.registration;

      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.DEFAULT);
      await line.register();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.clearAllMocks();
      callingClient.removeAllListeners();
      callManager.removeAllListeners();
      callingClient = undefined;
      jest.useRealTimers();
    });

    it('detect a network flap in mercury connection', async () => {
      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.ACTIVE);

      /* Set mercury connection to be down and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = false;

      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);

      /* We should be detecting the network flap */
      expect(warnSpy).toBeCalledWith(
        'Network has flapped, waiting for mercury connection to be up',
        {file: CALLING_CLIENT_FILE, method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      /* Set mercury connection to be up and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = true;

      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);

      await flushPromises();

      /* We should be detecting the network recovery */
      expect(logSpy).nthCalledWith(
        7,
        'Mercury connection is up again, Re-registering with Mobius',
        {file: REGISTRATION_FILE, method: 'handleConnectionRestoration'}
      );
    });

    it('Simulate a network flap with no active calls and re-verify registration: Restore Failure', async () => {
      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.ACTIVE);

      const restoreSpy = jest.spyOn(reg, 'restorePreviousRegistration');
      const deRegSpy = jest.spyOn(line.registration, 'deregister');
      const restartRegisterSpy = jest.spyOn(reg, 'restartRegistration');
      const registerSpy = jest.spyOn(reg, 'attemptRegistrationWithServers');

      const failurePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 500,
        body: '',
      });

      const mockRegistrationBody = getMockDeviceInfo();
      const successPayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockRegistrationBody,
      });

      webex.request.mockRejectedValueOnce(failurePayload).mockResolvedValueOnce(successPayload);

      /* Set mercury connection to be down and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = false;
      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);

      /* We should be detecting the network flap */
      expect(warnSpy).toBeCalledWith(
        'Network has flapped, waiting for mercury connection to be up',
        {file: CALLING_CLIENT_FILE, method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      /* Set mercury connection to be up and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = true;
      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);

      await flushPromises();
      /* We should be detecting the network recovery */
      expect(logSpy).toBeCalledWith('Mercury connection is up again, Re-registering with Mobius', {
        file: REGISTRATION_FILE,
        method: 'handleConnectionRestoration',
      });

      expect(deRegSpy).toBeCalledWith();
      expect(restoreSpy).toBeCalledWith('handleConnectionRestoration');
      expect(restartRegisterSpy).toBeCalledWith('handleConnectionRestoration');
      expect(webex.request).toBeCalledTimes(6);
      expect(registerSpy).toBeCalledWith('handleConnectionRestoration', [reg.getActiveMobiusUrl()]);
      expect(registerSpy).lastCalledWith('handleConnectionRestoration', [primaryUrl]);
    });

    it('Simulate a network flap before initial registration is done', async () => {
      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.ACTIVE);

      reg.deregister();
      reg.setActiveMobiusUrl(undefined);

      jest.clearAllMocks();
      const restoreSpy = jest.spyOn(reg, 'restorePreviousRegistration');
      const registerSpy = jest.spyOn(reg, 'attemptRegistrationWithServers');

      /* Set mercury connection to be down and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = false;
      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);

      /* We should be detecting the network flap */
      expect(warnSpy).toBeCalledWith(
        'Network has flapped, waiting for mercury connection to be up',
        {file: CALLING_CLIENT_FILE, method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      /* Set mercury connection to be up and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = true;
      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);

      await flushPromises();

      /* We should be detecting the network recovery */
      expect(logSpy).toBeCalledWith('Mercury connection is up again, Re-registering with Mobius', {
        file: REGISTRATION_FILE,
        method: 'handleConnectionRestoration',
      });

      /*
       * When initial registration is not done, network flap
       * will not trigger de-registration/registration
       */
      expect(webex.request).not.toBeCalled();
      expect(restoreSpy).not.toBeCalled();
      expect(registerSpy).not.toBeCalled();
    });

    it('Simulate a network flap with 1 active call', async () => {
      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.ACTIVE);

      const registerSpy = jest.spyOn(reg, 'attemptRegistrationWithServers');

      /** create a new call */
      reg.callManager.createCall();
      expect(Object.keys(reg.callManager.getActiveCalls()).length).toBe(1);

      /* Set mercury connection to be down and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = false;
      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);
      await flushPromises();

      /* We should be detecting the network flap */
      expect(warnSpy).not.toBeCalledWith(
        'Network has flapped, waiting for mercury connection to be up',
        {file: CALLING_CLIENT_FILE, method: 'handleConnectionRestoration'}
      );

      /* Set mercury connection to be up and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = true;
      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);

      await flushPromises();

      /* We should be detecting the network recovery */
      expect(logSpy).not.toBeCalledWith(
        'Mercury connection is up again, Re-registering with Mobius',
        {file: REGISTRATION_FILE, method: 'handleConnectionRestoration'}
      );

      expect(registerSpy).not.toBeCalledWith(true);
      expect(registerSpy).toBeCalledTimes(0);
    });
  });

  describe('Line creation tests', () => {
    let callingClient;
    let line;

    beforeEach(async () => {
      callingClient = await createClient(webex);
      line = Object.values(callingClient.lineDict)[0];
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.clearAllMocks();
      callingClient.removeAllListeners();
      callManager.removeAllListeners();
      callingClient = undefined;
      jest.useRealTimers();
    });

    it('verify line dict successfully created', () => {
      expect(callingClient.lineDict).toBeTruthy();
      expect(line).toBeTruthy();
      expect(Object.keys(callingClient.lineDict).length).toEqual(1);
    });

    it('verify getLines response', () => {
      expect(callingClient.getLines).toBeTruthy();
      expect(callingClient.getLines()).toEqual(callingClient.lineDict);
    });
  });

  // Calling related test cases
  describe('Calling tests', () => {
    let callingClient: ICallingClient;

    beforeAll(async () => {
      callingClient = await createClient(webex, {logger: {level: LOGGER.INFO}});
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

    beforeEach(async () => {
      callingClient = await createClient(webex, {logger: {level: LOGGER.INFO}});
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
