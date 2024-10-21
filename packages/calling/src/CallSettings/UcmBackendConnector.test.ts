import {LOGGER} from '../Logger/types';
import * as utils from '../common/Utils';
import {
  FAILURE_MESSAGE,
  SUCCESS_MESSAGE,
  UCM_CONNECTOR_FILE,
  WEBEX_API_CONFIG_INT_URL,
} from '../common/constants';
import {getTestUtilsWebex} from '../common/testUtil';
import {HTTP_METHODS, WebexRequestPayload} from '../common/types';
import {UcmBackendConnector} from './UcmBackendConnector';
import {CF_ENDPOINT, ORG_ENDPOINT, PEOPLE_ENDPOINT} from './constants';
import {CallForwardAlwaysSetting, CallForwardingSettingsUCM, IUcmBackendConnector} from './types';

describe('Call Settings Client Tests for UcmBackendConnector', () => {
  const webex = getTestUtilsWebex();

  const userId = '8a67806f-fc4d-446b-a131-31e71ea5b0e9';
  const orgId = '1704d30d-a131-4bc7-9449-948487643793';

  describe('Call Forward Always test', () => {
    let callSettingsClient: IUcmBackendConnector;
    const callForwardPayload: CallForwardingSettingsUCM = {
      callForwarding: {
        always: [
          {
            dn: '8001',
            destination: '8004',
            destinationVoicemailEnabled: false,
            e164Number: '+14922999903',
          },
          {
            dn: '8002',
            destinationVoicemailEnabled: true,
            e164Number: '',
          },
          {
            dn: '8003',
            destinationVoicemailEnabled: false,
            e164Number: '',
          },
          {
            dn: '8000',
            destination: '8007',
            destinationVoicemailEnabled: false,
            e164Number: '8006',
          },
        ],
      },
    };

    const callForwardingUri = `${WEBEX_API_CONFIG_INT_URL}/${PEOPLE_ENDPOINT}/${userId}/${CF_ENDPOINT.toLowerCase()}?${ORG_ENDPOINT}=${orgId}`;

    beforeAll(() => {
      callSettingsClient = new UcmBackendConnector(webex, {level: LOGGER.INFO}, false);
    });

    beforeEach(() => {
      const responsePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 200,
        body: callForwardPayload,
      });

      webex.request.mockResolvedValue(responsePayload);
    });

    it('Success: Get Call Forward Always setting when set to destination', async () => {
      const response = await callSettingsClient.getCallForwardAlwaysSetting('8001');

      const callForwardSetting = response.data.callSetting as CallForwardAlwaysSetting;

      expect(response.statusCode).toEqual(200);
      expect(response.message).toEqual(SUCCESS_MESSAGE);
      expect(callForwardSetting.enabled).toEqual(true);
      expect(callForwardSetting.destination).toEqual('8004');
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: callForwardingUri,
      });
    });

    it('Success: Get Call Forward Always setting when set to voicemail', async () => {
      const response = await callSettingsClient.getCallForwardAlwaysSetting('8002');

      const callForwardSetting = response.data.callSetting as CallForwardAlwaysSetting;

      expect(response.statusCode).toEqual(200);
      expect(response.message).toEqual(SUCCESS_MESSAGE);
      expect(callForwardSetting.enabled).toEqual(true);
      expect(callForwardSetting.destination).toEqual('VOICEMAIL');
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: callForwardingUri,
      });
    });

    it('Success: Get Call Forward Always setting when not set', async () => {
      const response = await callSettingsClient.getCallForwardAlwaysSetting('8003');

      const callForwardSetting = response.data.callSetting as CallForwardAlwaysSetting;

      expect(response.statusCode).toEqual(200);
      expect(response.message).toEqual(SUCCESS_MESSAGE);
      expect(callForwardSetting.enabled).toEqual(false);
      expect(callForwardSetting.destination).toBeFalsy();
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: callForwardingUri,
      });
    });

    it('Success: Get Call Forward Always setting when directory num matching with e16number and set to destination', async () => {
      const response = await callSettingsClient.getCallForwardAlwaysSetting('8006');

      const callForwardSetting = response.data.callSetting as CallForwardAlwaysSetting;

      expect(response.statusCode).toEqual(200);
      expect(response.message).toEqual(SUCCESS_MESSAGE);
      expect(callForwardSetting.enabled).toEqual(true);
      expect(callForwardSetting.destination).toEqual('8007');
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: callForwardingUri,
      });
    });

    it('Failure: Get Call Forward Always setting fails', async () => {
      const responsePayload = <WebexRequestPayload>(<unknown>{
        statusCode: 503,
      });

      webex.request.mockClear();
      webex.request.mockRejectedValue(responsePayload);
      const serviceErrorCodeHandlerSpy = jest.spyOn(utils, 'serviceErrorCodeHandler');
      const response = await callSettingsClient.getCallForwardAlwaysSetting('8002');

      expect(response.statusCode).toEqual(503);
      expect(response.message).toEqual(FAILURE_MESSAGE);
      expect(response.data.error).toEqual('Unable to establish a connection with the server');
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: callForwardingUri,
      });
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(responsePayload, {
        file: UCM_CONNECTOR_FILE,
        method: callSettingsClient.getCallForwardAlwaysSetting.name,
      });
    });

    it('Failure: Get Call Forward Always setting fails - wrong directoryNumber', async () => {
      const response = await callSettingsClient.getCallForwardAlwaysSetting('8005');

      expect(response.statusCode).toEqual(404);
      expect(response.message).toEqual(FAILURE_MESSAGE);
      expect(response.data.error).toEqual('Directory Number is not assigned to the user');
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: callForwardingUri,
      });
    });

    it('Failure: Get Call Forward Always setting fails when no directoryNumberProvided', async () => {
      const response = await callSettingsClient.getCallForwardAlwaysSetting();

      expect(response.statusCode).toEqual(400);
      expect(response.message).toEqual(FAILURE_MESSAGE);
      expect(response.data.error).toEqual('Directory Number is mandatory for UCM backend');
      expect(webex.request).not.toBeCalled();
    });

    describe('Unsupported methods return failure', () => {
      const unsupportedMethods: string[] = [
        'getCallWaitingSetting',
        'getDoNotDisturbSetting',
        'setDoNotDisturbSetting',
        'getCallForwardSetting',
        'setCallForwardSetting',
        'getVoicemailSetting',
        'setVoicemailSetting',
      ];

      it.each(unsupportedMethods)('%s', async (methodName) => {
        const response = await callSettingsClient[methodName]();

        expect(response.statusCode).toEqual(501);
        expect(response.message).toEqual(FAILURE_MESSAGE);
        expect(response.data.error).toEqual('Method is not implemented at the backend');
        expect(webex.request).not.toBeCalled();
      });
    });
  });
});
