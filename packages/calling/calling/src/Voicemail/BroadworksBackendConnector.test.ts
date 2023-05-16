/* eslint-disable dot-notation */
import {LOGGER} from '../Logger/types';
import {getTestUtilsWebex} from '../common/testUtil';
import {SORT, WebexRequestPayload} from '../common/types';
import {BroadworksBackendConnector} from './BroadworksBackendConnector';
import {
  broadworksTokenType,
  bwToken,
  getVoicemailListJsonBWRKS,
  mockBWRKSData,
  mockVoicemailBody,
  broadworksUserInfoUrl,
  broadworksUserMessageId,
  getDescVoicemailListJsonBWRKS,
  getAscVoicemailListJsonBWRKS,
} from './voicemailFixture';
import {CallingPartyInfo, IBroadworksCallBackendConnector} from './types';
import {
  JSON_FORMAT,
  MARK_AS_READ,
  MARK_AS_UNREAD,
  NO_VOICEMAIL_MSG,
  NO_VOICEMAIL_STATUS_CODE,
} from './constants';
import * as utils from '../common/Utils';

const webex = getTestUtilsWebex();

describe('Voicemail Broadworks Backend Connector Test case', () => {
  let broadworksBackendConnector: IBroadworksCallBackendConnector;
  let getSortedVoicemailListSpy: jest.SpyInstance;
  let storeVoicemailListSpy: jest.SpyInstance;
  let fetchVoicemailListSpy: jest.SpyInstance;

  beforeAll(() => {
    webex.internal.device.features.entitlement.models = [{_values: {key: 'broadworks-connector'}}];
    broadworksBackendConnector = new BroadworksBackendConnector(webex, {level: LOGGER.INFO});
  });

  describe('Voicemail failure test cases', () => {
    let serviceErrorCodeHandlerSpy: jest.SpyInstance;

    beforeEach(() => {
      serviceErrorCodeHandlerSpy = jest.spyOn(utils, 'serviceErrorCodeHandler');
    });

    it('verify exception case for the mark read case when messageid is invalid', async () => {
      const response = await broadworksBackendConnector.voicemailMarkAsRead('dummy');

      expect(response.message).toBe('FAILURE');
      expect(response.statusCode).toBe(422);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: NaN,
        },
        {
          file: 'BroadworksBackendConnector',
          method: 'voicemailMarkAsRead',
        }
      );
    });

    it('verify failed case when token is empty', async () => {
      const failurePayload = {
        message: 'FAILURE',
        status: 401,
      };
      const voiceMailPayload = <WebexRequestPayload>failurePayload;

      broadworksBackendConnector['bwtoken'] = '';
      webex.request.mockRejectedValue(voiceMailPayload);
      const response = await broadworksBackendConnector.init();

      expect(response.message).toBe('FAILURE');
      expect(response.statusCode).toBe(401);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 401,
        },
        {
          file: 'BroadworksBackendConnector',
          method: 'getUserId',
        }
      );
    });

    it('verify failed case when token is invalid', async () => {
      const failurePayload = {
        message: 'FAILURE',
        status: 401,
      };
      const voiceMailPayload = <WebexRequestPayload>failurePayload;

      broadworksBackendConnector['bwtoken'] = 'dummy';
      webex.request.mockRejectedValue(voiceMailPayload);
      const response = await broadworksBackendConnector.init();

      expect(response.message).toBe('FAILURE');
      expect(response.statusCode).toBe(401);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 401,
        },
        {
          file: 'BroadworksBackendConnector',
          method: 'getUserId',
        }
      );
    });

    it('verify no change in xsi url received without ep version', async () => {
      const voiceMailPayload = JSON.parse(JSON.stringify(mockBWRKSData));

      voiceMailPayload.body.devices[0].settings.broadworksXsiActionsUrl =
        voiceMailPayload.body.devices[0].settings.broadworksXsiActionsUrl.slice(0, -5);

      webex.request.mockResolvedValueOnce(broadworksTokenType);
      webex.request.mockResolvedValueOnce(voiceMailPayload);
      broadworksBackendConnector.xsiEndpoint = {};
      await broadworksBackendConnector.init();
      expect(broadworksBackendConnector.xsiEndpoint).toStrictEqual(
        voiceMailPayload.body.devices[0].settings.broadworksXsiActionsUrl
      );
    });
  });

  describe('Voicemail success tests for Broadworks', () => {
    beforeEach(() => {
      getSortedVoicemailListSpy = jest.spyOn(utils, 'getSortedVoicemailList');
      storeVoicemailListSpy = jest.spyOn(utils, 'storeVoicemailList');
      fetchVoicemailListSpy = jest.spyOn(utils, 'fetchVoicemailList');
    });

    const success = 'SUCCESS';
    const CONTEXT = 'context';

    beforeEach(async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve(getVoicemailListJsonBWRKS),
        })
      ) as jest.Mock;

      broadworksBackendConnector['bwtoken'] = bwToken;
      broadworksBackendConnector['context'] = CONTEXT;
      const voiceMailTokenPayload = <WebexRequestPayload>broadworksTokenType;

      webex.request.mockResolvedValueOnce(voiceMailTokenPayload);

      const voiceMailPayload = <WebexRequestPayload>mockBWRKSData;

      webex.request.mockResolvedValueOnce(voiceMailPayload);

      broadworksBackendConnector['xsiVoiceMessageURI'] = broadworksUserInfoUrl;
      broadworksBackendConnector.init();
    });

    it('verify successful voicemail listing in descending order with offset 0 and limit 20', async () => {
      const response = await broadworksBackendConnector.getVoicemailList(0, 20, SORT.DESC, true);

      const voicemailResponseInfo = {
        voicemailList:
          getDescVoicemailListJsonBWRKS.VoiceMessagingMessages.messageInfoList.messageInfo,
      };

      const responseDetails = {
        statusCode: NO_VOICEMAIL_STATUS_CODE,
        data: voicemailResponseInfo,
        message: NO_VOICEMAIL_MSG,
      };

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(NO_VOICEMAIL_MSG);
      expect(global.fetch).toBeCalledOnceWith(`${broadworksUserInfoUrl}${JSON_FORMAT}`, {
        headers: {Authorization: `bearer ${bwToken}`},
        method: 'GET',
      });
      expect(getSortedVoicemailListSpy).toBeCalledOnceWith(
        voicemailResponseInfo.voicemailList,
        'DESC'
      );
      expect(storeVoicemailListSpy).toBeCalledOnceWith(
        CONTEXT,
        voicemailResponseInfo.voicemailList
      );
      expect(fetchVoicemailListSpy).toBeCalledOnceWith(CONTEXT, 0, 20, {
        file: 'BroadworksBackendConnector',
        method: 'getVoicemailList',
      });
    });

    it('verify successful voicemail listing in ascending order with offset 0 and limit 20', async () => {
      const response = await broadworksBackendConnector.getVoicemailList(0, 20, SORT.ASC, true);

      const voicemailResponseInfo = {
        voicemailList:
          getAscVoicemailListJsonBWRKS.VoiceMessagingMessages.messageInfoList.messageInfo,
      };

      const responseDetails = {
        statusCode: NO_VOICEMAIL_STATUS_CODE,
        data: voicemailResponseInfo,
        message: NO_VOICEMAIL_MSG,
      };

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(NO_VOICEMAIL_MSG);
      expect(global.fetch).toBeCalledTimes(1);
      expect(global.fetch).toBeCalledWith(`${broadworksUserInfoUrl}${JSON_FORMAT}`, {
        headers: {Authorization: `bearer ${bwToken}`},
        method: 'GET',
      });
      expect(getSortedVoicemailListSpy).toBeCalledOnceWith(
        voicemailResponseInfo.voicemailList,
        'ASC'
      );
      expect(storeVoicemailListSpy).toBeCalledOnceWith(
        CONTEXT,
        voicemailResponseInfo.voicemailList
      );
      expect(fetchVoicemailListSpy).toBeCalledOnceWith(CONTEXT, 0, 20, {
        file: 'BroadworksBackendConnector',
        method: 'getVoicemailList',
      });
    });

    it('verify successful voicemail listing in descending order with offset 0 and limit 1 and invalid sort parameter', async () => {
      const response = await broadworksBackendConnector.getVoicemailList(
        0,
        1,
        'abcd' as unknown as SORT,
        true
      );

      const voicemailResponseInfo = {
        voicemailList:
          getDescVoicemailListJsonBWRKS.VoiceMessagingMessages.messageInfoList.messageInfo.slice(
            0,
            1
          ),
      };

      const responseDetails = {
        statusCode: 200,
        data: voicemailResponseInfo,
        message: success,
      };

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(success);
      expect(global.fetch).toBeCalledTimes(1);
      expect(global.fetch).toBeCalledWith(`${broadworksUserInfoUrl}${JSON_FORMAT}`, {
        headers: {Authorization: `bearer ${bwToken}`},
        method: 'GET',
      });
      expect(getSortedVoicemailListSpy).toBeCalledOnceWith(
        getDescVoicemailListJsonBWRKS.VoiceMessagingMessages.messageInfoList.messageInfo,
        'DESC'
      );
      expect(storeVoicemailListSpy).toBeCalledOnceWith(
        CONTEXT,
        getDescVoicemailListJsonBWRKS.VoiceMessagingMessages.messageInfoList.messageInfo
      );
      expect(fetchVoicemailListSpy).toBeCalledOnceWith(CONTEXT, 0, 1, {
        file: 'BroadworksBackendConnector',
        method: 'getVoicemailList',
      });
    });

    it('verify successful voicemail listing in ascending order with offset 0 and limit 3 without refresh', async () => {
      const vmEncodedList = Buffer.from(
        JSON.stringify(
          getAscVoicemailListJsonBWRKS.VoiceMessagingMessages.messageInfoList.messageInfo
        ),
        'utf8'
      ).toString('base64');

      sessionStorage.setItem(CONTEXT, vmEncodedList.toString());
      const response = await broadworksBackendConnector.getVoicemailList(0, 3, SORT.ASC, false);

      const voicemailResponseInfo = {
        voicemailList:
          getAscVoicemailListJsonBWRKS.VoiceMessagingMessages.messageInfoList.messageInfo.slice(
            0,
            3
          ),
      };

      const responseDetails = {
        statusCode: 200,
        data: voicemailResponseInfo,
        message: success,
      };

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(success);
      expect(global.fetch).not.toBeCalled();
      expect(getSortedVoicemailListSpy).not.toBeCalled();
      expect(storeVoicemailListSpy).not.toBeCalled();
      expect(fetchVoicemailListSpy).toBeCalledOnceWith(CONTEXT, 0, 3, {
        file: 'BroadworksBackendConnector',
        method: 'getVoicemailList',
      });
      sessionStorage.removeItem(CONTEXT);
    });

    it('verify successful voicemailMarkAsRead', async () => {
      const {messageId} = mockVoicemailBody.body.items[0];
      const responseDetails = {
        data: {},
        statusCode: 200,
      };

      const response = await broadworksBackendConnector.voicemailMarkAsRead(messageId.$);

      expect(response.message).toBe(success);
      expect(response.data).toStrictEqual(responseDetails.data);
      expect(global.fetch).toBeCalledTimes(1);
      expect(global.fetch).toBeCalledWith(
        `${broadworksUserInfoUrl}/${broadworksUserMessageId}/${MARK_AS_READ}`,
        {headers: {Authorization: `bearer ${bwToken}`}, method: 'PUT'}
      );
    });

    it('verify successful voicemailMarkAsUnread', async () => {
      const {messageId} = mockVoicemailBody.body.items[0];
      const responseDetails = {
        statusCode: 200,
        data: {},
      };

      const response = await broadworksBackendConnector.voicemailMarkAsUnread(messageId.$);

      expect(response.data).toStrictEqual(responseDetails.data);
      expect(response.message).toBe(success);
      expect(global.fetch).toBeCalledTimes(1);
      expect(global.fetch).toBeCalledWith(
        `${broadworksUserInfoUrl}/${broadworksUserMessageId}/${MARK_AS_UNREAD}`,
        {headers: {Authorization: `bearer ${bwToken}`}, method: 'PUT'}
      );
    });

    it('verify successful deleteVoicemail', async () => {
      const {messageId} = mockVoicemailBody.body.items[0];

      const response = await broadworksBackendConnector.deleteVoicemail(messageId.$);

      expect(response.data).toStrictEqual({});
      expect(response.message).toBe(success);
      expect(global.fetch).toBeCalledTimes(1);
      expect(global.fetch).toBeCalledWith(`${broadworksUserInfoUrl}/${broadworksUserMessageId}`, {
        headers: {Authorization: `bearer ${bwToken}`},
        method: 'DELETE',
      });
    });

    it('verify successfully fetching voicemail transcript for the provided messageId', async () => {
      const response = await broadworksBackendConnector.getVMTranscript(
        '98099432-9d81-4224-bd04-00def73cd262'
      );

      expect(response).toBeNull();
    });

    it('verify resolution of contact to null', async () => {
      const response = await broadworksBackendConnector.resolveContact({} as CallingPartyInfo);

      expect(response).toBeNull();
    });
  });
});
