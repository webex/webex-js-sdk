import {Mutex} from 'async-mutex';
import {
  getMobiusDiscoveryResponse,
  getMockDeviceInfo,
  getMockRequestTemplate,
  getTestUtilsWebex,
} from '../../common/testUtil';
import {URL} from '../registration/registerFixtures';
import {filterMobiusUris} from '../../common';
import {
  CallDirection,
  CallType,
  MobiusServers,
  RegistrationStatus,
  ServiceIndicator,
  WebexRequestPayload,
} from '../../common/types';
import {LINE_EVENTS} from './types';
import Line from '.';
import * as utils from '../../common/Utils';
import SDKConnector from '../../SDKConnector';
import {REGISTRATION_FILE} from '../constants';
import {LOGGER} from '../../Logger/types';
import * as regUtils from '../registration/register';

describe('Line Tests', () => {
  const mutex = new Mutex();
  const webex = getTestUtilsWebex();
  SDKConnector.setWebex(webex);

  const defaultServiceData = {indicator: ServiceIndicator.CALLING, domain: ''};
  const createRegistrationSpy = jest.spyOn(regUtils, 'createRegistration');

  const mobiusUris = filterMobiusUris(getMobiusDiscoveryResponse(), URL);
  const primaryMobiusUris = jest.fn(() => mobiusUris.primary);
  const backupMobiusUris = jest.fn(() => mobiusUris.backup);
  const userId = webex.internal.device.userId;
  const clientDeviceUri = webex.internal.device.url;
  const mockJwe = 'mockJwe';
  const guestServiceData = {
    indicator: ServiceIndicator.GUEST_CALLING,
    domain: '',
    guestName: 'testUser',
  };

  const handleErrorSpy = jest.spyOn(utils, 'handleRegistrationErrors');

  jest.clearAllMocks();

  describe('Line Registration tests', () => {
    let line;
    const mockRegistrationBody = getMockDeviceInfo();

    // TEMPORARILY COMMENTED OUT SO WE CAN TEST IT ON MOBIUS SERVERS
    const discoveryBody: MobiusServers = getMobiusDiscoveryResponse();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const primaryUrl = `${discoveryBody.primary.uris[0]}/calling/web/`;

    const registrationPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockRegistrationBody,
    });

    beforeEach(() => {
      line = new Line(
        userId,
        clientDeviceUri,
        mutex,
        primaryMobiusUris(),
        backupMobiusUris(),
        LOGGER.INFO
      );
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.clearAllMocks();
      jest.useRealTimers();
      line.removeAllListeners();
    });

    it('verify successful Registration cases and keepalive', async () => {
      jest.useFakeTimers();
      webex.request.mockReturnValue(registrationPayload);

      expect(createRegistrationSpy).toBeCalledOnceWith(
        webex,
        defaultServiceData,
        expect.any(Mutex),
        expect.anything(),
        LOGGER.INFO,
        undefined
      );
      expect(line.getStatus()).toEqual(RegistrationStatus.IDLE);
      await line.register();

      // expect(webex.request).toBeCalledOnceWith({
      //   ...getMockRequestTemplate(),
      //   body: {
      //     userId,
      //     clientDeviceUri,
      //     serviceData: defaultServiceData,
      //   },
      //   uri: `${primaryUrl}device`,
      //   method: 'POST',
      // });
      expect(handleErrorSpy).not.toBeCalled();

      expect(line.getStatus()).toEqual(RegistrationStatus.ACTIVE);
      // expect(line.getActiveMobiusUrl()).toEqual(primaryUrl);
      expect(line.getLoggingLevel()).toEqual(LOGGER.INFO);
      expect(line.getDeviceId()).toEqual(mockRegistrationBody.device.deviceId);

      webex.request.mockClear();

      jest.advanceTimersByTime(30 * 1000);
      await Promise.resolve();

      expect(webex.request).toBeCalledOnceWith({
        ...getMockRequestTemplate(),
        uri: `${mockRegistrationBody.device.uri}/status`,
        method: 'POST',
      });
      jest.useRealTimers();
    });

    it('verify successful Registration cases and keepalive for a guest user', async () => {
      createRegistrationSpy.mockClear();
      const guestLine = new Line(
        userId,
        clientDeviceUri,
        mutex,
        primaryMobiusUris(),
        backupMobiusUris(),
        LOGGER.INFO,
        guestServiceData,
        mockJwe
      );
      jest.useFakeTimers();
      webex.request.mockReturnValue(registrationPayload);

      expect(createRegistrationSpy).toBeCalledOnceWith(
        webex,
        guestServiceData,
        expect.any(Mutex),
        expect.anything(),
        LOGGER.INFO,
        mockJwe
      );
      expect(guestLine.getStatus()).toEqual(RegistrationStatus.IDLE);
      await guestLine.register();

      // expect(webex.request).toBeCalledOnceWith({
      //   ...getMockRequestTemplate(),
      //   body: {
      //     userId,
      //     clientDeviceUri,
      //     serviceData: {...guestServiceData, jwe: mockJwe},
      //   },
      //   uri: `${primaryUrl}device`,
      //   method: 'POST',
      // });
      expect(handleErrorSpy).not.toBeCalled();

      expect(guestLine.getStatus()).toEqual(RegistrationStatus.ACTIVE);
      // expect(guestLine.getActiveMobiusUrl()).toEqual(primaryUrl);
      expect(guestLine.getLoggingLevel()).toEqual(LOGGER.INFO);
      expect(guestLine.getDeviceId()).toEqual(mockRegistrationBody.device.deviceId);

      webex.request.mockClear();

      jest.advanceTimersByTime(30 * 1000);
      await Promise.resolve();

      expect(webex.request).toBeCalledOnceWith({
        ...getMockRequestTemplate(),
        uri: `${mockRegistrationBody.device.uri}/status`,
        method: 'POST',
      });
      jest.useRealTimers();
    });

    it('verify failure Registration cases all requests fail ', async () => {
      line.removeAllListeners(LINE_EVENTS.ERROR);

      webex.request.mockRejectedValue({
        statusCode: 401,
      });

      line.on(LINE_EVENTS.ERROR, (error) => {
        expect(error.message).toBe(
          'User is unauthorized due to an expired token. Sign out, then sign back in.'
        );
      });

      expect(line.getStatus()).toBe(RegistrationStatus.IDLE);
      line.register();
      await utils.waitForMsecs(20);

      expect(line.getStatus()).toBe(RegistrationStatus.INACTIVE);
      expect(handleErrorSpy).toBeCalledOnceWith(
        expect.anything(),
        expect.anything(),
        {
          file: REGISTRATION_FILE,
          method: 'attemptRegistrationWithServers',
        },
        expect.anything()
      );
    });

    it('verify successful de-registration cases', async () => {
      webex.request.mockReturnValueOnce(registrationPayload);

      expect(line.getStatus()).toEqual(RegistrationStatus.IDLE);
      await line.register();
      expect(line.getStatus()).toEqual(RegistrationStatus.ACTIVE);

      await line.deregister();
      expect(line.getStatus()).toEqual(RegistrationStatus.IDLE);
    });
  });

  describe('Line calling tests', () => {
    let line;

    beforeEach(() => {
      line = new Line(
        userId,
        clientDeviceUri,
        mutex,
        primaryMobiusUris(),
        backupMobiusUris(),
        LOGGER.INFO
      );
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.clearAllMocks();
      jest.useRealTimers();
      line.removeAllListeners();
    });
    it('Return a successful call object while making call', () => {
      const createCallSpy = jest.spyOn(line.callManager, 'createCall');
      const call = line.makeCall({address: '5003', type: CallType.URI});

      expect(createCallSpy).toBeCalledOnceWith(CallDirection.OUTBOUND, undefined, line.lineId, {
        address: 'tel:5003',
        type: 'uri',
      });
      expect(call).toBeTruthy();
      expect(line.getCall(call ? call.getCorrelationId() : '')).toBe(call);
      expect(call ? call.direction : undefined).toStrictEqual(CallDirection.OUTBOUND);
      call?.end();
    });

    it('Return a successful call object while making call to FAC codes', () => {
      const createCallSpy = jest.spyOn(line.callManager, 'createCall');
      const call = line.makeCall({address: '*25', type: CallType.URI});

      expect(createCallSpy).toBeCalledOnceWith(CallDirection.OUTBOUND, undefined, line.lineId, {
        address: 'tel:*25',
        type: 'uri',
      });
      expect(call).toBeTruthy();
      expect(call ? call.direction : undefined).toStrictEqual(CallDirection.OUTBOUND);
      call?.end();
    });

    it('Remove spaces from dialled number while making call', () => {
      const createCallSpy = jest.spyOn(line.callManager, 'createCall');
      const call = line.makeCall({address: '+91 123 456 7890', type: CallType.URI});

      expect(createCallSpy).toBeCalledOnceWith(CallDirection.OUTBOUND, undefined, line.lineId, {
        address: 'tel:+911234567890',
        type: 'uri',
      });
      expect(call).toBeTruthy();
      expect(call ? call.direction : undefined).toStrictEqual(CallDirection.OUTBOUND);
      expect(call ? call.destination.address : undefined).toStrictEqual('tel:+911234567890');
      call?.end();
    });

    it('Remove hyphen from dialled number while making call', () => {
      const createCallSpy = jest.spyOn(line.callManager, 'createCall');
      const call = line.makeCall({address: '123-456-7890', type: CallType.URI});

      expect(createCallSpy).toBeCalledOnceWith(CallDirection.OUTBOUND, undefined, line.lineId, {
        address: 'tel:1234567890',
        type: 'uri',
      });
      expect(call).toBeTruthy();
      expect(call ? call.direction : undefined).toStrictEqual(CallDirection.OUTBOUND);
      expect(call ? call.destination.address : undefined).toStrictEqual('tel:1234567890');
      call?.end();
    });

    it('attempt to create call with incorrect number format 1', (done) => {
      // There may be other listeners , which may create race
      line.removeAllListeners(LINE_EVENTS.ERROR);
      const createCallSpy = jest.spyOn(line.callManager, 'createCall');

      line.on(LINE_EVENTS.ERROR, (error) => {
        expect(error.message).toBe(
          'An invalid phone number was detected. Check the number and try again.'
        );
        done();
      });
      try {
        const call = line.makeCall({address: 'select#$@^^', type: CallType.URI});

        expect(call).toBeUndefined();
        expect(createCallSpy).not.toBeCalledOnceWith({});
      } catch (error) {
        done(error);
      }
    });

    it('attempt to create call with incorrect number format 2', (done) => {
      expect.assertions(4);
      const createCallSpy = jest.spyOn(line.callManager, 'createCall');

      line.on(LINE_EVENTS.ERROR, (error) => {
        expect(error.message).toBe(
          'An invalid phone number was detected. Check the number and try again.'
        );
        done();
      });

      try {
        const call = line.makeCall({address: '+1@8883332505', type: CallType.URI});

        expect(call).toBeUndefined();
        expect(createCallSpy).not.toBeCalledOnceWith({});
      } catch (error) {
        done(error);
      }
    });

    it('attempt to create call with guest calling service indicator', () => {
      expect.assertions(2);
      const createCallSpy = jest.spyOn(line.callManager, 'createCall');

      // Mocking the serviceData to have GUEST_CALLING indicator
      line = new Line(
        userId,
        clientDeviceUri,
        mutex,
        primaryMobiusUris(),
        backupMobiusUris(),
        LOGGER.INFO,
        {indicator: ServiceIndicator.GUEST_CALLING}
      );
      const call = line.makeCall();

      expect(call).toBeTruthy();
      expect(createCallSpy).toBeCalledWith(CallDirection.OUTBOUND, undefined, expect.any(String));
    });
  });
});
