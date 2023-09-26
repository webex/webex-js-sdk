import {getTestUtilsWebex} from '../common/testUtil';
import {createVoicemailClient} from './Voicemail';
import {LOGGER} from '../Logger/types';
import {
  ENTITLEMENT_BASIC,
  ENTITLEMENT_BROADWORKS_CONN,
  ENTITLEMENT_STANDARD,
  NATIVE_SIP_CALL_TO_UCM,
  NATIVE_WEBEX_TEAMS_CALLING,
} from '../common/constants';
import {VoicemailResponseEvent} from './types';
import {CALLING_BACKEND, SORT} from '../common/types';
import {UcmBackendConnector} from './UcmBackendConnector';
import {BroadworksBackendConnector} from './BroadworksBackendConnector';
import {WxCallBackendConnector} from './WxCallBackendConnector';
import {VOICEMAIL_ACTION, METRIC_EVENT, METRIC_TYPE} from '../Metrics/types';
import {resolveContactArgs} from './voicemailFixture';

describe('Voicemail Client tests', () => {
  const webex = getTestUtilsWebex();

  describe('createVoicemailClient tests', () => {
    /**
     * TestCase inputs
     * name: TestCase name
     * callingBehavior: Calling profile
     * entitlement: Entitlement
     * valid: expected result for vm client creation with given inputs.
     */
    const testData: {
      name: string;
      callingBehavior: string;
      entitlement: string;
      valid: boolean;
    }[] = [
      {
        name: 'verify valid ucm voicemail client',
        callingBehavior: NATIVE_SIP_CALL_TO_UCM,
        entitlement: 'none',
        valid: true,
      },
      {
        name: 'verify valid wxc voicemail client with basic entitlement',
        callingBehavior: NATIVE_WEBEX_TEAMS_CALLING,
        entitlement: ENTITLEMENT_BASIC,
        valid: true,
      },
      {
        name: 'verify valid wxc voicemail client with standard entitlement',
        callingBehavior: NATIVE_WEBEX_TEAMS_CALLING,
        entitlement: ENTITLEMENT_STANDARD,
        valid: true,
      },
      {
        name: 'verify valid wxc voicemail client with broadworks entitlement',
        callingBehavior: NATIVE_WEBEX_TEAMS_CALLING,
        entitlement: ENTITLEMENT_BROADWORKS_CONN,
        valid: true,
      },
      {
        name: 'verify invalid callingBehavior',
        callingBehavior: 'INVALID',
        entitlement: ENTITLEMENT_BASIC,
        valid: false,
      },
      {
        name: 'verify invalid entitlement for wxc voicemail client',
        callingBehavior: NATIVE_WEBEX_TEAMS_CALLING,
        entitlement: 'invalid',
        valid: false,
      },
    ].map((stat) =>
      Object.assign(stat, {
        toString() {
          /* eslint-disable dot-notation */
          return this['name'];
        },
      })
    );

    it.each(testData)('%s', async (data) => {
      webex.internal.device.callingBehavior = data.callingBehavior;
      webex.internal.device.features.entitlement.models = [{_values: {key: data.entitlement}}];
      if (data.valid) {
        const voicemailClient = createVoicemailClient(webex, {level: LOGGER.INFO});

        voicemailClient['backendConnector'].init = jest.fn(() => Promise.resolve({}));
        voicemailClient['backendConnector'].resolveContact = jest.fn(() => Promise.resolve({}));

        const connectorResponse = voicemailClient.init();
        const contactResponse = voicemailClient.resolveContact(resolveContactArgs);

        expect(voicemailClient).toBeTruthy();
        expect(voicemailClient.getSDKConnector().getWebex()).toBeTruthy();
        expect(connectorResponse).toBeTruthy();
        expect(contactResponse).toBeTruthy();

        switch (data.callingBehavior) {
          case NATIVE_SIP_CALL_TO_UCM:
            expect(voicemailClient['callingBackend']).toStrictEqual(CALLING_BACKEND.UCM);
            expect(voicemailClient['backendConnector']).toBeInstanceOf(UcmBackendConnector);
            break;
          case NATIVE_WEBEX_TEAMS_CALLING:
            if (data.entitlement === ENTITLEMENT_BROADWORKS_CONN) {
              expect(voicemailClient['callingBackend']).toStrictEqual(CALLING_BACKEND.BWRKS);
              expect(voicemailClient['backendConnector']).toBeInstanceOf(
                BroadworksBackendConnector
              );
            } else {
              /* entitlement basic and standard */
              expect(voicemailClient['callingBackend']).toStrictEqual(CALLING_BACKEND.WXC);
              expect(voicemailClient['backendConnector']).toBeInstanceOf(WxCallBackendConnector);
            }
            break;
          default:
            fail('Unknown calling backend type.');
        }
      } else {
        expect(() => {
          createVoicemailClient(webex, {level: LOGGER.INFO});
        }).toThrowError('Calling backend is not identified, exiting....');
      }
    });
  });

  describe('voicemail metrics test', () => {
    webex.internal.device.callingBehavior = NATIVE_WEBEX_TEAMS_CALLING;
    webex.internal.device.features.entitlement.models = [{_values: {key: ENTITLEMENT_STANDARD}}];
    const voicemailClient = createVoicemailClient(webex, {level: LOGGER.INFO});
    const messageId =
      '/v2.0/user/08cedee9-296f-4aaf-bd4b-e14f2399abdf/VoiceMessagingMessages/ec8c3baf-afe4-4cef-b02f-19026b9e039c';
    const metricSpy = jest.spyOn(voicemailClient['metricManager'], 'submitVoicemailMetric');

    voicemailClient['backendConnector'] = {
      getVoicemailList: jest.fn(),
      getVoicemailContent: jest.fn(),
      getVoicemailSummary: jest.fn(),
      voicemailMarkAsRead: jest.fn(),
      voicemailMarkAsUnread: jest.fn(),
      deleteVoicemail: jest.fn(),
      getVMTranscript: jest.fn(),
      resolveContact: jest.fn(),
    };

    const testData: {
      metricAction: VOICEMAIL_ACTION;
      method: string;
    }[] = [
      {
        metricAction: VOICEMAIL_ACTION.GET_VOICEMAILS,
        method: voicemailClient.getVoicemailList.name,
      },
      {
        metricAction: VOICEMAIL_ACTION.GET_VOICEMAIL_CONTENT,
        method: voicemailClient.getVoicemailContent.name,
      },
      {
        metricAction: VOICEMAIL_ACTION.MARK_READ,
        method: voicemailClient.voicemailMarkAsRead.name,
      },
      {
        metricAction: VOICEMAIL_ACTION.MARK_UNREAD,
        method: voicemailClient.voicemailMarkAsUnread.name,
      },
      {
        metricAction: VOICEMAIL_ACTION.DELETE,
        method: voicemailClient.deleteVoicemail.name,
      },
      {
        metricAction: VOICEMAIL_ACTION.TRANSCRIPT,
        method: voicemailClient.getVMTranscript.name,
      },
      {
        metricAction: VOICEMAIL_ACTION.GET_VOICEMAIL_SUMMARY,
        method: voicemailClient.getVoicemailSummary.name,
      },
    ].map((stat) =>
      Object.assign(stat, {
        toString() {
          return `test ${this['method']} with metrics`;
        },
      })
    );

    it.each(testData)('%s', async (data) => {
      const response = {
        statusCode: 204,
        message: 'SUCCESS',
        data: {},
      } as VoicemailResponseEvent;

      const args =
        (data.metricAction === VOICEMAIL_ACTION.GET_VOICEMAIL_SUMMARY && []) ||
        data.metricAction === VOICEMAIL_ACTION.GET_VOICEMAILS
          ? [0, 0, SORT.ASC]
          : [messageId];

      voicemailClient['backendConnector'][data.method].mockResolvedValue(response);
      await voicemailClient[data.method](...args);

      expect(metricSpy).toBeCalledOnceWith(
        METRIC_EVENT.VOICEMAIL,
        data.metricAction,
        METRIC_TYPE.BEHAVIORAL,
        [VOICEMAIL_ACTION.GET_VOICEMAILS, VOICEMAIL_ACTION.GET_VOICEMAIL_SUMMARY].includes(
          data.metricAction
        )
          ? undefined
          : messageId
      );

      metricSpy.mockClear();

      const errorMessage = 'User is unauthorised';
      const errorCode = 401;

      response.statusCode = errorCode;
      response.data = {error: errorMessage};

      await voicemailClient[data.method](...args);

      expect(metricSpy).toBeCalledOnceWith(
        METRIC_EVENT.VOICEMAIL_ERROR,
        data.metricAction,
        METRIC_TYPE.BEHAVIORAL,
        [VOICEMAIL_ACTION.GET_VOICEMAILS, VOICEMAIL_ACTION.GET_VOICEMAIL_SUMMARY].includes(
          data.metricAction
        )
          ? undefined
          : messageId,
        errorMessage,
        errorCode
      );
    });
  });
});
