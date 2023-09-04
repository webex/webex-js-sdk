/* eslint-disable dot-notation */
import {LOGGER} from '../Logger/types';
import {getSamplePeopleListResponse, getTestUtilsWebex} from '../common/testUtil';
import {SORT, WebexRequestPayload} from '../common/types';
import {CallingPartyInfo, IWxCallBackendConnector} from './types';
import {NO_VOICEMAIL_MSG, NO_VOICEMAIL_STATUS_CODE} from './constants';
import {
  getAscVoicemailListJsonWXC,
  getDescVoicemailListJsonWXC,
  getVoicemailListJsonWXC,
  mockVoicemailBody,
  mockWXCData,
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

  beforeAll(() => {
    wxCallBackendConnector = new WxCallBackendConnector(webex, {level: LOGGER.INFO});
    wxCallBackendConnector.init();
    wxCallBackendConnector['context'] = CONTEXT;
  });

  beforeEach(() => {
    getSortedVoicemailListSpy = jest.spyOn(utils, 'getSortedVoicemailList');
    storeVoicemailListSpy = jest.spyOn(utils, 'storeVoicemailList');
    fetchVoicemailListSpy = jest.spyOn(utils, 'fetchVoicemailList');
  });

  describe('Voicemail failure tests for webex call', () => {
    const failure = 'FAILURE';
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
        message: failure,
      };

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(failure);
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
      const {messageId} = mockVoicemailBody.body.items[0];
      const responseDetails = {
        statusCode: 400,
        data: {error: '400 Bad request'},
        message: failure,
      };

      const response = await wxCallBackendConnector.voicemailMarkAsRead(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(failure);
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
      const {messageId} = mockVoicemailBody.body.items[0];
      const responseDetails = {
        statusCode: 400,
        data: {error: '400 Bad request'},
        message: failure,
      };

      const response = await wxCallBackendConnector.voicemailMarkAsUnread(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(failure);
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

      const {messageId} = mockVoicemailBody.body.items[0];
      const responseDetails = {
        statusCode: 400,
        data: {error: '400 Bad request'},
        message: failure,
      };

      const response = await wxCallBackendConnector.deleteVoicemail(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(failure);
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

      const {messageId} = mockVoicemailBody.body.items[0];
      const responseDetails = {
        statusCode: 400,
        data: {error: '400 Bad request'},
        message: failure,
      };

      const response = await wxCallBackendConnector.getVMTranscript(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response?.message).toBe(failure);
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
        message: failure,
      };

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(failure);
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
      const {messageId} = mockVoicemailBody.body.items[0];
      const responseDetails = {
        statusCode: 401,
        data: {error: 'User is unauthorised, possible token expiry'},
        message: failure,
      };

      const response = await wxCallBackendConnector.voicemailMarkAsRead(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(failure);
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
      const {messageId} = mockVoicemailBody.body.items[0];
      const responseDetails = {
        statusCode: 401,
        data: {error: 'User is unauthorised, possible token expiry'},
        message: failure,
      };

      const response = await wxCallBackendConnector.voicemailMarkAsUnread(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(failure);
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

      const {messageId} = mockVoicemailBody.body.items[0];
      const responseDetails = {
        statusCode: 401,
        data: {error: 'User is unauthorised, possible token expiry'},
        message: failure,
      };

      const response = await wxCallBackendConnector.deleteVoicemail(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response.message).toBe(failure);
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

      const {messageId} = mockVoicemailBody.body.items[0];
      const responseDetails = {
        statusCode: 401,
        data: {error: 'User is unauthorised, possible token expiry'},
        message: failure,
      };

      const response = await wxCallBackendConnector.getVMTranscript(messageId.$);

      expect(response).toStrictEqual(responseDetails);
      expect(response?.message).toBe(failure);
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
  });

  describe('Voicemail success tests for webex call', () => {
    const success = 'SUCCESS';
    const EMPTY_SUCCESS_RESPONSE = {
      data: {},
      message: success,
      statusCode: 200,
    };

    it('verify successfully fetching voicemail transcript', async () => {
      // cSpell:disable
      const mockRawRequest = {
        response:
          '<?xml version="1.0" encoding="UTF-8"?><VoiceMessageTranscript xmlns="http://schema.broadsoft.com/xsi"><status>READY</status><content lang="EN">Hi, uh, testing, voice mail script, so dropping this message to be able to fetch it later.</content></VoiceMessageTranscript>',
      } as unknown as XMLHttpRequest;

      const mockVoicemailTranscript = {
        body: '<?xml version="1.0" encoding="UTF-8"?>\n<VoiceMessageTranscript xmlns="http://schema.broadsoft.com/xsi"><status>READY</status><content lang="EN">Hi, uh, testing, voice mail script, so dropping this message to be able to fetch it later.</content></VoiceMessageTranscript>',
        statusCode: 200,
        method: 'GET',
        headers: {
          'cache-control': 'no-cache, no-store',
          connection: 'keep-alive',
          'content-language': 'en-US',
          'content-type': 'application/xml;charset=UTF-8',
          date: 'Wed, 08 Feb 2023 17:58:19 GMT',
          expires: 'Thu, 01 Jan 1970 00:00:00 GMT',
          'keep-alive': 'timeout=4',
          pragma: 'no-cache',
          'strict-transport-security': 'max-age=16070400; includeSubDomains',
          trackingid: 'webex-js-sdk_f723f33d-e48b-4f00-94df-e3996bb9fbd1_13',
          'transfer-encoding': 'chunked',
          'x-content-type-options': 'nosniff',
          'x-frame-options': 'SAMEORIGIN',
          'x-xss-protection': '1; mode=block',
        },
        url: 'https://api-proxy-si.broadcloudpbx.net/com.broadsoft.xsi-actions/v2.0/user/bd8d7e70-7f28-49e5-b6c2-dfca281a5f64/VoiceMessagingMessages/98099432-9d81-4224-bd04-00def73cd262/transcript',
        rawRequest: mockRawRequest,
        options: {
          uri: 'https://api-proxy-si.broadcloudpbx.net/com.broadsoft.xsi-actions/v2.0/user/bd8d7e70-7f28-49e5-b6c2-dfca281a5f64/VoiceMessagingMessages/98099432-9d81-4224-bd04-00def73cd262/transcript',
          method: 'GET',
          json: true,
          headers: {
            trackingid: 'webex-js-sdk_f723f33d-e48b-4f00-94df-e3996bb9fbd1_13',
            'spark-user-agent': 'webex/2.38.0 (web)',
            authorization:
              'Bearer eyJhbGciOiJSUzI1NiJ9.eyJjbHVzdGVyIjoiQTUyRCIsInByaXZhdGUiOiJleUpqZEhraU9pSktWMVFpTENKbGJtTWlPaUpCTVRJNFEwSkRMVWhUTWpVMklpd2lZV3huSWpvaVpHbHlJbjAuLlY3N2dUMmdwSE9TV0w5b1ptbDJTT2cuUW1ZNWZEUUN6eFo2ZFBwaGFqa0dBbkVUcGxKQmI3WlR5V0hZSUd3NGpvbUNucjZDdmZDYlpSdGU5RUl2UlM5VDUxZXZpMURzamtNMWhrcWw3a1U2QU5NSEw1YjhLQ0RSS1d5Rk0yeUdPSWktekpzN2F4MGhvak9Td3o2cEt6LXJWenV5N0YtZ19mRkwydDFBcmw3U3lzWG40UUxBb2NpZzNnZGhlYkQ2eXl3cHJFOGpFLXc1SGFYb01ZanNfWUtTZ3lNQjBVYkVvcFloZWhCc2lkNDhOUGZDVUxWOU5rZnlBYl9uTFNqRDdsb0o5ZVRRR0JHMWxKSTR2NXNmX0RTUGVTRUZfdG15aFo1WWJuS19ZQ1I5M0VIazBKM1JVY19QX2dXeEJXaTM3dDlyWUJZOWRmU1RwUFQyUTNvb09yVm5vNEQ2c3BCYzEyVWN6Rkh2Q1YzV1ZmTE5YOUQtcnJjNFp1QWVDT3UxdnFfRjlRdkFEa0x2Tmdsb0QwVHU2NExmVWxJcE5Wck9xam5DSDdVdVN4anlDLVlYd2MyRVo3MkREcjVLWHg4eEdaSGVzaTFHcEo3cml0OVl2cERDX3pyQmNMbmZTV1M2a1c0WlhpR1o0SDhQQ0liaFZfY3ZzTzBqV05QeU90dHV4eFhBUllINEY1VXNFOUphdzc5SDlYMzZGRGlkMzV2VG53TWpQMG81Ri1JeVNPeHBQekZybGh0ZTRLUGNFQ0pTeGRDbjNKWndmTkQ4aUNwWGxseDhiQ25DSVR3TlNWamJuTVQ0cENWYW1rSGU1aW1kNkZYMllUUVpqVFhBV25sZURBdXVlMHM1cTM1Qkt1WXk5eGZhZ0dRN3dkMmREMXRnbmVuYnJoYVZkUzktamRzYkF1SHFEVXJFcm05emQ4VE1ObXBvU3N6VmhjeWxraHJwbFZWRXRUX3IxeDdZZ3RsajBUbENTTE5pRlQxYTItYU5XZ3dQVzIwTzZIVG5TMlJuX0xxaVFsVzBsdVptTzRPZ2dGQmRUTHh0WEhsOWNJSGljXzZ3MlkxeEpzcHpEUFZfVmxqVlRrMnlta0VyejdtNDJmYnhRdXhSbVA0ZnQzTEF3N2xBamc4Ti4yUkRFRTZ1WHhCYnYwWXMwODR5YXJ3IiwidXNlcl90eXBlIjoidXNlciIsInRva2VuX2lkIjoiQWFaM3IwWTJNMU9UTXdNR0l0TldJMk1pMDBaRGd5TFRnMU1EZ3RPR1E0WVdVeFl6WXpNamc0T1RaaU1UZzVZbU10TlRsbCIsInJlZmVyZW5jZV9pZCI6ImFhN2UyODg2LTM3YWMtNGFiYy1iNWI2LWYzYzdjMWJlOGYwYSIsImlzcyI6Imh0dHBzOlwvXC9pZGJyb2tlcmJ0cy53ZWJleC5jb21cL2lkYiIsInVzZXJfbW9kaWZ5X3RpbWVzdGFtcCI6IjIwMjIxMTIzMDgyODU3LjIxM1oiLCJyZWFsbSI6IjE3MDRkMzBkLWExMzEtNGJjNy05NDQ5LTk0ODQ4NzY0Mzc5MyIsImNpc191dWlkIjoiYmQ4ZDdlNzAtN2YyOC00OWU1LWI2YzItZGZjYTI4MWE1ZjY0IiwidG9rZW5fdHlwZSI6IkJlYXJlciIsImV4cGlyeV90aW1lIjoxNjc1OTQzNTgwODc1LCJjbGllbnRfaWQiOiJDNjRhYjA0NjM5ZWVmZWU0Nzk4ZjU4ZTdiYzNmZTAxZDQ3MTYxYmUwZDk3ZmYwZDMxZTA0MGE2ZmZlNjZkN2YwYSJ9.DKV6GnBZLHT5sDV8eJC5rr31WWvFz8kx27AInICi-2liGW9cRoDDBGESD96dctAD5vN9_KBJm5hQAy5WeiDJyoGnwYhTQLPRwXsCEnp04ChfRDypxgPriT3CkfuSegKH9H9XNn_FaP7GT5CdUa6gxQPu2GEw1iHD-VPm6hH1xTIyKkr8IB2svYdtaeZGuQy3gqemuAiwrJv56SCJ2Xr2Z9tWRzkGyxYXLeXaKHM6zYWmFeBbxMAo95vrLK7LGPjR-fWTAWnjwJrMlIhOBwtmdbak6War1Z0xIiDXKyJsvcAcyAUyaklWt6F9pg7yeZtB0FypvtRzVb7wa70tQHIodQ',
            'cisco-no-http-redirect': true,
          },
          $timings: {
            requestStart: 1675879099125,
            networkStart: 1675879099141,
            networkEnd: 1675879100572,
            requestEnd: 1675879100573,
          },
          $redirectCount: 0,
        },
      };
      /* cSpell:enable */

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
        message: success,
        statusCode: 200,
      };

      expect(response?.message).toBe(success);
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
        message: success,
        statusCode: 200,
      };

      expect(response.message).toBe(success);
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
        message: success,
        statusCode: 200,
      };

      expect(response.message).toBe(success);
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
        message: success,
        statusCode: 200,
      };

      expect(response.message).toBe(success);
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
      const {messageId} = mockVoicemailBody.body.items[0];

      const response = await wxCallBackendConnector.voicemailMarkAsRead(messageId.$);

      expect(response).toStrictEqual(EMPTY_SUCCESS_RESPONSE);
    });

    it('verify successful voicemailMarkAsUnread', async () => {
      const voiceMailPayload = <WebexRequestPayload>getVoicemailListJsonWXC;

      webex.request.mockResolvedValueOnce(voiceMailPayload);
      const {messageId} = mockVoicemailBody.body.items[0];

      const response = await wxCallBackendConnector.voicemailMarkAsUnread(messageId.$);

      expect(response).toStrictEqual(EMPTY_SUCCESS_RESPONSE);
    });

    it('verify successful deleteVoicemail', async () => {
      const voiceMailPayload = <WebexRequestPayload>getVoicemailListJsonWXC;

      webex.request.mockResolvedValueOnce(voiceMailPayload);
      const {messageId} = mockVoicemailBody.body.items[0];
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
