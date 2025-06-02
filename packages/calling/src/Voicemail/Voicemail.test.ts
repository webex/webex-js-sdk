import {getTestUtilsWebex} from '../common/testUtil';
import {createVoicemailClient} from './Voicemail';
import {LOGGER} from '../Logger/types';
import {
  ENTITLEMENT_BASIC,
  ENTITLEMENT_BROADWORKS_CONN,
  ENTITLEMENT_STANDARD,
  METHOD_START_MESSAGE,
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
import log from '../Logger';
import {METHODS} from './constants';

describe('Voicemail Client tests', () => {
  const webex = getTestUtilsWebex();
  let infoSpy;
  let logSpy;
  let errorSpy;

  beforeEach(() => {
    infoSpy = jest.spyOn(log, 'info');
    logSpy = jest.spyOn(log, 'log');
    errorSpy = jest.spyOn(log, 'error');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

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

        expect(infoSpy).toHaveBeenCalledWith(METHOD_START_MESSAGE, {
          file: 'VoicemailClient',
          method: METHODS.INIT,
        });
        expect(logSpy).toHaveBeenCalledWith('Voicemail connector initialized successfully', {
          file: 'VoicemailClient',
          method: METHODS.INIT,
        });
        expect(infoSpy).toHaveBeenCalledWith(METHOD_START_MESSAGE, {
          file: 'VoicemailClient',
          method: METHODS.RESOLVE_CONTACT,
        });
        expect(logSpy).toHaveBeenCalledWith('Contact resolution completed successfully', {
          file: 'VoicemailClient',
          method: METHODS.RESOLVE_CONTACT,
        });

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
        method: 'getVoicemailList',
      },
      {
        metricAction: VOICEMAIL_ACTION.GET_VOICEMAIL_CONTENT,
        method: 'getVoicemailContent',
      },
      {
        metricAction: VOICEMAIL_ACTION.MARK_READ,
        method: 'voicemailMarkAsRead',
      },
      {
        metricAction: VOICEMAIL_ACTION.MARK_UNREAD,
        method: 'voicemailMarkAsUnread',
      },
      {
        metricAction: VOICEMAIL_ACTION.DELETE,
        method: 'deleteVoicemail',
      },
      {
        metricAction: VOICEMAIL_ACTION.TRANSCRIPT,
        method: 'getVMTranscript',
      },
      {
        metricAction: VOICEMAIL_ACTION.GET_VOICEMAIL_SUMMARY,
        method: 'getVoicemailSummary',
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

      // Check logging for success case
      // Check for specific log messages based on method called
      if (data.method === 'getVoicemailList') {
        expect(infoSpy).toHaveBeenCalledWith(
          expect.stringContaining('invoking with: offset='),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VOICEMAIL_LIST,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Successfully retrieved voicemail list'),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VOICEMAIL_LIST,
          })
        );
      } else if (data.method === 'getVoicemailSummary') {
        expect(infoSpy).toHaveBeenCalledWith(
          METHOD_START_MESSAGE,
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VOICEMAIL_SUMMARY,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Successfully retrieved voicemail summary'),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VOICEMAIL_SUMMARY,
          })
        );
      } else if (data.method === 'getVoicemailContent') {
        expect(infoSpy).toHaveBeenCalledWith(
          `${METHOD_START_MESSAGE} with: messageId=${messageId}`,
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VOICEMAIL_CONTENT,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `Successfully retrieved voicemail content for messageId=${messageId}`
          ),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VOICEMAIL_CONTENT,
          })
        );
      } else if (data.method === 'voicemailMarkAsRead') {
        expect(infoSpy).toHaveBeenCalledWith(
          `${METHOD_START_MESSAGE} with: messageId=${messageId}`,
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.VOICEMAIL_MARK_AS_READ,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Successfully marked voicemail as read: messageId=${messageId}`),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.VOICEMAIL_MARK_AS_READ,
          })
        );
      } else if (data.method === 'voicemailMarkAsUnread') {
        expect(infoSpy).toHaveBeenCalledWith(
          `${METHOD_START_MESSAGE} with: messageId=${messageId}`,
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.VOICEMAIL_MARK_AS_UNREAD,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `Successfully marked voicemail as unread: messageId=${messageId}`
          ),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.VOICEMAIL_MARK_AS_UNREAD,
          })
        );
      } else if (data.method === 'deleteVoicemail') {
        expect(infoSpy).toHaveBeenCalledWith(
          `${METHOD_START_MESSAGE} with: messageId=${messageId}`,
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.DELETE_VOICEMAIL,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Successfully deleted voicemail: messageId=${messageId}`),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.DELETE_VOICEMAIL,
          })
        );
      } else if (data.method === 'getVMTranscript') {
        expect(infoSpy).toHaveBeenCalledWith(
          `${METHOD_START_MESSAGE} with: messageId=${messageId}`,
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VM_TRANSCRIPT,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `Successfully retrieved voicemail transcript: messageId=${messageId}`
          ),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VM_TRANSCRIPT,
          })
        );
      }
      expect(errorSpy).not.toHaveBeenCalled();

      expect(metricSpy).toHaveBeenCalledWith(
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

      infoSpy.mockClear();
      logSpy.mockClear();
      errorSpy.mockClear();

      await voicemailClient[data.method](...args);

      // Check for error case logging with specific message checks
      if (data.method === 'getVoicemailList') {
        expect(infoSpy).toHaveBeenCalledWith(
          expect.stringContaining('invoking with: offset='),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VOICEMAIL_LIST,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Successfully retrieved voicemail list'),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VOICEMAIL_LIST,
          })
        );
      } else if (data.method === 'getVoicemailSummary') {
        expect(infoSpy).toHaveBeenCalledWith(
          METHOD_START_MESSAGE,
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VOICEMAIL_SUMMARY,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('Successfully retrieved voicemail summary'),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VOICEMAIL_SUMMARY,
          })
        );
      } else if (data.method === 'getVoicemailContent') {
        expect(infoSpy).toHaveBeenCalledWith(
          `${METHOD_START_MESSAGE} with: messageId=${messageId}`,
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VOICEMAIL_CONTENT,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `Successfully retrieved voicemail content for messageId=${messageId}`
          ),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VOICEMAIL_CONTENT,
          })
        );
      } else if (data.method === 'voicemailMarkAsRead') {
        expect(infoSpy).toHaveBeenCalledWith(
          `${METHOD_START_MESSAGE} with: messageId=${messageId}`,
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.VOICEMAIL_MARK_AS_READ,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Successfully marked voicemail as read: messageId=${messageId}`),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.VOICEMAIL_MARK_AS_READ,
          })
        );
      } else if (data.method === 'voicemailMarkAsUnread') {
        expect(infoSpy).toHaveBeenCalledWith(
          `${METHOD_START_MESSAGE} with: messageId=${messageId}`,
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.VOICEMAIL_MARK_AS_UNREAD,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `Successfully marked voicemail as unread: messageId=${messageId}`
          ),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.VOICEMAIL_MARK_AS_UNREAD,
          })
        );
      } else if (data.method === 'deleteVoicemail') {
        expect(infoSpy).toHaveBeenCalledWith(
          `${METHOD_START_MESSAGE} with: messageId=${messageId}`,
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.DELETE_VOICEMAIL,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining(`Successfully deleted voicemail: messageId=${messageId}`),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.DELETE_VOICEMAIL,
          })
        );
      } else if (data.method === 'getVMTranscript') {
        expect(infoSpy).toHaveBeenCalledWith(
          `${METHOD_START_MESSAGE} with: messageId=${messageId}`,
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VM_TRANSCRIPT,
          })
        );
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            `Successfully retrieved voicemail transcript: messageId=${messageId}`
          ),
          expect.objectContaining({
            file: 'VoicemailClient',
            method: METHODS.GET_VM_TRANSCRIPT,
          })
        );
      }
      expect(errorSpy).not.toHaveBeenCalled();

      expect(metricSpy).toHaveBeenCalledWith(
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
