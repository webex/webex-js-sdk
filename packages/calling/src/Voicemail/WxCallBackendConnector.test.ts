/* eslint-disable dot-notation */
import {LOGGER} from '../Logger/types';
import {getSamplePeopleListResponse, getTestUtilsWebex} from '../common/testUtil';
import {HTTP_METHODS, SORT, WebexRequestPayload} from '../common/types';
import {CallingPartyInfo, IWxCallBackendConnector} from './types';
import {NO_VOICEMAIL_MSG, NO_VOICEMAIL_STATUS_CODE} from './constants';
import {
  getAscVoicemailListJsonWXC,
  getDescVoicemailListJsonWXC,
  getEmptyVoicemailListJsonWxC,
  getInvalidVoicemailListJsonWxC,
  getVoicemailListJsonWXC,
  mockVoicemailBody,
  mockVoicemailTranscriptResponse,
  mockWXCData,
  responseDetails422,
  voicemailSummaryUrl,
} from './voicemailFixture';
import {WxCallBackendConnector} from './WxCallBackendConnector';
import * as utils from '../common/Utils';

describe('Voicemail webex call Backend Connector Test case', () => {
  let wxCallBackendConnector: IWxCallBackendConnector;
  const webex = getTestUtilsWebex();
  const CONTEXT = 'context';
  let getSortedVoicemailListSpy: jest.SpyInstance;
  let storeVoicemailListSpy: jest.SpyInstance;
  let fetchVoicemailListSpy: jest.SpyInstance;
  const {messageId} = mockVoicemailBody.body.items[0];

  beforeAll(() => {
    wxCallBackendConnector = new WxCallBackendConnector(webex, {level: LOGGER.INFO});
    wxCallBackendConnector.init();
    wxCallBackendConnector['context'] = CONTEXT;
    wxCallBackendConnector.getSDKConnector();
  });

  beforeEach(() => {
    getSortedVoicemailListSpy = jest.spyOn(utils, 'getSortedVoicemailList');
    storeVoicemailListSpy = jest.spyOn(utils, 'storeVoicemailList');
    fetchVoicemailListSpy = jest.spyOn(utils, 'fetchVoicemailList');
  });

  describe('Voicemail failure tests for webex call', () => {
    const FAILURE = 'FAILURE';
    let serviceErrorCodeHandlerSpy: jest.SpyInstance;

    beforeAll(() => {
      const voiceMailPayload = <WebexRequestPayload>mockWXCData;

      webex.request.mockResolvedValueOnce(voiceMailPayload);

      wxCallBackendConnector.init();
    });

    beforeEach(() => {
      serviceErrorCodeHandlerSpy = jest.spyOn(utils, 'serviceErrorCodeHandler');
    });

    afterEach(() => {
      expect(getSortedVoicemailListSpy).not.toBeCalled();
      expect(storeVoicemailListSpy).not.toBeCalled();
      expect(fetchVoicemailListSpy).not.toBeCalled();
    });

    it('verify failure voicemail listing when bad request occur', async () => {
      const failurePayload = {
        statusCode: 400,
      };

      webex.request.mockRejectedValueOnce(failurePayload);
      const response = await wxCallBackendConnector.getVoicemailList(0, 20, SORT.DESC, true);

      const responseDetails = {
        statusCode: 400,
        data: {error: '400 Bad request'},
        message: FAILURE,
      };

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(FAILURE);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 400,
        },
        {
          file: 'WxCallBackendConnector',
          method: 'getVoicemailList',
        }
      );
    });

    it('verify failure voicemailMarkAsRead when bad request occur', async () => {
      const failurePayload = {
        statusCode: 400,
      };

      webex.request.mockRejectedValue(failurePayload);
      const responseDetails = {
        statusCode: 400,
        data: {error: '400 Bad request'},
        message: FAILURE,
      };

      const response = await wxCallBackendConnector.voicemailMarkAsRead(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(FAILURE);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 400,
        },
        {
          file: 'WxCallBackendConnector',
          method: 'voicemailMarkAsRead',
        }
      );
    });

    it('verify failure voicemailMarkAsUnread when bad request occur', async () => {
      const failurePayload = {
        statusCode: 400,
      };

      webex.request.mockRejectedValue(failurePayload);
      const responseDetails = {
        statusCode: 400,
        data: {error: '400 Bad request'},
        message: FAILURE,
      };

      const response = await wxCallBackendConnector.voicemailMarkAsUnread(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(FAILURE);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 400,
        },
        {
          file: 'WxCallBackendConnector',
          method: 'voicemailMarkAsUnread',
        }
      );
    });

    it('verify failure delete Voicemail when bad request occur', async () => {
      const failurePayload = {
        statusCode: 400,
      };

      webex.request.mockRejectedValue(failurePayload);

      const responseDetails = {
        statusCode: 400,
        data: {error: '400 Bad request'},
        message: FAILURE,
      };

      const response = await wxCallBackendConnector.deleteVoicemail(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(FAILURE);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 400,
        },
        {
          file: 'WxCallBackendConnector',
          method: 'deleteVoicemail',
        }
      );
    });

    it('verify failure for get transcript when bad request occur', async () => {
      const failurePayload = {
        statusCode: 400,
      };

      webex.request.mockRejectedValue(failurePayload);

      const responseDetails = {
        statusCode: 400,
        data: {error: '400 Bad request'},
        message: FAILURE,
      };

      const response = await wxCallBackendConnector.getVMTranscript(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response?.message).toBe(FAILURE);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 400,
        },
        {
          file: 'WxCallBackendConnector',
          method: 'getVMTranscript',
        }
      );
    });

    it('verify failure voicemail listing when user is unauthorised, possible token expiry', async () => {
      const failurePayload = {
        statusCode: 401,
      };

      webex.request.mockRejectedValue(failurePayload);
      const response = await wxCallBackendConnector.getVoicemailList(0, 20, SORT.DESC, true);

      const responseDetails = {
        statusCode: 401,
        data: {error: 'User is unauthorised, possible token expiry'},
        message: FAILURE,
      };

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(FAILURE);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 401,
        },
        {
          file: 'WxCallBackendConnector',
          method: 'getVoicemailList',
        }
      );
    });

    it('verify failure voicemailMarkAsRead when user is unauthorised, possible token expiry', async () => {
      const failurePayload = {
        statusCode: 401,
      };

      webex.request.mockRejectedValue(failurePayload);
      const responseDetails = {
        statusCode: 401,
        data: {error: 'User is unauthorised, possible token expiry'},
        message: FAILURE,
      };

      const response = await wxCallBackendConnector.voicemailMarkAsRead(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(FAILURE);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 401,
        },
        {
          file: 'WxCallBackendConnector',
          method: 'voicemailMarkAsRead',
        }
      );
    });

    it('verify failure voicemailMarkAsUnread when user is unauthorised, possible token expiry', async () => {
      const failurePayload = {
        statusCode: 401,
      };

      webex.request.mockRejectedValue(failurePayload);
      const responseDetails = {
        statusCode: 401,
        data: {error: 'User is unauthorised, possible token expiry'},
        message: FAILURE,
      };

      const response = await wxCallBackendConnector.voicemailMarkAsUnread(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(FAILURE);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 401,
        },
        {
          file: 'WxCallBackendConnector',
          method: 'voicemailMarkAsUnread',
        }
      );
    });

    it('verify failure delete Voicemail when user is unauthorised, possible token expiry', async () => {
      const failurePayload = {
        statusCode: 401,
      };

      webex.request.mockRejectedValue(failurePayload);

      const responseDetails = {
        statusCode: 401,
        data: {error: 'User is unauthorised, possible token expiry'},
        message: FAILURE,
      };

      const response = await wxCallBackendConnector.deleteVoicemail(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(FAILURE);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 401,
        },
        {
          file: 'WxCallBackendConnector',
          method: 'deleteVoicemail',
        }
      );
    });

    it('verify failure for get transcript when user is unauthorised, possible token expiry', async () => {
      const failurePayload = {
        statusCode: 401,
      };

      webex.request.mockRejectedValue(failurePayload);

      const responseDetails = {
        statusCode: 401,
        data: {error: 'User is unauthorised, possible token expiry'},
        message: FAILURE,
      };

      const response = await wxCallBackendConnector.getVMTranscript(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response?.message).toBe(FAILURE);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 401,
        },
        {
          file: 'WxCallBackendConnector',
          method: 'getVMTranscript',
        }
      );
    });

    it('verify failure voicemail summary when bad request occur', async () => {
      const failurePayload = {
        statusCode: 400,
      };

      webex.request.mockRejectedValueOnce(failurePayload);
      const response = await wxCallBackendConnector.getVoicemailSummary();

      const responseDetails = {
        statusCode: 400,
        data: {error: '400 Bad request'},
        message: FAILURE,
      };

      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: voicemailSummaryUrl,
      });

      expect(response).toStrictEqual(responseDetails);
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
        {
          statusCode: 400,
        },
        {
          file: 'WxCallBackendConnector',
          method: 'getVoicemailSummary',
        }
      );
    });

    it('verify failure case for the voicemail content when api response is invalid', async () => {
      webex.request.mockResolvedValueOnce({});
      const xsiActionsEndpointUrl = mockWXCData.body.items[0].xsiActionsEndpoint;
      const response = await wxCallBackendConnector.getVoicemailContent(messageId);

      expect(response).toStrictEqual(responseDetails422);
      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: `${xsiActionsEndpointUrl}${messageId}`,
      });
      expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(expect.anything(), {
        file: 'WxCallBackendConnector',
        method: 'getVoicemailContent',
      });
    });
  });

  describe('Voicemail success tests for webex call', () => {
    const SUCCESS = 'SUCCESS';
    const EMPTY_SUCCESS_RESPONSE = {
      data: {},
      message: SUCCESS,
      statusCode: 200,
    };

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('verify successfully fetching voicemail summary with newMessages and newUrgentMessage', async () => {
      const mockRawRequest = {
        response: `<?xml version="1.0" encoding="UTF-8"?><VoiceMailMessageSummary xmlns="http://schema.broadsoft.com/xsi"><summary><newMessages>2</newMessages><newUrgentMessages>1</newUrgentMessages></summary></VoiceMailMessageSummary>`,
      } as XMLHttpRequest;

      const mockVoicemailSummary = {
        statusCode: 200,
        rawRequest: mockRawRequest,
      };

      const voicemailSummary = <WebexRequestPayload>(<unknown>mockVoicemailSummary);

      webex.request.mockResolvedValueOnce(voicemailSummary);

      const response = await wxCallBackendConnector.getVoicemailSummary();

      const voicemailSummaryResponseInfo = {
        voicemailSummary: {
          newMessages: 2,
          newUrgentMessages: 1,
          oldMessages: 0,
          oldUrgentMessages: 0,
        },
      };

      const responseDetails = {
        data: voicemailSummaryResponseInfo,
        message: SUCCESS,
        statusCode: 200,
      };

      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: voicemailSummaryUrl,
      });
      expect(response).toStrictEqual(responseDetails);
    });

    it('verify successfully fetching voicemail summary with oldMessages and oldUrgentMessage', async () => {
      const mockRawRequest = {
        response: `<?xml version="1.0" encoding="UTF-8"?><VoiceMailMessageSummary xmlns="http://schema.broadsoft.com/xsi"><summary><oldMessages>2</oldMessages><oldUrgentMessages>1</oldUrgentMessages></summary></VoiceMailMessageSummary>`,
      } as XMLHttpRequest;

      const mockVoicemailSummary = {
        statusCode: 200,
        rawRequest: mockRawRequest,
      };

      const voicemailSummary = <WebexRequestPayload>(<unknown>mockVoicemailSummary);

      webex.request.mockResolvedValueOnce(voicemailSummary);

      const response = await wxCallBackendConnector.getVoicemailSummary();

      const voicemailSummaryResponseInfo = {
        voicemailSummary: {
          newMessages: 0,
          newUrgentMessages: 0,
          oldMessages: 2,
          oldUrgentMessages: 1,
        },
      };

      const responseDetails = {
        data: voicemailSummaryResponseInfo,
        message: SUCCESS,
        statusCode: 200,
      };

      expect(webex.request).toBeCalledOnceWith({
        method: HTTP_METHODS.GET,
        uri: voicemailSummaryUrl,
      });
      expect(response).toStrictEqual(responseDetails);
    });

    it('verify that PENDING transcription status is passed while transcribing is in progress in the backend', async () => {
      const pending = 'PENDING';
      const mockPendingResponse = {
        response:
          '<?xml version="1.0" encoding="UTF-8"?><VoiceMessageTranscript xmlns="http://schema.broadsoft.com/xsi"><status>PENDING</status></VoiceMessageTranscript>',
      } as unknown as XMLHttpRequest;

      const mockVoicemailTranscript = {
        ...mockVoicemailTranscriptResponse,
        rawRequest: mockPendingResponse,
      };

      const voicemailTranscript = <WebexRequestPayload>(<unknown>mockVoicemailTranscript);

      webex.request.mockResolvedValueOnce(voicemailTranscript);
      const response = await wxCallBackendConnector.getVMTranscript(
        '98099432-9d81-4224-bd04-00def73cd262'
      );

      const responseDetails = {
        data: {voicemailTranscript: undefined},
        message: pending,
        statusCode: 200,
      };

      expect(response?.message).toBe(pending);
      expect(response).toStrictEqual(responseDetails);
    });

    it('verify successfully fetching voicemail transcript', async () => {
      const ready = 'READY';
      const mockRawRequest = {
        response:
          '<?xml version="1.0" encoding="UTF-8"?><VoiceMessageTranscript xmlns="http://schema.broadsoft.com/xsi"><status>READY</status><content lang="EN">Hi, uh, testing, voice mail script, so dropping this message to be able to fetch it later.</content></VoiceMessageTranscript>',
      } as unknown as XMLHttpRequest;

      const mockVoicemailTranscript = {
        ...mockVoicemailTranscriptResponse,
        rawRequest: mockRawRequest,
      };

      const voicemailTranscript = <WebexRequestPayload>(<unknown>mockVoicemailTranscript);

      webex.request.mockResolvedValueOnce(voicemailTranscript);
      const response = await wxCallBackendConnector.getVMTranscript(
        '98099432-9d81-4224-bd04-00def73cd262'
      );

      const voicemailResponseInfo = {
        voicemailTranscript:
          'Hi, uh, testing, voice mail script, so dropping this message to be able to fetch it later.',
      };

      const responseDetails = {
        data: voicemailResponseInfo,
        message: ready,
        statusCode: 200,
      };

      expect(response?.message).toBe(ready);
      expect(response).toStrictEqual(responseDetails);
    });

    it('verify successful voicemail listing in descending order with offset 0 and limit 20', async () => {
      const voiceMailPayload = <WebexRequestPayload>getVoicemailListJsonWXC;

      webex.request.mockResolvedValueOnce(voiceMailPayload);
      const response = await wxCallBackendConnector.getVoicemailList(0, 20, SORT.DESC, true);

      const voicemailResponseInfo = {
        voicemailList:
          getDescVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo,
      };

      const responseDetails = {
        data: voicemailResponseInfo,
        message: NO_VOICEMAIL_MSG,
        statusCode: NO_VOICEMAIL_STATUS_CODE,
      };

      expect(response.message).toBe(NO_VOICEMAIL_MSG);
      expect(response).toStrictEqual(responseDetails);
      expect(getSortedVoicemailListSpy).toBeCalledOnceWith(
        voicemailResponseInfo.voicemailList,
        'DESC'
      );
      expect(storeVoicemailListSpy).toBeCalledOnceWith(
        CONTEXT,
        voicemailResponseInfo.voicemailList
      );
      expect(fetchVoicemailListSpy).toBeCalledOnceWith(CONTEXT, 0, 20, {
        file: 'WxCallBackendConnector',
        method: 'getVoicemailList',
      });
    });

    it('verify successful voicemail listing in ascending order with offset 0 and limit 20', async () => {
      const voiceMailPayload = <WebexRequestPayload>getVoicemailListJsonWXC;

      webex.request.mockResolvedValueOnce(voiceMailPayload);
      const response = await wxCallBackendConnector.getVoicemailList(0, 20, SORT.ASC, true);

      const voicemailResponseInfo = {
        voicemailList:
          getAscVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo,
      };

      const responseDetails = {
        data: voicemailResponseInfo,
        message: NO_VOICEMAIL_MSG,
        statusCode: NO_VOICEMAIL_STATUS_CODE,
      };

      expect(response.message).toBe(NO_VOICEMAIL_MSG);
      expect(response).toStrictEqual(responseDetails);
      expect(getSortedVoicemailListSpy).toBeCalledOnceWith(
        voicemailResponseInfo.voicemailList,
        'ASC'
      );
      expect(storeVoicemailListSpy).toBeCalledOnceWith(
        CONTEXT,
        voicemailResponseInfo.voicemailList
      );
      expect(fetchVoicemailListSpy).toBeCalledOnceWith(CONTEXT, 0, 20, {
        file: 'WxCallBackendConnector',
        method: 'getVoicemailList',
      });
    });

    it('verify successful voicemail listing in descending order with offset 0 and limit 2 with incorrect SORT param', async () => {
      const voiceMailPayload = <WebexRequestPayload>getVoicemailListJsonWXC;

      webex.request.mockResolvedValueOnce(voiceMailPayload);
      const response = await wxCallBackendConnector.getVoicemailList(
        0,
        2,
        'abcd' as unknown as SORT,
        true
      );

      const voicemailResponseInfo = {
        voicemailList:
          getDescVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo.slice(
            0,
            2
          ),
      };

      const responseDetails = {
        data: voicemailResponseInfo,
        message: SUCCESS,
        statusCode: 200,
      };

      expect(response.message).toBe(SUCCESS);
      expect(response).toStrictEqual(responseDetails);
      expect(getSortedVoicemailListSpy).toBeCalledOnceWith(
        getDescVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo,
        'DESC'
      );
      expect(storeVoicemailListSpy).toBeCalledOnceWith(
        CONTEXT,
        getDescVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo
      );
      expect(fetchVoicemailListSpy).toBeCalledOnceWith(CONTEXT, 0, 2, {
        file: 'WxCallBackendConnector',
        method: 'getVoicemailList',
      });
    });

    it('verify successful voicemail listing in ascending order with offset 0 and limit 4', async () => {
      const voiceMailPayload = <WebexRequestPayload>getVoicemailListJsonWXC;

      webex.request.mockResolvedValueOnce(voiceMailPayload);
      const response = await wxCallBackendConnector.getVoicemailList(0, 4, SORT.ASC, true);

      const voicemailResponseInfo = {
        voicemailList:
          getAscVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo.slice(
            0,
            4
          ),
      };

      const responseDetails = {
        data: voicemailResponseInfo,
        message: SUCCESS,
        statusCode: 200,
      };

      expect(response.message).toBe(SUCCESS);
      expect(response).toStrictEqual(responseDetails);
      expect(getSortedVoicemailListSpy).toBeCalledOnceWith(
        getAscVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo,
        'ASC'
      );
      expect(storeVoicemailListSpy).toBeCalledOnceWith(
        CONTEXT,
        getAscVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo
      );
      expect(fetchVoicemailListSpy).toBeCalledOnceWith(CONTEXT, 0, 4, {
        file: 'WxCallBackendConnector',
        method: 'getVoicemailList',
      });
    });

    it('verify empty voicemail list data', async () => {
      webex.request.mockResolvedValueOnce(getEmptyVoicemailListJsonWxC);

      const response = await wxCallBackendConnector.getVoicemailList(0, 20, SORT.DESC, true);

      const voicemailResponseInfo = {
        voicemailList: [],
      };

      const responseDetails = {
        data: voicemailResponseInfo,
        message: NO_VOICEMAIL_MSG,
        statusCode: NO_VOICEMAIL_STATUS_CODE,
      };

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(NO_VOICEMAIL_MSG);
      expect(storeVoicemailListSpy).toBeCalledOnceWith(
        CONTEXT,
        voicemailResponseInfo.voicemailList
      );
      expect(fetchVoicemailListSpy).toBeCalledOnceWith(CONTEXT, 0, 20, {
        file: 'WxCallBackendConnector',
        method: 'getVoicemailList',
      });
    });

    it('verify empty voicemail list data when response data is in invalid format', async () => {
      webex.request.mockResolvedValueOnce(getInvalidVoicemailListJsonWxC);

      const response = await wxCallBackendConnector.getVoicemailList(0, 20, SORT.DESC, true);

      const voicemailResponseInfo = {
        voicemailList: [{}],
      };

      const responseDetails = {
        data: voicemailResponseInfo,
        message: NO_VOICEMAIL_MSG,
        statusCode: NO_VOICEMAIL_STATUS_CODE,
      };

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(NO_VOICEMAIL_MSG);
      expect(storeVoicemailListSpy).toBeCalledOnceWith(
        CONTEXT,
        voicemailResponseInfo.voicemailList
      );
      expect(fetchVoicemailListSpy).toBeCalledOnceWith(CONTEXT, 0, 20, {
        file: 'WxCallBackendConnector',
        method: 'getVoicemailList',
      });
    });

    it('verify successful fetching of voicemail list without refresh', async () => {
      const voiceMailPayload = <WebexRequestPayload>getVoicemailListJsonWXC;

      webex.request.mockResolvedValueOnce(voiceMailPayload);
      const vmEncodedList = Buffer.from(
        JSON.stringify(
          getAscVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo
        ),
        'utf8'
      ).toString('base64');

      sessionStorage.setItem(CONTEXT, vmEncodedList.toString());
      const response = await wxCallBackendConnector.getVoicemailList(0, 4, SORT.ASC, false);

      const voicemailResponseInfo = {
        voicemailList:
          getAscVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo.slice(
            0,
            4
          ),
      };

      const responseDetails = {
        data: voicemailResponseInfo,
        message: SUCCESS,
        statusCode: 200,
      };

      expect(response.message).toBe(SUCCESS);
      expect(response).toStrictEqual(responseDetails);
      expect(getSortedVoicemailListSpy).not.toBeCalled();
      expect(storeVoicemailListSpy).not.toBeCalled();
      expect(fetchVoicemailListSpy).toBeCalledOnceWith(CONTEXT, 0, 4, {
        file: 'WxCallBackendConnector',
        method: 'getVoicemailList',
      });
      sessionStorage.removeItem(CONTEXT);
    });

    it('verify successful voicemailMarkAsRead', async () => {
      const voiceMailPayload = <WebexRequestPayload>getVoicemailListJsonWXC;

      webex.request.mockResolvedValueOnce(voiceMailPayload);

      const response = await wxCallBackendConnector.voicemailMarkAsRead(messageId.$);

      expect(response).toStrictEqual(EMPTY_SUCCESS_RESPONSE);
    });

    it('verify successful voicemailMarkAsUnread', async () => {
      const voiceMailPayload = <WebexRequestPayload>getVoicemailListJsonWXC;

      webex.request.mockResolvedValueOnce(voiceMailPayload);

      const response = await wxCallBackendConnector.voicemailMarkAsUnread(messageId.$);

      expect(response).toStrictEqual(EMPTY_SUCCESS_RESPONSE);
    });

    it('verify successful deleteVoicemail', async () => {
      const voiceMailPayload = <WebexRequestPayload>getVoicemailListJsonWXC;

      webex.request.mockResolvedValueOnce(voiceMailPayload);
      const response = await wxCallBackendConnector.deleteVoicemail(messageId.$);

      expect(response).toStrictEqual(EMPTY_SUCCESS_RESPONSE);
    });

    it('verify resolveContact', async () => {
      const voiceMailPayload = <WebexRequestPayload>getVoicemailListJsonWXC;

      webex.request.mockResolvedValueOnce(voiceMailPayload);
      const samplePeopleListResponse = getSamplePeopleListResponse();

      webex.people.list.mockResolvedValue(samplePeopleListResponse);
      const displayInfo = await wxCallBackendConnector.resolveContact({
        name: {$: 'Name'},
      } as CallingPartyInfo);

      expect(displayInfo?.id).toStrictEqual(
        Buffer.from(samplePeopleListResponse.items[0].id, 'base64')
          .toString('binary')
          .split('/')
          .pop()
      );
      expect(displayInfo?.name).toStrictEqual(samplePeopleListResponse.items[0].displayName);
      expect(displayInfo?.num).toStrictEqual(
        samplePeopleListResponse.items[0].phoneNumbers[0].value
      );
      expect(displayInfo?.avatarSrc).toStrictEqual(samplePeopleListResponse.items[0].avatar);
    });
  });
});
