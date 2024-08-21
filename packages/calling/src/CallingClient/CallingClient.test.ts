import {Mutex} from 'async-mutex';
import {LOGGER} from '../Logger/types';
import {
  getTestUtilsWebex,
  getMockRequestTemplate,
  getMockDeviceInfo,
  getMobiusDiscoveryResponse,
} from '../common/testUtil';
import {CallType, RegistrationStatus, ServiceIndicator, WebexRequestPayload} from '../common/types';
/* eslint-disable dot-notation */
import {CALLING_CLIENT_EVENT_KEYS, CallSessionEvent, MOBIUS_EVENT_KEYS} from '../Events/types';
import log from '../Logger';
import {createClient} from './CallingClient';
import {ICallingClient} from './types';
import * as utils from '../common/Utils';
import {getCallManager} from './calling/callManager';
import {
  CALLING_CLIENT_FILE,
  DISCOVERY_URL,
  IP_ENDPOINT,
  NETWORK_CHANGE_DETECTION_UTIL,
  NETWORK_FLAP_TIMEOUT,
  REGISTRATION_FILE,
  SPARK_USER_AGENT,
  URL_ENDPOINT,
} from './constants';
import {MOCK_MULTIPLE_SESSIONS_EVENT, MOCK_SESSION_EVENT} from './callRecordFixtures';
import {ILine} from './line/types';
import {
  ipPayload,
  regionBody,
  regionPayload,
  primaryUrl,
  discoveryPayload,
  registrationPayload,
  myIP,
  mockEUServiceHosts,
  mockIntServiceHosts,
  mockEUIntServiceHosts,
  mockCatalogEU,
  mockCatalogUSInt,
  mockCatalogUS,
  mockCatalogEUInt,
} from './callingClientFixtures';
import Line from './line';
import {filterMobiusUris} from '../common/Utils';
import {URL} from './registration/registerFixtures';
import {ICall} from './calling/types';
import {ServiceHost} from '../SDKConnector/types';

describe('CallingClient Tests', () => {
  // Common initializers

  const handleErrorSpy = jest.spyOn(utils, 'handleCallingClientErrors');
  const webex = getTestUtilsWebex();
  webex.internal.services['_hostCatalog'] = mockCatalogUS;
  const defaultServiceIndicator = ServiceIndicator.CALLING;
  const callManager = getCallManager(webex, defaultServiceIndicator);

  const logSpy = jest.spyOn(log, 'info');
  const warnSpy = jest.spyOn(log, 'warn');

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
        expect(callingClient).toBeTruthy();
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
        expect(callingClient).toBeTruthy();
      }).not.toThrow(Error);
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
        expect(e.message).toEqual(
          'Invalid service indicator, Allowed values are: calling, contactcenter and guestcalling'
        );
      }
      expect.assertions(1);
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
        expect(e.message).toEqual('Invalid service domain.');
      }
      expect.assertions(1);
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
        expect(callingClient).toBeTruthy();
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
        expect(e.message).toEqual('Invalid service domain.');
      }
      expect.assertions(1);
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
        expect(callingClient).toBeTruthy();
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
        uri: `${callingClient['mobiusHost']}${URL_ENDPOINT}${IP_ENDPOINT}`,
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
        uri: `${callingClient['mobiusHost']}${URL_ENDPOINT}?regionCode=${regionBody.clientRegion}&countryCode=${regionBody.countryCode}`,
      });
    });

    it('case when region discovery fails', async () => {
      const failurePayload = {
        statusCode: 500,
      };

      webex.request.mockRejectedValueOnce(failurePayload);

      callingClient = await createClient(webex, {logger: {level: LOGGER.INFO}});

      expect(webex.request).nthCalledWith(1, {
        ...getMockRequestTemplate(),
        uri: 'https://mobius-us-east-1.prod.infra.webex.com/api/v1/calling/web/myip',
        method: 'GET',
      });

      expect(webex.request).nthCalledWith(2, {
        ...getMockRequestTemplate(),
        uri: 'https://mobius-ca-central-1.prod.infra.webex.com/api/v1/calling/web/myip',
        method: 'GET',
      });

      expect(webex.request).nthCalledWith(3, {
        ...getMockRequestTemplate(),
        uri: 'https://mobius-eu-central-1.prod.infra.webex.com/api/v1/calling/web/myip',
        method: 'GET',
      });

      expect(webex.request).nthCalledWith(4, {
        ...getMockRequestTemplate(),
        uri: 'https://mobius-ap-southeast-2.prod.infra.webex.com/api/v1/calling/web/myip',
        method: 'GET',
      });

      expect(handleErrorSpy).toBeCalledWith(failurePayload, expect.anything(), {
        file: CALLING_CLIENT_FILE,
        method: 'getMobiusServers',
      });

      expect(callingClient.primaryMobiusUris).toEqual([
        `${callingClient['mobiusHost']}${URL_ENDPOINT}`,
      ]);

      expect(warnSpy).toBeCalledWith(
        `Couldn't resolve the region and country code. Defaulting to the catalog entries to discover mobius servers`,
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

      expect(callingClient.primaryMobiusUris).toEqual([
        `${callingClient['mobiusHost']}${URL_ENDPOINT}`,
      ]);

      expect(webex.request).nthCalledWith(1, {
        method: 'GET',
        ...getMockRequestTemplate(),
        uri: `${callingClient['mobiusHost']}${URL_ENDPOINT}${IP_ENDPOINT}`,
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
        `Couldn't resolve the region and country code. Defaulting to the catalog entries to discover mobius servers`,
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
      expect(webex.request).toBeCalledOnceWith({
        ...getMockRequestTemplate(),
        uri: `${callingClient['mobiusHost']}${URL_ENDPOINT}?regionCode=${regionBody.clientRegion}&countryCode=${regionBody.countryCode}`,
        method: 'GET',
      });
      expect(handleErrorSpy).not.toBeCalled();
    });
  });

  describe('Testing each cluster present withing host catalog', () => {
    const mobiusCluster = [
      'mobius-eu-central-1.prod.infra.webex.com',
      'mobius-us-east-1.int.infra.webex.com',
      'mobius-eu-central-1.int.infra.webex.com',
    ];

    const checkCluster = async (
      mockServiceHosts: ServiceHost[],
      mockCatalog: Record<string, ServiceHost[]>
    ) => {
      webex.internal.services._hostCatalog = mockCatalog;
      const callingClient = await createClient(webex, {logger: {level: LOGGER.INFO}});

      expect(callingClient['mobiusClusters']).toStrictEqual(mockServiceHosts);
    };

    it.each(mobiusCluster)('%s', async (clusterName) => {
      switch (clusterName) {
        case 'mobius-eu-central-1.prod.infra.webex.com':
          checkCluster(mockEUServiceHosts, mockCatalogEU);
          break;
        case 'mobius-us-east-1.int.infra.webex.com':
          checkCluster(mockIntServiceHosts, mockCatalogUSInt);
          break;
        case 'mobius-eu-central-1.int.infra.webex.com':
          checkCluster(mockEUIntServiceHosts, mockCatalogEUInt);
          break;
        default:
          break;
      }
    });
  });

  describe('Network activity detection tests', () => {
    let callingClient;
    let line;
    let reg;
    let restoreSpy;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let deRegSpy;
    let restartRegisterSpy;
    let registerSpy;

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
      await line.register();

      deRegSpy = jest.spyOn(line.registration, 'deregister');
      restoreSpy = jest.spyOn(reg, 'restorePreviousRegistration');
      restartRegisterSpy = jest.spyOn(reg, 'restartRegistration');
      registerSpy = jest.spyOn(reg, 'attemptRegistrationWithServers');
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
      expect(line.getStatus()).toEqual(RegistrationStatus.ACTIVE);

      /* Set mercury connection to be down and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = false;

      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);

      /* We should be detecting the network flap */
      expect(warnSpy).toBeCalledOnceWith(
        'Network has flapped, waiting for mercury connection to be up',
        {file: CALLING_CLIENT_FILE, method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      /* Set mercury connection to be up and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = true;

      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);

      await flushPromises();

      /* We should be detecting the network recovery */
      expect(logSpy).toBeCalledWith(
        'Mercury connection is up again, re-registering with Webex Calling if needed',
        {
          file: REGISTRATION_FILE,
          method: 'handleConnectionRestoration',
        }
      );

      expect(restoreSpy).toBeCalledWith('handleConnectionRestoration');
      expect(restartRegisterSpy).toBeCalledWith('handleConnectionRestoration');
      expect(webex.request).toBeCalledTimes(6);
      expect(registerSpy).toBeCalledWith('handleConnectionRestoration', [reg.getActiveMobiusUrl()]);
      expect(registerSpy).lastCalledWith('handleConnectionRestoration', [primaryUrl]);
    });

    it('Simulate a network flap with no active calls and re-verify registration: Restore Failure', async () => {
      expect(line.getStatus()).toEqual(RegistrationStatus.ACTIVE);

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
      expect(logSpy).toBeCalledWith(
        'Mercury connection is up again, re-registering with Webex Calling if needed',
        {
          file: REGISTRATION_FILE,
          method: 'handleConnectionRestoration',
        }
      );

      expect(restoreSpy).toBeCalledOnceWith('handleConnectionRestoration');
      expect(restartRegisterSpy).toBeCalledOnceWith('handleConnectionRestoration');
      expect(webex.request).toBeCalledTimes(6);
      expect(registerSpy).toBeCalledWith('handleConnectionRestoration', [reg.getActiveMobiusUrl()]);
      expect(registerSpy).lastCalledWith('handleConnectionRestoration', [primaryUrl]);
    });

    it('Simulate a network flap before initial registration is done', async () => {
      const handleConnectionRestoreSpy = jest.spyOn(reg, 'handleConnectionRestoration');
      reg.setStatus(RegistrationStatus.IDLE);

      /* Set mercury connection to be down and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = false;
      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);

      /* We should be detecting the network flap */
      expect(warnSpy).toBeCalledOnceWith(
        'Network has flapped, waiting for mercury connection to be up',
        {file: CALLING_CLIENT_FILE, method: NETWORK_CHANGE_DETECTION_UTIL}
      );

      /* Set mercury connection to be up and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = true;
      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);

      await flushPromises();

      /* We should be detecting the network recovery */
      expect(logSpy).not.toBeCalledWith(
        'Mercury connection is up again, re-registering with Webex Calling if needed',
        {
          file: REGISTRATION_FILE,
          method: 'handleConnectionRestoration',
        }
      );

      /*
       * When initial registration is not done, network flap
       * will not trigger de-registration/registration
       */
      expect(handleConnectionRestoreSpy).not.toBeCalledOnceWith();
    });

    it('Simulate a network flap with 1 active call', async () => {
      expect(line.getStatus()).toEqual(RegistrationStatus.ACTIVE);

      /** create a new call */
      reg.callManager.createCall();
      expect(Object.keys(reg.callManager.getActiveCalls()).length).toBe(1);

      /* Set mercury connection to be down and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = false;
      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);
      await flushPromises();

      /* We should be detecting the network flap */
      expect(warnSpy).not.toBeCalledOnceWith(
        'Network has flapped, waiting for mercury connection to be up',
        {file: CALLING_CLIENT_FILE, method: 'handleConnectionRestoration'}
      );

      /* Set mercury connection to be up and execute a delay of 2.5 seconds */
      webex.internal.mercury.connected = true;
      jest.advanceTimersByTime(NETWORK_FLAP_TIMEOUT + 500);

      await flushPromises();

      /* We should be detecting the network recovery */
      expect(logSpy).not.toBeCalledOnceWith(
        'Mercury connection is up again, re-registering with Webex Calling if needed',
        {file: REGISTRATION_FILE, method: 'handleConnectionRestoration'}
      );

      expect(registerSpy).not.toBeCalledWith(true);
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
    const mutex = new Mutex();
    const userId = webex.internal.device.userId;
    const clientDeviceUri = webex.internal.device.url;
    const mobiusUris = filterMobiusUris(getMobiusDiscoveryResponse(), URL);
    const primaryMobiusUris = jest.fn(() => mobiusUris.primary);
    const backupMobiusUris = jest.fn(() => mobiusUris.backup);

    let callingClient;
    let line: Line;

    beforeAll(async () => {
      callingClient = await createClient(webex);
      line = new Line(
        userId,
        clientDeviceUri,
        mutex,
        primaryMobiusUris(),
        backupMobiusUris(),
        LOGGER.INFO
      );
      const calls = Object.values(callManager.getActiveCalls());
      calls.forEach((call) => {
        call.end();
      });
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

    it('returns undefined when there is no connected call', () => {
      line.register();
      line.makeCall({address: '123456', type: CallType.URI});
      expect(callingClient.getConnectedCall()).toEqual(undefined);
    });

    it('returns the connected call', () => {
      line.register();
      const mockCall = line.makeCall({address: '1234', type: CallType.URI});
      const mockCall2 = line.makeCall({address: '5678', type: CallType.URI});
      // Connected call
      mockCall['connected'] = true;
      mockCall['earlyMedia'] = false;
      mockCall['callStateMachine'].state.value = 'S_CALL_ESTABLISHED';

      // Held call
      mockCall2['connected'] = true;
      mockCall2['held'] = true;
      mockCall2['earlyMedia'] = false;
      mockCall2['callStateMachine'].state.value = 'S_CALL_HOLD';

      const mockActiveCalls: Record<string, ICall> = {
        mockCorrelationId: mockCall as ICall,
        mockCorrelationId2: mockCall2 as ICall,
      };

      jest.spyOn(callManager, 'getActiveCalls').mockReturnValue(mockActiveCalls);
      expect(callingClient.getConnectedCall()).toEqual(mockCall);
    });
    it('returns all active calls', () => {
      callingClient.lineDict = {
        mockDeviceId: {lineId: 'mockLineId'} as ILine,
        mockDeviceId2: {lineId: 'mockLineId2'} as ILine,
      };

      const mockCall = line.makeCall({address: '1234', type: CallType.URI});
      const mockCall2 = line.makeCall({address: '5678', type: CallType.URI});
      const mockCall3 = line.makeCall({address: '9101', type: CallType.URI});

      mockCall.lineId = 'mockLineId';
      mockCall2.lineId = 'mockLineId2';
      mockCall3.lineId = 'mockLineId2';

      const mockActiveCalls: Record<string, ICall> = {
        mockCorrelationId: mockCall as ICall,
        mockCorrelationId2: mockCall2 as ICall,
        mockCorrelationId3: mockCall3 as ICall,
      };

      jest.spyOn(callManager, 'getActiveCalls').mockReturnValue(mockActiveCalls);
      expect(callingClient.getActiveCalls()).toEqual({
        mockLineId: [mockCall],
        mockLineId2: [mockCall2, mockCall3],
      });
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
      callingClient.on(CALLING_CLIENT_EVENT_KEYS.USER_SESSION_INFO, (event: CallSessionEvent) => {
        expect(event.data).toEqual(MOCK_SESSION_EVENT.data);
        done();
      });

      expect(mockOn.mock.calls[0][0]).toEqual(MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_INCLUSIVE);
      const callSessionCallback = mockOn.mock.calls[0][1];

      callSessionCallback(MOCK_SESSION_EVENT);
    });

    it('drop the recent user session if there is no webex calling type', (done) => {
      expect.assertions(2);
      callingClient.on(CALLING_CLIENT_EVENT_KEYS.USER_SESSION_INFO, (event: CallSessionEvent) => {
        expect(event.data.userSessions.userSessions.length).toEqual(1);
        done();
      });

      expect(mockOn.mock.calls[0][0]).toEqual(MOBIUS_EVENT_KEYS.CALL_SESSION_EVENT_INCLUSIVE);
      const callSessionCallback = mockOn.mock.calls[0][1];

      callSessionCallback(MOCK_MULTIPLE_SESSIONS_EVENT);
    });
  });
});
