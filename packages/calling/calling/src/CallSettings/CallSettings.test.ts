import {getTestUtilsWebex} from '../common/testUtil';
import {LOGGER} from '../Logger/types';
import {ToggleSetting, ICallSettings, CallForwardSetting, VoicemailSetting} from './types';
import {CallSettings, createCallSettingsClient} from './CallSettings';
import {HTTP_METHODS, WebexRequestPayload} from '../common/types';
import {
  FAILURE_MESSAGE,
  SERVICES_ENDPOINT,
  SUCCESS_MESSAGE,
  XSI_ACTION_ENDPOINT_ORG_URL_PARAM,
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
import { ISDKConnector } from '../SDKConnector/types';
import SDKConnector from '../SDKConnector';

describe('Call Settings Test', () => {
  const webex = getTestUtilsWebex();
  let sdkConnector: ISDKConnector = SDKConnector;
  sdkConnector.setWebex(webex);
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
  });

  describe('Call Settings Client Test', () => {
    it('get callSettings object, setting webex object in it', async () => {
      const callSettingsClient = createCallSettingsClient({level: LOGGER.INFO});

      expect(callSettingsClient).toBeTruthy();
      expect(callSettingsClient.getSDKConnector().getWebex()).toBeTruthy();
    });
  });

  describe('Call Waiting Test', () => {
    let callSettingsClient: ICallSettings;
    const webexUri = `${hydraEndpoint}/${XSI_ACTION_ENDPOINT_ORG_URL_PARAM}`;
    const xsiEndpoint = 'https://api-proxy-si.broadcloudpbx.net/com.broadsoft.xsi-actions';
    const userId = '8a67806f-fc4d-446b-a131-31e71ea5b0e9';
    const callWaitingUrl = `${xsiEndpoint}/${XSI_VERSION}/${USER_ENDPOINT}/${userId}/${SERVICES_ENDPOINT}/${CALL_WAITING_ENDPOINT}`;

    beforeAll(() => {
      callSettingsClient = new CallSettings({level: LOGGER.INFO});

      const mockedUrlResponse = {
        items: [
          {
            id: 'Y2lzY',
            displayName: 'Atlas_Test_WxC_SI_AS10_VAR_WebrtcMobius_DND',
            created: '2022-03-16T11:20:04.561Z',
            xsiDomain: 'api-proxy-si.net',
            xsiActionsEndpoint: 'https://api-proxy-si.broadcloudpbx.net/com.broadsoft.xsi-actions',
            xsiEventsEndpoint: 'https://api-proxy-si.broadcloudpbx.net/com.broadsoft.xsi-events',
            xsiEventsChannelEndpoint:
              'https://api-proxy-si.broadcloudpbx.net/com.broadsoft.async/com.broadsoft.xsi-events',
          },
        ],
      };
      const urlResponsePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: mockedUrlResponse,
      });

      webex.request.mockResolvedValue(urlResponsePayload);
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

      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: webexUri,
      });
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

      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: webexUri,
      });
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
        throw new URIError();
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
          statusCode: 0,
        },
        {
          file: CALL_SETTINGS_FILE,
          method: 'getCallWaitingSetting',
        }
      );
    });
  });

  describe('DND Test', () => {
    let callSettingsClient: ICallSettings;

    const uri = `${hydraEndpoint}/${PEOPLE_ENDPOINT}/${personId}/${DND_ENDPOINT}?${ORG_ENDPOINT}=${orgId}`;

    beforeAll(() => {
      callSettingsClient = new CallSettings({level: LOGGER.INFO});
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
    let callSettingsClient: ICallSettings;
    const callForwardPayload: CallForwardSetting = {
      callForwarding: {
        always: {
          enabled: false,
        },
        busy: {
          enabled: false,
        },
        noAnswer: {
          enabled: true,
          destination: '123123',
          numberOfRings: 3,
        },
      },
      businessContinuity: {
        enabled: false,
      },
    };
    const uri = `${hydraEndpoint}/${PEOPLE_ENDPOINT}/${personId}/${CF_ENDPOINT}?${ORG_ENDPOINT}=${orgId}`;

    beforeAll(() => {
      callSettingsClient = new CallSettings({level: LOGGER.INFO});
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
      expect(callForwardSetting.callForwarding.always.enabled).toBe(false);
      expect(callForwardSetting.callForwarding.busy.enabled).toBe(false);
      expect(callForwardSetting.callForwarding.noAnswer.enabled).toBe(true);
      expect(callForwardSetting.callForwarding.noAnswer.destination).toBe('123123');
      expect(callForwardSetting.callForwarding.noAnswer.numberOfRings).toBe(3);
      expect(callForwardSetting.businessContinuity.enabled).toBe(false);
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
    let callSettingsClient: ICallSettings;
    const dummyEmail = 'abc@test.com';
    const voicemailPayload: VoicemailSetting = {
      enabled: true,
      sendAllCalls: {
        enabled: false,
      },
      sendBusyCalls: {
        enabled: true,
      },
      sendUnansweredCalls: {
        enabled: true,
        numberOfRings: 3,
      },
      notifications: {
        enabled: true,
        destination: dummyEmail,
      },
      emailCopyOfMessage: {
        enabled: true,
        emailId: dummyEmail,
      },
      messageStorage: {
        mwiEnabled: true,
        storageType: 'INTERNAL',
        externalEmail: dummyEmail,
      },
      voiceMessageForwardingEnabled: false,
    };
    const uri = `${hydraEndpoint}/${PEOPLE_ENDPOINT}/${personId}/${VM_ENDPOINT}?${ORG_ENDPOINT}=${orgId}`;

    beforeAll(() => {
      callSettingsClient = new CallSettings({level: LOGGER.INFO});
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
});
