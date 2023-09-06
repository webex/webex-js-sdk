/* eslint-disable dot-notation */
import {getTestUtilsWebex} from '../common/testUtil';
import {LOGGER} from '../Logger/types';
import {
  ToggleSetting,
  CallForwardSetting,
  VoicemailSetting,
  IWxCallBackendConnector,
  CallForwardAlwaysSetting,
} from './types';
import {HTTP_METHODS, WebexRequestPayload} from '../common/types';
import {
  FAILURE_MESSAGE,
  SERVICES_ENDPOINT,
  SUCCESS_MESSAGE,
  XSI_ACTION_ENDPOINT_ORG_URL_PARAM,
  WEBEX_CALLING_CONNECTOR_FILE,
} from '../common/constants';
import {
  CALL_SETTINGS_FILE,
  CALL_WAITING_ENDPOINT,
  CF_ENDPOINT,
  DND_ENDPOINT,
  ORG_ENDPOINT,
  PEOPLE_ENDPOINT,
  USER_ENDPOINT,
  VM_ENDPOINT,
  XSI_VERSION,
} from './constants';
import * as utils from '../common/Utils';
import {WxCallBackendConnector} from './WxCallBackendConnector';

import Logger from '../Logger';
import {callForwardPayload, xsiEndpointUrlResponse, voicemailPayload} from './testFixtures';

describe('Call Settings Client Tests for WxCallBackendConnector', () => {
  const warnSpy = jest.spyOn(Logger, 'warn');

  const webex = getTestUtilsWebex();
  let serviceErrorCodeHandlerSpy: jest.SpyInstance;
  const hydraEndpoint = 'https://hydra-a.wbx2.com/v1/';
  const personId =
    'Y2lzY29zcGFyazovL3VzL1BFT1BMRS84YTY3ODA2Zi1mYzRkLTQ0NmItYTEzMS0zMWU3MWVhNWIwZTk=';
  const orgId =
    'Y2lzY29zcGFyazovL3VzL09SR0FOSVpBVElPTi8xNzA0ZDMwZC1hMTMxLTRiYzctOTQ0OS05NDg0ODc2NDM3OTM=';
  const responsePayload403 = <WebexRequestPayload>(<unknown>{
    statusCode: 403,
  });
  const responsePayload400 = <WebexRequestPayload>(<unknown>{
    statusCode: 400,
  });
  const responsePayload204 = <WebexRequestPayload>(<unknown>{
    statusCode: 204,
  });

  beforeEach(() => {
    serviceErrorCodeHandlerSpy = jest.spyOn(utils, 'serviceErrorCodeHandler');
    warnSpy.mockClear();
  });

  describe('Call Waiting Test', () => {
    let callSettingsClient: IWxCallBackendConnector;
    const webexUri = `${hydraEndpoint}/${XSI_ACTION_ENDPOINT_ORG_URL_PARAM}`;
    const xsiEndpoint = 'https://api-proxy-si.broadcloudpbx.net/com.broadsoft.xsi-actions';
    const userId = '8a67806f-fc4d-446b-a131-31e71ea5b0e9';
    const callWaitingUrl = `${xsiEndpoint}/${XSI_VERSION}/${USER_ENDPOINT}/${userId}/${SERVICES_ENDPOINT}/${CALL_WAITING_ENDPOINT}`;

    beforeAll(async () => {
      callSettingsClient = new WxCallBackendConnector(webex, {level: LOGGER.INFO});

      const urlResponsePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: xsiEndpointUrlResponse,
      });

      webex.request.mockResolvedValue(urlResponsePayload);
      await callSettingsClient.getCallWaitingSetting();
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: webexUri,
      });
      expect(callSettingsClient['xsiEndpoint']).toEqual(xsiEndpoint);
      webex.request.mockClear();
    });

    it('Success: Get Call Waiting setting enabled', async () => {
      const callWaitingMockedResponse = '<CallWaiting><active>true</active></CallWaiting>';

      global.fetch = jest.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          text: () => Promise.resolve(callWaitingMockedResponse),
        })
      ) as jest.Mock;
      const response = await callSettingsClient.getCallWaitingSetting();
      const toggleSetting = response.data.callSetting as ToggleSetting;

      expect(webex.request).not.toBeCalled();
      expect(response.statusCode).toBe(200);
      expect(response.message).toBe(SUCCESS_MESSAGE);
      expect(toggleSetting.enabled).toStrictEqual(true);
      expect(global.fetch).toBeCalledOnceWith(callWaitingUrl, {
        method: HTTP_METHODS.GET,
        headers: {
          Authorization: await webex.credentials.getUserToken(),
        },
      });
    });

    it('Success: Get Call Waiting setting disabled', async () => {
      const callWaitingMockedResponse = '<CallWaiting><active>false</active></CallWaiting>';

      global.fetch = jest.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          text: () => Promise.resolve(callWaitingMockedResponse),
        })
      ) as jest.Mock;
      const response = await callSettingsClient.getCallWaitingSetting();
      const toggleSetting = response.data.callSetting as ToggleSetting;

      expect(webex.request).not.toBeCalled();
      expect(response.statusCode).toBe(200);
      expect(response.message).toBe(SUCCESS_MESSAGE);
      expect(toggleSetting.enabled).toStrictEqual(false);
      expect(global.fetch).toBeCalledOnceWith(callWaitingUrl, {
        method: HTTP_METHODS.GET,
        headers: {
          Authorization: await webex.credentials.getUserToken(),
        },
      });
    });

    it('Error: Get Call Waiting setting throw 403 error', async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          status: 403,
          ok: false,
        })
      ) as jest.Mock;
      const response = await callSettingsClient.getCallWaitingSetting();

      expect(response.statusCode).toBe(403);
      expect(response.message).toBe(FAILURE_MESSAGE);
      expect(global.fetch).toBeCalledOnceWith(callWaitingUrl, {
        method: HTTP_METHODS.GET,
        headers: {
          Authorization: await webex.credentials.getUserToken(),
        },
      });
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 403,
        },
        {
          file: CALL_SETTINGS_FILE,
          method: 'getCallWaitingSetting',
        }
      );
    });

    it('Error: Get Call Waiting settings throw URI error', async () => {
      global.fetch = jest.fn().mockImplementation(() => {
        throw new URIError('422');
      }) as jest.Mock;
      const response = await callSettingsClient.getCallWaitingSetting();

      expect(response.statusCode).toBe(422);
      expect(response.message).toBe(FAILURE_MESSAGE);
      expect(global.fetch).toBeCalledOnceWith(callWaitingUrl, {
        method: HTTP_METHODS.GET,
        headers: {
          Authorization: await webex.credentials.getUserToken(),
        },
      });
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 422,
        },
        {
          file: CALL_SETTINGS_FILE,
          method: 'getCallWaitingSetting',
        }
      );
    });
  });

  describe('DND Test', () => {
    let callSettingsClient: IWxCallBackendConnector;

    const uri = `${hydraEndpoint}/${PEOPLE_ENDPOINT}/${personId}/${DND_ENDPOINT}?${ORG_ENDPOINT}=${orgId}`;

    beforeAll(() => {
      callSettingsClient = new WxCallBackendConnector(webex, {level: LOGGER.INFO});
    });

    it('Success: Set DND settings', async () => {
      const dndRequestBody: ToggleSetting = {
        enabled: false,
        ringSplashEnabled: false,
      };

      webex.request.mockResolvedValueOnce(responsePayload204);
      const response = await callSettingsClient.setDoNotDisturbSetting(false);

      expect(response.statusCode).toBe(204);
      expect(response.message).toBe(SUCCESS_MESSAGE);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.PUT,
        uri,
        body: dndRequestBody,
      });
    });

    it('Success: Get DND setting', async () => {
      const dndResponsePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: {
          enabled: true,
        },
      });

      webex.request.mockResolvedValueOnce(dndResponsePayload);
      const response = await callSettingsClient.getDoNotDisturbSetting();
      const toggleSetting = response.data.callSetting as ToggleSetting;

      expect(response.statusCode).toBe(200);
      expect(response.message).toBe(SUCCESS_MESSAGE);
      expect(toggleSetting.enabled).toBe(true);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri,
      });
    });

    it('Error: Set DND setting', async () => {
      const dndRequestBody: ToggleSetting = {
        enabled: false,
        ringSplashEnabled: false,
      };

      webex.request.mockRejectedValueOnce(responsePayload400);
      const response = await callSettingsClient.setDoNotDisturbSetting(false);

      expect(response.statusCode).toBe(400);
      expect(response.message).toBe(FAILURE_MESSAGE);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.PUT,
        uri,
        body: dndRequestBody,
      });
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 400,
        },
        {
          file: CALL_SETTINGS_FILE,
          method: 'setDoNotDisturbSetting',
        }
      );
    });

    it('Error: Get DND setting', async () => {
      webex.request.mockRejectedValueOnce(responsePayload403);
      const response = await callSettingsClient.getDoNotDisturbSetting();

      expect(response.statusCode).toBe(403);
      expect(response.message).toBe(FAILURE_MESSAGE);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri,
      });
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 403,
        },
        {
          file: CALL_SETTINGS_FILE,
          method: 'getDoNotDisturbSetting',
        }
      );
    });
  });

  describe('Call Forward Test', () => {
    let callSettingsClient: IWxCallBackendConnector;
    const uri = `${hydraEndpoint}/${PEOPLE_ENDPOINT}/${personId}/${CF_ENDPOINT}?${ORG_ENDPOINT}=${orgId}`;

    beforeAll(() => {
      callSettingsClient = new WxCallBackendConnector(webex, {level: LOGGER.INFO});
    });

    it('Success: Set Call Forward setting', async () => {
      webex.request.mockResolvedValueOnce(responsePayload204);
      const response = await callSettingsClient.setCallForwardSetting(callForwardPayload);

      expect(response.statusCode).toBe(204);
      expect(response.message).toBe(SUCCESS_MESSAGE);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.PUT,
        uri,
        body: callForwardPayload,
      });
    });

    it('Success: Get Call Forward setting', async () => {
      const responsePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: callForwardPayload,
      });

      webex.request.mockResolvedValueOnce(responsePayload);
      const response = await callSettingsClient.getCallForwardSetting();
      const callForwardSetting = response.data.callSetting as CallForwardSetting;

      expect(response.statusCode).toBe(200);
      expect(response.message).toBe(SUCCESS_MESSAGE);
      expect(callForwardSetting).toEqual(callForwardPayload);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri,
      });
    });

    it('Error: Set Call Forwarding setting', async () => {
      webex.request.mockRejectedValueOnce(responsePayload400);
      const response = await callSettingsClient.setCallForwardSetting(callForwardPayload);

      expect(response.statusCode).toBe(400);
      expect(response.message).toBe(FAILURE_MESSAGE);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.PUT,
        uri,
        body: callForwardPayload,
      });
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 400,
        },
        {
          file: CALL_SETTINGS_FILE,
          method: 'setCallForwardingSetting',
        }
      );
    });

    it('Error: Get Call Forwarding setting', async () => {
      webex.request.mockRejectedValueOnce(responsePayload403);
      const response = await callSettingsClient.getCallForwardSetting();

      expect(response.statusCode).toBe(403);
      expect(response.message).toBe(FAILURE_MESSAGE);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri,
      });
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 403,
        },
        {
          file: CALL_SETTINGS_FILE,
          method: 'getCallForwardingSetting',
        }
      );
    });
  });

  describe('Voicemail Test', () => {
    let callSettingsClient: IWxCallBackendConnector;

    const uri = `${hydraEndpoint}/${PEOPLE_ENDPOINT}/${personId}/${VM_ENDPOINT}?${ORG_ENDPOINT}=${orgId}`;

    beforeAll(() => {
      callSettingsClient = new WxCallBackendConnector(webex, {level: LOGGER.INFO});
    });

    it('Success: Set Voicemail setting', async () => {
      webex.request.mockResolvedValueOnce(responsePayload204);
      const response = await callSettingsClient.setVoicemailSetting(voicemailPayload);

      expect(response.statusCode).toBe(204);
      expect(response.message).toBe(SUCCESS_MESSAGE);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.PUT,
        uri,
        body: voicemailPayload,
      });
    });

    it('Success: Get Voicemail setting', async () => {
      const responsePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: voicemailPayload,
      });

      webex.request.mockResolvedValueOnce(responsePayload);
      const response = await callSettingsClient.getVoicemailSetting();
      const voicemailSetting = response.data.callSetting as VoicemailSetting;

      expect(response.statusCode).toBe(200);
      expect(response.message).toBe(SUCCESS_MESSAGE);
      expect(voicemailSetting).toBe(voicemailPayload);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri,
      });
    });

    it('Error: Set Voicemail setting', async () => {
      webex.request.mockRejectedValueOnce(responsePayload400);
      const response = await callSettingsClient.setVoicemailSetting(voicemailPayload);

      expect(response.statusCode).toBe(400);
      expect(response.message).toBe(FAILURE_MESSAGE);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.PUT,
        uri,
        body: voicemailPayload,
      });
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 400,
        },
        {
          file: CALL_SETTINGS_FILE,
          method: 'setVoicemailSetting',
        }
      );
    });

    it('Error: Get Voicemail setting', async () => {
      webex.request.mockRejectedValueOnce(responsePayload403);
      const response = await callSettingsClient.getVoicemailSetting();

      expect(response.statusCode).toBe(403);
      expect(response.message).toBe(FAILURE_MESSAGE);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri,
      });
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 403,
        },
        {
          file: CALL_SETTINGS_FILE,
          method: 'getVoicemailSetting',
        }
      );
    });
  });

  describe('Call Forward Always test', () => {
    let callSettingsClient: IWxCallBackendConnector;

    const callForwardingUri = `${hydraEndpoint}/${PEOPLE_ENDPOINT}/${personId}/${CF_ENDPOINT}?${ORG_ENDPOINT}=${orgId}`;

    const voicemailUri = `${hydraEndpoint}/${PEOPLE_ENDPOINT}/${personId}/${VM_ENDPOINT}?${ORG_ENDPOINT}=${orgId}`;

    beforeAll(() => {
      callSettingsClient = new WxCallBackendConnector(webex, {level: LOGGER.INFO});
    });

    it('Success: Get Call Forward Always setting when set to destination', async () => {
      const responsePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: callForwardPayload,
      });

      webex.request.mockResolvedValueOnce(responsePayload);
      const response = await callSettingsClient.getCallForwardAlwaysSetting();
      const callForwardSetting = response.data.callSetting as CallForwardAlwaysSetting;

      expect(response.statusCode).toBe(200);
      expect(response.message).toBe(SUCCESS_MESSAGE);
      expect(callForwardSetting.enabled).toBe(true);
      expect(callForwardSetting.destination).toBe('123456789');
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: callForwardingUri,
      });
    });

    it('Success: Get Call Forward Always setting when set to disabled and voicemail request fails', async () => {
      callForwardPayload.callForwarding.always.enabled = false;
      const responsePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: callForwardPayload,
      });

      webex.request.mockResolvedValueOnce(responsePayload).mockRejectedValueOnce({statusCode: 503});
      const response = await callSettingsClient.getCallForwardAlwaysSetting();

      expect(response.statusCode).toBe(503);
      expect(response.message).toBe(FAILURE_MESSAGE);
      expect(response.data.error).toBe('Unable to retrieve voicemail settings.');

      expect(webex.request).toBeCalledTimes(2);
      expect(webex.request).toBeCalledWith({
        method: HTTP_METHODS.GET,
        uri: callForwardingUri,
      });
      expect(webex.request).toBeCalledWith({
        method: HTTP_METHODS.GET,
        uri: voicemailUri,
      });

      expect(warnSpy).toBeCalledTimes(2);
      expect(warnSpy).toBeCalledWith('503 Unable to establish a connection with the server', {
        file: CALL_SETTINGS_FILE,
        method: callSettingsClient.getVoicemailSetting.name,
      });
      expect(warnSpy).toBeCalledWith('Unable to retrieve voicemail settings.', {
        file: WEBEX_CALLING_CONNECTOR_FILE,
        method: callSettingsClient.getCallForwardAlwaysSetting.name,
      });
    });

    it('Success: Get Call Forward Always setting when set to voicemail', async () => {
      callForwardPayload.callForwarding.always.enabled = false;
      const responsePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: callForwardPayload,
      });

      webex.request
        .mockResolvedValueOnce(responsePayload)
        .mockResolvedValueOnce({statusCode: 200, body: voicemailPayload});
      const response = await callSettingsClient.getCallForwardAlwaysSetting();
      const callForwardSetting = response.data.callSetting as CallForwardAlwaysSetting;

      expect(response.statusCode).toBe(200);
      expect(response.message).toBe(SUCCESS_MESSAGE);
      expect(callForwardSetting.enabled).toBe(true);
      expect(callForwardSetting.destination).toBe('VOICEMAIL');
      expect(webex.request).toBeCalledTimes(2);
      expect(webex.request).toBeCalledWith({
        method: HTTP_METHODS.GET,
        uri: callForwardingUri,
      });
      expect(webex.request).toBeCalledWith({
        method: HTTP_METHODS.GET,
        uri: voicemailUri,
      });
    });

    it('Success: Get Call Forward Always setting when not set', async () => {
      callForwardPayload.callForwarding.always.enabled = false;
      callForwardPayload.callForwarding.always.destination = '';
      const responsePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: callForwardPayload,
      });

      voicemailPayload.sendAllCalls.enabled = false;
      webex.request
        .mockResolvedValueOnce(responsePayload)
        .mockResolvedValueOnce({statusCode: 200, body: voicemailPayload});
      const response = await callSettingsClient.getCallForwardAlwaysSetting();
      const callForwardSetting = response.data.callSetting as CallForwardAlwaysSetting;

      expect(response.statusCode).toBe(200);
      expect(response.message).toBe(SUCCESS_MESSAGE);
      expect(callForwardSetting.enabled).toBe(false);
      expect(callForwardSetting.destination).toBeFalsy();
      expect(webex.request).toBeCalledTimes(2);
      expect(webex.request).toBeCalledWith({
        method: HTTP_METHODS.GET,
        uri: callForwardingUri,
      });
      expect(webex.request).toBeCalledWith({
        method: HTTP_METHODS.GET,
        uri: voicemailUri,
      });
    });

    it('Failure: Get Call Forward Always setting fails', async () => {
      const responsePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
      });

      webex.request.mockRejectedValueOnce(responsePayload);
      const response = await callSettingsClient.getCallForwardAlwaysSetting();

      expect(response.statusCode).toBe(503);
      expect(response.message).toBe(FAILURE_MESSAGE);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: callForwardingUri,
      });
    });
  });
});
