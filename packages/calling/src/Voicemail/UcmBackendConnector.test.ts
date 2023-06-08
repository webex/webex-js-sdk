/* eslint-disable dot-notation */
import {LOGGER} from '../Logger/types';
import {getTestUtilsWebex} from '../common/testUtil';
import {HTTP_METHODS, SORT, WebexRequestPayload} from '../common/types';
import {
  getDescVoiceMailListJsonUCM,
  getVoiceMailListJsonUCM,
  mockUCMVoicemailBody,
  orgId,
  ucmBackendInfoUrl,
  voicemailContent,
} from './voicemailFixture';
import {UcmBackendConnector} from './UcmBackendConnector';
import * as utils from '../common/Utils';
import {FAILURE_MESSAGE, SUCCESS_MESSAGE} from '../common/constants';

let ucmBackendConnector: UcmBackendConnector;
const webex = getTestUtilsWebex();
let voicemailPayload: WebexRequestPayload;
let serviceErrorCodeHandlerSpy: jest.SpyInstance;

describe('Voicemail UCM Backend Connector Test case', () => {
  const responseDetails = {
    statusCode: 200,
    message: SUCCESS_MESSAGE,
    data: {},
  };

  const voicemailResponseInfo = getDescVoiceMailListJsonUCM.body.Message;
  const listResponseDetails = {
    statusCode: 200,
    data: voicemailResponseInfo,
    message: SUCCESS_MESSAGE,
  };
  const messageId = mockUCMVoicemailBody.body.items['MsgId'];

  beforeAll(() => {
    webex.version = '2.31.1';
    webex.internal.device.version = '2.31.1';
    webex.internal.device.features.entitlement.models = [{_values: {key: 'ucm-calling'}}];
    webex.internal.device.callingBehavior = 'NATIVE_SIP_CALL_TO_UCM';
    ucmBackendConnector = new UcmBackendConnector(webex, {level: LOGGER.INFO});
    ucmBackendConnector.init();
    voicemailPayload = getVoiceMailListJsonUCM;
  });

  it('verify fetching transcript returned null', async () => {
    const response = await ucmBackendConnector.getVMTranscript(
      '98099432-9d81-4224-bd04-00def73cd262'
    );

    expect(response).toBeNull();
  });

  it('verify successful voicemail list', async () => {
    webex.request.mockResolvedValueOnce(voicemailPayload);
    const response = await ucmBackendConnector.getVoicemailList(0, 20, SORT.DESC);

    expect(response).toStrictEqual(listResponseDetails);
    expect(webex.request).toBeCalledOnceWith({
      headers: {orgId},
      method: HTTP_METHODS.GET,
      uri: `${ucmBackendInfoUrl + voicemailContent}`,
    });
  });

  it('verify successful voicemailMarkAsRead', async () => {
    webex.request.mockResolvedValueOnce(voicemailPayload);

    const response = await ucmBackendConnector.voicemailMarkAsRead(messageId);

    expect(response).toStrictEqual(responseDetails);

    expect(webex.request).toBeCalledOnceWith({
      uri: `${ucmBackendInfoUrl}/${messageId}`,
      method: HTTP_METHODS.PUT,
      headers: {
        orgId,
      },
      body: {
        read: 'true',
      },
    });
  });

  it('verify successful voicemailMarkAsUnread', async () => {
    webex.request.mockResolvedValueOnce(voicemailPayload);

    const response = await ucmBackendConnector.voicemailMarkAsUnread(messageId);

    expect(response).toStrictEqual(responseDetails);

    expect(webex.request).toBeCalledOnceWith({
      uri: `${ucmBackendInfoUrl}/${messageId}`,
      method: HTTP_METHODS.PUT,
      headers: {
        orgId,
      },
      body: {
        read: 'false',
      },
    });
  });

  it('verify successful deleteVoicemail', async () => {
    webex.request.mockResolvedValueOnce(voicemailPayload);
    const response = await ucmBackendConnector.deleteVoicemail(messageId);

    expect(response).toStrictEqual(responseDetails);

    expect(webex.request).toBeCalledOnceWith({
      uri: `${ucmBackendInfoUrl}/${messageId}`,
      method: HTTP_METHODS.DELETE,
      headers: {
        orgId,
      },
    });
  });
});

describe('Voicemail failure tests for UCM', () => {
  const responseDetails = {
    statusCode: 400,
    data: {error: '400 Bad request'},
    message: FAILURE_MESSAGE,
  };

  const responseDetails401 = {
    statusCode: 401,
    data: {error: 'User is unauthorised, possible token expiry'},
    message: FAILURE_MESSAGE,
  };

  const failurePayload = {
    statusCode: 400,
  };

  const failurePayload401 = {
    statusCode: 401,
  };

  beforeAll(() => {
    webex.version = '2.31.1';
    webex.internal.device.version = '2.31.1';
    webex.internal.device.features.entitlement.models = [{_values: {key: 'ucm-calling'}}];
    webex.internal.device.callingBehavior = 'NATIVE_SIP_CALL_TO_UCM';
    ucmBackendConnector = new UcmBackendConnector(webex, {level: LOGGER.INFO});
    ucmBackendConnector.init();
    voicemailPayload = getVoiceMailListJsonUCM;
  });
  beforeEach(() => {
    serviceErrorCodeHandlerSpy = jest.spyOn(utils, 'serviceErrorCodeHandler');
  });

  it('verify failure voicemail listing when bad request occur', async () => {
    webex.request.mockRejectedValueOnce(failurePayload);
    const response = await ucmBackendConnector.getVoicemailList(0, 20, SORT.DESC);

    expect(response).toStrictEqual(responseDetails);

    expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
      {
        statusCode: 400,
      },
      {
        file: 'UcmBackendConnector',
        method: 'getVoicemailList',
      }
    );
    expect(webex.request).toBeCalledOnceWith({
      headers: {orgId},
      method: HTTP_METHODS.GET,
      uri: `${ucmBackendInfoUrl + voicemailContent}`,
    });
  });

  it('verify failure voicemailMarkAsRead when bad request occur', async () => {
    webex.request.mockRejectedValue(failurePayload);
    const {MsgId} = mockUCMVoicemailBody.body.items[0];

    const response = await ucmBackendConnector.voicemailMarkAsRead(MsgId);

    expect(response).toStrictEqual(responseDetails);
    expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
      {
        statusCode: 400,
      },
      {
        file: 'UcmBackendConnector',
        method: 'voicemailMarkAsRead',
      }
    );
    expect(webex.request).toBeCalledOnceWith({
      uri: `${ucmBackendInfoUrl}/${MsgId}`,
      method: HTTP_METHODS.PUT,
      headers: {
        orgId,
      },
      body: {
        read: 'true',
      },
    });
  });

  it('verify failure voicemailMarkAsUnread when bad request occur', async () => {
    webex.request.mockRejectedValue(failurePayload);
    const {MsgId} = mockUCMVoicemailBody.body.items[0];
    const response = await ucmBackendConnector.voicemailMarkAsUnread(MsgId);

    expect(response).toStrictEqual(responseDetails);
    expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
      {
        statusCode: 400,
      },
      {
        file: 'UcmBackendConnector',
        method: 'voicemailMarkAsUnread',
      }
    );

    expect(webex.request).toBeCalledOnceWith({
      uri: `${ucmBackendInfoUrl}/${MsgId}`,
      method: HTTP_METHODS.PUT,
      headers: {
        orgId,
      },
      body: {
        read: 'false',
      },
    });
  });

  it('verify failure delete voicemail when bad request occur', async () => {
    webex.request.mockRejectedValue(failurePayload);

    const {MsgId} = mockUCMVoicemailBody.body.items[0];

    const response = await ucmBackendConnector.deleteVoicemail(MsgId);

    expect(response).toStrictEqual(responseDetails);

    expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
      {
        statusCode: 400,
      },
      {
        file: 'UcmBackendConnector',
        method: 'deleteVoicemail',
      }
    );
    expect(webex.request).toBeCalledOnceWith({
      uri: `${ucmBackendInfoUrl}/${MsgId}`,
      method: HTTP_METHODS.DELETE,
      headers: {
        orgId,
      },
    });
  });

  it('verify failure voicemail listing when user is unauthorised, possible token expiry', async () => {
    webex.request.mockRejectedValue(failurePayload401);
    const response = await ucmBackendConnector.getVoicemailList(0, 20, SORT.DESC);

    expect(response).toStrictEqual(responseDetails401);

    expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
      {
        statusCode: 401,
      },
      {
        file: 'UcmBackendConnector',
        method: 'getVoicemailList',
      }
    );
    expect(webex.request).toBeCalledOnceWith({
      headers: {orgId},
      method: HTTP_METHODS.GET,
      uri: `${ucmBackendInfoUrl + voicemailContent}`,
    });
  });

  it('verify failure voicemailMarkAsRead when user is unauthorised, possible token expiry', async () => {
    webex.request.mockRejectedValue(failurePayload401);
    const {MsgId} = mockUCMVoicemailBody.body.items[0];

    const response = await ucmBackendConnector.voicemailMarkAsRead(MsgId);

    expect(response).toStrictEqual(responseDetails401);

    expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
      {
        statusCode: 401,
      },
      {
        file: 'UcmBackendConnector',
        method: 'voicemailMarkAsRead',
      }
    );

    expect(webex.request).toBeCalledOnceWith({
      uri: `${ucmBackendInfoUrl}/${MsgId}`,
      method: HTTP_METHODS.PUT,
      headers: {
        orgId,
      },
      body: {
        read: 'true',
      },
    });
  });

  it('verify failure voicemailMarkAsUnread when user is unauthorised, possible token expiry', async () => {
    webex.request.mockRejectedValue(failurePayload401);
    const {MsgId} = mockUCMVoicemailBody.body.items[0];

    const response = await ucmBackendConnector.voicemailMarkAsUnread(MsgId);

    expect(response).toStrictEqual(responseDetails401);

    expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
      {
        statusCode: 401,
      },
      {
        file: 'UcmBackendConnector',
        method: 'voicemailMarkAsUnread',
      }
    );

    expect(webex.request).toBeCalledOnceWith({
      uri: `${ucmBackendInfoUrl}/${MsgId}`,
      method: HTTP_METHODS.PUT,
      headers: {
        orgId,
      },
      body: {
        read: 'false',
      },
    });
  });

  it('verify failure delete voicemail when user is unauthorised, possible token expiry', async () => {
    webex.request.mockRejectedValue(failurePayload401);

    const {MsgId} = mockUCMVoicemailBody.body.items[0];

    const response = await ucmBackendConnector.deleteVoicemail(MsgId);

    expect(response).toStrictEqual(responseDetails401);

    expect(serviceErrorCodeHandlerSpy).toBeCalledOnceWith(
      {
        statusCode: 401,
      },
      {
        file: 'UcmBackendConnector',
        method: 'deleteVoicemail',
      }
    );

    expect(webex.request).toBeCalledOnceWith({
      uri: `${ucmBackendInfoUrl}/${MsgId}`,
      method: HTTP_METHODS.DELETE,
      headers: {
        orgId,
      },
    });
  });

  it('verify fetching voicemail summary returned to be null', async () => {
    const response = await ucmBackendConnector.getVoicemailSummary();

    expect(response).toBeNull();
  });
});
