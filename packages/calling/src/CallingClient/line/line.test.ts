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
  MobiusServers,
  MobiusStatus,
  ServiceIndicator,
  WebexRequestPayload,
} from '../../common/types';
import {LINE_EVENTS, LineStatus} from './types';
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

  const handleErrorSpy = jest.spyOn(utils, 'handleRegistrationErrors');

  jest.clearAllMocks();

  describe('Line Registration tests', () => {
    let line;
    const mockRegistrationBody = getMockDeviceInfo();

    const discoveryBody: MobiusServers = getMobiusDiscoveryResponse();
    const primaryUrl = `${discoveryBody.primary.uris[0]}/calling/web/`;

    const registrationPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 200,
      body: mockRegistrationBody,
    });

    beforeEach(() => {
      line = new Line(
        userId,
        clientDeviceUri,
        LineStatus.ACTIVE,
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
        LOGGER.INFO
      );
      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.DEFAULT);
      await line.register();

      expect(webex.request).toBeCalledOnceWith({
        ...getMockRequestTemplate(),
        body: {
          userId,
          clientDeviceUri,
          serviceData: defaultServiceData,
        },
        uri: `${primaryUrl}device`,
        method: 'POST',
      });
      expect(handleErrorSpy).not.toBeCalled();

      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.ACTIVE);
      expect(line.getActiveMobiusUrl()).toEqual(primaryUrl);
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

      expect(line.getRegistrationStatus()).toBe(MobiusStatus.DEFAULT);
      line.register();
      await utils.waitForMsecs(20);

      expect(line.getRegistrationStatus()).toBe(MobiusStatus.DEFAULT);
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

      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.DEFAULT);
      await line.register();
      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.ACTIVE);

      await line.deregister();
      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.DEFAULT);
    });
  });
});
