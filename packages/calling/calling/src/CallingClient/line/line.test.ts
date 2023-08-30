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
import {LineStatus} from './types';
import Line from '.';
import * as utils from '../../common/Utils';
import SDKConnector from '../../SDKConnector';
import {URL_ENDPOINT} from '../constants';
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

  describe('Registration tests', () => {
    let line;
    const mockRegistrationBody = getMockDeviceInfo();

    const discoveryBody: MobiusServers = getMobiusDiscoveryResponse();
    const primaryUrl = `${discoveryBody.primary.uris[0]}/calling/web/`;

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
    });

    it('verify successful Registration cases and keepalive', async () => {
      jest.useFakeTimers();
      webex.request.mockReturnValue(registrationPayload);

      expect(createRegistrationSpy).toBeCalledWith(
        webex,
        defaultServiceData,
        expect.any(Mutex),
        expect.anything(),
        LOGGER.INFO
      );
      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.DEFAULT);
      await line.register();

      expect(webex.request).toBeCalledTimes(1);
      expect(handleErrorSpy).not.toBeCalled();

      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.ACTIVE);
      expect(line.getActiveMobiusUrl()).toEqual(primaryUrl);
      expect(line.getLoggingLevel()).toEqual(LOGGER.INFO);
      expect(line.getDeviceId()).toEqual(mockRegistrationBody.device.deviceId);

      /** trigger sendKeepAlive and verify whether keepalive request is sent or not */
      webex.request.mockClear();

      /* specify keepalive interval as 30 seconds and advance timers by 30 */
      line.sendKeepAlive({...mockRegistrationBody, keepaliveInterval: 30});

      jest.advanceTimersByTime(30 * 1000);
      await Promise.resolve();

      expect(webex.request).toBeCalledWith({
        ...getMockRequestTemplate(),
        uri: `${mockRegistrationBody.device.uri}/status`,
        method: 'POST',
      });
      jest.useRealTimers();
    });

    it('verify post registration api call when default mobius url is used', async () => {
      const uri = `${webex.internal.services._serviceUrls.mobius}${URL_ENDPOINT}`;
      webex.request.mockReturnValue(registrationPayload);
      primaryMobiusUris.mockReturnValueOnce([uri]);

      // calling it here as we need a different mobius uri to be passed in to constructor
      line = new Line(
        userId,
        clientDeviceUri,
        LineStatus.ACTIVE,
        mutex,
        primaryMobiusUris(),
        backupMobiusUris(),
        LOGGER.WARN
      );

      expect(createRegistrationSpy).toBeCalledWith(
        webex,
        defaultServiceData,
        expect.any(Mutex),
        expect.anything(),
        LOGGER.WARN
      );
      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.DEFAULT);
      await line.register();

      expect(webex.request).toBeCalledTimes(1);
      expect(handleErrorSpy).not.toBeCalled();

      expect(line.getRegistrationStatus()).toEqual(MobiusStatus.ACTIVE);

      expect(line.getActiveMobiusUrl()).toBe(uri);

      expect(webex.request).toBeCalledWith({
        method: 'POST',
        ...getMockRequestTemplate(),
        uri: `${uri}device`,
        body: mockBody,
      });
    });

    it('verify failure Registration cases all requests fail ', async () => {
      webex.request.mockImplementation(() => {
        throw new Error();
      });

      expect(line.getRegistrationStatus()).toBe(MobiusStatus.DEFAULT);
      line.register();
      await utils.waitForMsecs(20);

      expect(line.getRegistrationStatus()).toBe(MobiusStatus.DEFAULT);
      expect(handleErrorSpy).toBeCalled();
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
