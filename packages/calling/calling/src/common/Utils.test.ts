/* eslint-disable no-underscore-dangle */
import {CallingPartyInfo, CALLING_BACKEND, MessageInfo} from '../Voicemail/types';
import {METRIC_TYPE, METRIC_EVENT, REG_ACTION} from '../CallingClient/metrics/types';
import {LOGGER} from '../Logger/types';
import {Call} from '../CallingClient/calling';
import {CallError, CallingClientError} from '../Errors';
import {CallingClient} from '../CallingClient/CallingClient';
import {
  mockCallingClient,
  getTestUtilsWebex,
  getMockDeviceInfo,
  getSampleScimResponse,
  getSamplePeopleListResponse,
  getSampleRawAndParsedMediaStats,
} from './testUtil';
import {
  CallDirection,
  CallType,
  DecodeType,
  MobiusStatus,
  ServiceIndicator,
  SORT,
  WebexRequestPayload,
} from './types';
import log from '../Logger';
import {
  CALLING_CLIENT_FILE,
  CALL_FILE,
  DEVICES_ENDPOINT_RESOURCE,
  DUMMY_METRICS,
  UTILS_FILE,
  IDENTITY_ENDPOINT_RESOURCE,
  SCIM_ENDPOINT_RESOURCE,
  SCIM_USER_FILTER,
  REGISTER_UTIL,
  KEEPALIVE_UTIL,
} from '../CallingClient/constants';
import {CALL_ERROR_CODE, ErrorObject, ERROR_CODE, ERROR_LAYER, ERROR_TYPE} from '../Errors/types';
import {EVENT_KEYS} from '../Events/types';
import {
  handleCallErrors,
  handleErrors,
  parseMediaQualityStatistics,
  getSortedVoicemailList,
  resolveContact,
  storeVoicemailList,
  fetchVoicemailList,
  inferIdFromUuid,
  getXsiActionEndpoint,
  getVgActionEndpoint,
} from './Utils';
import {
  getVoicemailListJsonWXC,
  getAscVoicemailListJsonWXC,
  getDescVoicemailListJsonWXC,
} from '../Voicemail/voicemailFixture';
import {INFER_ID_CONSTANT} from './constants';
import { ISDKConnector } from '../SDKConnector/types';
import SDKConnector from '../SDKConnector';

const mockSubmitRegistrationMetric = jest.fn();

const webex = getTestUtilsWebex();
let sdkConnector: ISDKConnector = SDKConnector;
sdkConnector.setWebex(webex);

const callingClient = new CallingClient({logger: {level: LOGGER.INFO}});
const fakeCallingClient = mockCallingClient as unknown as typeof callingClient;

fakeCallingClient.sendMetric = mockSubmitRegistrationMetric;
webex.internal.metrics.submitClientMetrics = mockSubmitRegistrationMetric;

describe('Registration Tests', () => {
  /* Error flows tests starts */
  const logSpy = jest.spyOn(log, 'warn');
  const logObj = {
    file: 'CallingClient',
    method: REGISTER_UTIL,
  };

  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  const checkMetric = (times: number, error?: unknown, webexObjCheck = false) => {
    expect(mockSubmitRegistrationMetric).toBeCalledTimes(times);
    if (webexObjCheck) {
      expect(mockSubmitRegistrationMetric).toBeCalledOnceWith(
        METRIC_EVENT.REGISTRATION_ERROR,
        expect.any(Object)
      );
    } else {
      expect(mockSubmitRegistrationMetric).toBeCalledOnceWith(
        METRIC_EVENT.REGISTRATION_ERROR,
        REG_ACTION.REGISTER,
        METRIC_TYPE.BEHAVIORAL,
        error
      );
    }
  };

  /* 500 error starts */
  it('verify 500 response', () => {
    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 500,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
      },
    });

    const mockErrorEvent: ErrorObject = {
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      message: 'An unknown error occurred while placing the request. Wait a moment and try again.',
      context: logObj,
    };
    const callClientError = new CallingClientError(
      mockErrorEvent.message,
      mockErrorEvent.context,
      mockErrorEvent.type,
      MobiusStatus.ACTIVE
    );

    handleErrors(fakeCallingClient, webexPayload, logObj.method as string, CALLING_CLIENT_FILE);

    expect(logSpy).toBeCalledTimes(2);
    expect(logSpy).toBeCalledWith('500 Internal Server Error', logObj);
    expect(logSpy).toBeCalledWith('Status code: -> 500', logObj);
    expect(fakeCallingClient.emit).toBeCalledOnceWith(EVENT_KEYS.UNREGISTERED);

    checkMetric(1, callClientError);
  });

  /* 503 error starts */
  it('verify 503 response without retry-after', () => {
    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 503,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
      },
      body: {
        device: {
          deviceId: '8a67806f-fc4d-446b-a131-31e71ea5b010',
        },
      },
    });
    const mockErrorEvent = {
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      message:
        'An error occurred on the server while processing the request. Wait a moment and try again.',
      context: logObj,
    };
    const callClientError = new CallingClientError(
      mockErrorEvent.message,
      mockErrorEvent.context,
      mockErrorEvent.type,
      MobiusStatus.ACTIVE
    );

    handleErrors(fakeCallingClient, webexPayload, logObj.method as string, CALLING_CLIENT_FILE);

    expect(logSpy).toBeCalledWith('503 Service Unavailable', logObj);
    expect(logSpy).toBeCalledWith('Status code: -> 503', logObj);
    expect(fakeCallingClient.emit).toBeCalledOnceWith(EVENT_KEYS.UNREGISTERED);

    checkMetric(1, callClientError);
  });

  it('verify 503 response with retry-after', () => {
    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 503,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
        'retry-after': 30,
      },
      body: {
        device: {
          deviceId: '8a67806f-fc4d-446b-a131-31e71ea5b010',
        },
      },
    });

    const mockErrorEvent = {
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      message:
        'An error occurred on the server while processing the request. Wait a moment and try again.',
      context: logObj,
    };
    const callClientError = new CallingClientError(
      mockErrorEvent.message,
      mockErrorEvent.context,
      mockErrorEvent.type,
      MobiusStatus.ACTIVE
    );

    jest.spyOn(global, 'setTimeout');
    handleErrors(fakeCallingClient, webexPayload, logObj.method as string, CALLING_CLIENT_FILE);

    expect(setTimeout).not.toBeCalled();
    expect(fakeCallingClient.emit).toBeCalledOnceWith(EVENT_KEYS.UNREGISTERED);

    checkMetric(1, callClientError);
  });

  it('verify 403 response with no response body', async () => {
    const deRegSpy = jest.spyOn(callingClient, 'deregister');
    const regSpy = jest.spyOn(callingClient, 'restorePreviousRegistration');

    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 403,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_30',
      },
    });

    const mockErrorEvent: ErrorObject = {
      type: ERROR_TYPE.FORBIDDEN_ERROR,
      message:
        'An unauthorized action has been received. This action has been blocked. Please contact the administrator if this persists.',
      context: logObj,
    };
    const callClientError = new CallingClientError(
      mockErrorEvent.message,
      mockErrorEvent.context,
      mockErrorEvent.type,
      MobiusStatus.DEFAULT
    );

    const ret = await handleErrors(
      fakeCallingClient,
      webexPayload,
      logObj.method as string,
      CALLING_CLIENT_FILE
    );

    expect(ret).toBe(false);
    expect(deRegSpy).not.toBeCalled();
    expect(regSpy).not.toBeCalled();
    expect(fakeCallingClient.emit).toBeCalledOnceWith(EVENT_KEYS.UNREGISTERED);

    checkMetric(1, callClientError);
  });

  it('verify 403 response with code 101: Retry Success', async () => {
    const deRegSpy = jest.spyOn(callingClient, 'deregister');
    const regSpy = jest.spyOn(callingClient, 'restorePreviousRegistration');
    const regRetrySpy = jest.spyOn(callingClient, 'setRegRetry');
    const mobiusUri = 'https://mobius.webex.com/api/v1/calling/web/';
    const deviceId = '30d84f70-eb44-3ef0-8e59-28d0b8c7cad7';

    callingClient.removeAllListeners(EVENT_KEYS.ERROR);
    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 403,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
      },
      body: {
        userId: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
        errorCode: 101,
        devices: [
          {
            deviceId,
            uri: `${mobiusUri}${DEVICES_ENDPOINT_RESOURCE}/${deviceId}`,
            status: 'active',
            lastSeen: '2022-04-07T18:00:40Z',
            addresses: ['sip:sipAddress@webex.com'],
          },
        ],
      },
    });

    const mockRegistrationBody = getMockDeviceInfo();

    const successPayload = {
      statusCode: 200,
      body: mockRegistrationBody,
    };

    /* eslint-disable dot-notation */
    jest.spyOn(callingClient['registration'], 'createDevice').mockResolvedValueOnce(successPayload);

    let unregistered = false;

    callingClient.on(EVENT_KEYS.UNREGISTERED, () => {
      unregistered = true;
    });

    await handleErrors(callingClient, webexPayload, logObj.method as string, CALLING_CLIENT_FILE);
    expect(unregistered).toBe(false);
    expect(deRegSpy).toBeCalledOnceWith();
    expect(regSpy).toBeCalledOnceWith(REGISTER_UTIL);
    expect(regRetrySpy).toBeCalledTimes(2);
    expect(regRetrySpy).toBeCalledWith(true);
    expect(regRetrySpy).lastCalledWith(false);
    expect(callingClient.getMobiusUrl()).toBe(mobiusUri);
  });

  it('verify 403 response with code 101: Retry Failure with same error', async () => {
    const deRegSpy = jest.spyOn(callingClient, 'deregister');
    const regSpy = jest.spyOn(callingClient, 'restorePreviousRegistration');
    const regRetrySpy = jest.spyOn(callingClient, 'setRegRetry');
    const mobiusUri = 'https://mobius.webex.com/api/v1/calling/web/';
    const deviceId = '30d84f70-eb44-3ef0-8e59-28d0b8c7cad7';

    callingClient.removeAllListeners(EVENT_KEYS.ERROR);
    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 403,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
      },
      body: {
        userId: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
        errorCode: 101,
        devices: [
          {
            deviceId,
            uri: `${mobiusUri}${DEVICES_ENDPOINT_RESOURCE}/${deviceId}`,
            status: 'active',
            lastSeen: '2022-04-07T18:00:40Z',
            addresses: ['sip:sipAddress@webex.com'],
          },
        ],
      },
    });

    jest.spyOn(callingClient['registration'], 'createDevice').mockRejectedValueOnce(webexPayload);

    let unregistered = false;

    callingClient.on(EVENT_KEYS.UNREGISTERED, () => {
      unregistered = true;
    });

    await handleErrors(callingClient, webexPayload, logObj.method as string, CALLING_CLIENT_FILE);
    expect(unregistered).toBe(true);
    expect(deRegSpy).toBeCalledOnceWith();
    expect(regSpy).toBeCalledOnceWith(REGISTER_UTIL);
    expect(regRetrySpy).toBeCalledTimes(2);
    expect(regRetrySpy).toBeCalledWith(true);
    expect(regRetrySpy).lastCalledWith(false);
  });

  it('verify 403 response with code 101 and empty devices array', async () => {
    const deRegSpy = jest.spyOn(callingClient, 'deregister');
    const regSpy = jest.spyOn(callingClient, 'register');

    callingClient.removeAllListeners(EVENT_KEYS.ERROR);
    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 403,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
      },
      body: {
        userId: '8a67806f-fc4d-446b-a131-31e71ea5b0e9',
        errorCode: 101,
        devices: [],
      },
    });

    let unregistered = false;

    callingClient.on(EVENT_KEYS.UNREGISTERED, () => {
      unregistered = true;
    });

    await handleErrors(callingClient, webexPayload, logObj.method as string, CALLING_CLIENT_FILE);
    expect(unregistered).toBe(true);
    expect(deRegSpy).not.toBeCalled();
    expect(regSpy).not.toBeCalled();
  });

  it('verify 403 response with code 102', (done) => {
    callingClient.removeAllListeners(EVENT_KEYS.ERROR);
    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 403,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
      },
      body: {
        userId: 'c9f5cb96-e4b9-48c4-81a0-cffab97ce563',
        errorCode: 102,
        devices: [],
      },
    });
    const mockErrorEvent = {
      type: ERROR_TYPE.FORBIDDEN_ERROR,
      message:
        'User is not configured for WebRTC calling. Please contact the administrator to resolve this issue.',
      context: logObj,
    };

    callingClient.on(EVENT_KEYS.ERROR, (errObj) => {
      expect(errObj).toMatchObject(mockErrorEvent);
      done();
    });

    handleErrors(callingClient, webexPayload, logObj.method as string, CALLING_CLIENT_FILE);
    checkMetric(1, undefined, true);
  });

  it('verify 403 response with code 103', (done) => {
    callingClient.removeAllListeners(EVENT_KEYS.ERROR);
    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 403,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
      },
      body: {
        userId: 'c9f5cb96-e4b9-48c4-81a0-cffab97ce563',
        errorCode: 103,
        devices: [],
      },
    });

    callingClient.on(EVENT_KEYS.UNREGISTERED, () => {
      done();
    });

    handleErrors(callingClient, webexPayload, logObj.method as string, CALLING_CLIENT_FILE);
    checkMetric(1, undefined, true);
  });

  it('verify 403 response with unknown error code:- 999', (done) => {
    callingClient.removeAllListeners(EVENT_KEYS.ERROR);
    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 403,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
      },
      body: {
        userId: 'c9f5cb96-e4b9-48c4-81a0-cffab97ce563',
        errorCode: 999,
        devices: [],
      },
    });

    callingClient.on(EVENT_KEYS.UNREGISTERED, () => {
      done();
    });

    handleErrors(callingClient, webexPayload, logObj.method as string, CALLING_CLIENT_FILE);
    checkMetric(1, undefined, true);
  });

  /* 403 error ends */

  /* 401 error starts */
  it('verify 401 error response', (done) => {
    callingClient.removeAllListeners(EVENT_KEYS.ERROR);
    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 401,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
      },
      body: {
        device: {
          deviceId: '8a67806f-fc4d-446b-a131-31e71ea5b010',
        },
      },
    });
    const mockErrorEvent = {
      type: ERROR_TYPE.TOKEN_ERROR,
      message: 'User is unauthorized due to an expired token. Sign out, then sign back in.',
      context: logObj,
    };

    callingClient.on(EVENT_KEYS.ERROR, (errObj) => {
      expect(errObj).toMatchObject(mockErrorEvent);
      done();
    });

    handleErrors(callingClient, webexPayload, logObj.method as string, CALLING_CLIENT_FILE);
    checkMetric(1, undefined, true);
  });

  /* Error cases start */
  /* 404 error starts */
  it('verify 404 error response', (done) => {
    callingClient.removeAllListeners(EVENT_KEYS.ERROR);
    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 404,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
      },
      body: {
        device: {
          deviceId: '8a67806f-fc4d-446b-a131-31e71ea5b010',
        },
      },
    });
    const mockErrorEvent = {
      type: ERROR_TYPE.NOT_FOUND,
      message:
        'The client has unregistered. Please wait for the client to register before attempting the call. If error persists, sign out, sign back in and attempt the call.',
      context: logObj,
    };

    callingClient.on(EVENT_KEYS.ERROR, (errObj) => {
      expect(errObj).toMatchObject(mockErrorEvent);
      done();
    });

    handleErrors(callingClient, webexPayload, logObj.method as string, CALLING_CLIENT_FILE);
    checkMetric(1, undefined, true);
  });
});

describe('KEEPALIVE Tests', () => {
  const logSpy = jest.spyOn(log, 'warn');
  const logObj = {
    file: 'CallingClient',
    method: KEEPALIVE_UTIL,
  };

  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  const checkMetric = (times: number, error?: unknown, webexObjCheck = false) => {
    expect(mockSubmitRegistrationMetric).toBeCalledTimes(times);
    if (webexObjCheck) {
      expect(mockSubmitRegistrationMetric).toBeCalledOnceWith(
        METRIC_EVENT.REGISTRATION,
        expect.any(Object)
      );
    } else {
      expect(mockSubmitRegistrationMetric).toBeCalledOnceWith(
        METRIC_EVENT.REGISTRATION,
        REG_ACTION.KEEPALIVE_FAILURE,
        METRIC_TYPE.BEHAVIORAL,
        error
      );
    }
  };

  it('verify non final error response for keepalive', () => {
    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 500,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
      },
    });

    const mockErrorEvent: ErrorObject = {
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      message: 'An unknown error occurred while placing the request. Wait a moment and try again.',
      context: logObj,
    };
    const callClientError = new CallingClientError(
      mockErrorEvent.message,
      mockErrorEvent.context,
      mockErrorEvent.type,
      MobiusStatus.ACTIVE
    );

    handleErrors(fakeCallingClient, webexPayload, logObj.method as string, CALLING_CLIENT_FILE);

    expect(logSpy).toBeCalledTimes(2);
    expect(logSpy).toBeCalledWith('500 Internal Server Error', logObj);
    expect(logSpy).toBeCalledWith('Status code: -> 500', logObj);
    expect(fakeCallingClient.emit).toBeCalledTimes(0);

    checkMetric(1, callClientError);
  });

  it('verify final error response for keepalive', (done) => {
    callingClient.removeAllListeners(EVENT_KEYS.ERROR);
    const webexPayload = <WebexRequestPayload>(<unknown>{
      statusCode: 404,
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
      },
      body: {
        device: {
          deviceId: '8a67806f-fc4d-446b-a131-31e71ea5b010',
        },
      },
    });
    const mockErrorEvent = {
      type: ERROR_TYPE.NOT_FOUND,
      message:
        'The client has unregistered. Please wait for the client to register before attempting the call. If error persists, sign out, sign back in and attempt the call.',
      context: logObj,
    };

    callingClient.on(EVENT_KEYS.ERROR, (errObj) => {
      expect(errObj).toMatchObject(mockErrorEvent);
      done();
    });

    handleErrors(callingClient, webexPayload, logObj.method as string, CALLING_CLIENT_FILE);
    checkMetric(1, undefined, true);
  });
});

describe('Call Tests', () => {
  /* Error flows tests starts */
  const logSpy = jest.spyOn(log, 'warn');
  const logObj = {
    file: CALL_FILE,
    method: 'handleCallErrors',
  };

  const deviceId = '55dfb53f-bed2-36da-8e85-cee7f02aa68e';
  const dest = {
    type: CallType.URI,
    address: 'tel:5003',
  };

  const deleteCallFromCollection = jest.fn();
  const retryCallback = jest.fn();
  const activeUrl = 'FakeActiveUrl';
  const defaultServiceIndicator = ServiceIndicator.CALLING;
  const call = new Call(
    activeUrl,
    webex,
    dest,
    CallDirection.OUTBOUND,
    deviceId,
    deleteCallFromCollection,
    defaultServiceIndicator
  );

  const dummyCorrelationId = '8a67806f-fc4d-446b-a131-31e71ea5b010';

  beforeEach(() => {
    jest.clearAllTimers();
    jest.useFakeTimers();
    call.removeAllListeners(EVENT_KEYS.CALL_ERROR);
  });

  /**
   * TestCase inputs
   * name: TestCase name
   * code: Response code of type ERROR_CODE
   * bodyPresent: Indicates if response has a body
   * subErrorCode: sub error code of type CALL_ERROR_CODE
   * retryAfter: Indicates if retry-after header is present
   * message: Custom message for the error context
   * type: Error type based on the response code
   * errorLayer: Call control or media layer
   * cbExpected: Indicates if event emitter callback is expected
   * logMsg: log message.
   */
  const errorCodes: {
    name: string;
    code: ERROR_CODE;
    bodyPresent: boolean;
    subErrorCode: CALL_ERROR_CODE;
    retryAfter: number;
    message: string;
    type: ERROR_TYPE;
    errorLayer: ERROR_LAYER;
    cbExpected: boolean;
    logMsg: string;
  }[] = [
    /* 401 Unauthorized. */
    {
      name: 'verify 401 error response',
      code: 401,
      bodyPresent: true,
      subErrorCode: 0,
      retryAfter: 0,
      message: 'User is unauthorized due to an expired token. Sign out, then sign back in.',
      type: ERROR_TYPE.TOKEN_ERROR,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: '401 Unauthorized',
    },
    /* 403 error code from here. */
    // Without body
    {
      name: 'verify 403 error response without body',
      code: 403,
      bodyPresent: false,
      subErrorCode: 0,
      retryAfter: 0,
      message:
        'An unauthorized action has been received. This action has been blocked. Please contact the administrator if this persists.',
      type: ERROR_TYPE.FORBIDDEN_ERROR,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Error response has no body, throwing default error',
    },
    // error body with sub error code 111
    {
      name: 'verify 403 error response with code 111',
      code: 403,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.INVALID_STATUS_UPDATE,
      retryAfter: 0,
      message:
        'An invalid status update has been received for the call. Wait a moment and try again.',
      type: ERROR_TYPE.FORBIDDEN_ERROR,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->403',
    },
    // error body with sub error code 112
    {
      name: 'verify 403 error response with code 112',
      code: 403,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.DEVICE_NOT_REGISTERED,
      retryAfter: 0,
      message:
        'The client has unregistered. Please wait for the client to register before attempting the call. If error persists, sign out, sign back in and attempt the call.',
      type: ERROR_TYPE.FORBIDDEN_ERROR,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->403',
    },
    // error body with sub error code 113
    {
      name: 'verify 403 error response with code 113',
      code: 403,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.CALL_NOT_FOUND,
      retryAfter: 0,
      message: 'Call is not found on the server. Wait a moment and try again.',
      type: ERROR_TYPE.FORBIDDEN_ERROR,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->403',
    },
    // error body with sub error code 114
    {
      name: 'verify 403 error response with code 114',
      code: 403,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.ERROR_PROCESSING,
      retryAfter: 0,
      message:
        'An error occurred while processing the call on the server. Wait a moment and try again.',
      type: ERROR_TYPE.FORBIDDEN_ERROR,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->403',
    },
    // error body with sub error code 115
    {
      name: 'verify 403 error response with code 115',
      code: 403,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.USER_BUSY,
      retryAfter: 0,
      message: 'Called user is busy.',
      type: ERROR_TYPE.FORBIDDEN_ERROR,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->403',
    },
    // error body with sub error code 116
    {
      name: 'verify 403 error response with code 116',
      code: 403,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.PARSING_ERROR,
      retryAfter: 0,
      message:
        'An error occurred while parsing the provided information. Wait a moment and try again.',
      type: ERROR_TYPE.FORBIDDEN_ERROR,
      errorLayer: ERROR_LAYER.MEDIA,
      cbExpected: true,
      logMsg: 'Status code: ->403',
    },
    // error body with sub error code 118
    {
      name: 'verify 403 error response with code 118',
      code: 403,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.NOT_ACCEPTABLE,
      retryAfter: 0,
      message:
        'An error occurred on the server while accepting the call. Wait a moment and try again. Please contact the administrator if this persists.',
      type: ERROR_TYPE.FORBIDDEN_ERROR,
      errorLayer: ERROR_LAYER.MEDIA,
      cbExpected: true,
      logMsg: 'Status code: ->403',
    },
    // error body with sub error code 119
    {
      name: 'verify 403 error response with code 119',
      code: 403,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.CALL_REJECTED,
      retryAfter: 0,
      message:
        'Call rejected by the server. Wait a moment and try again. Please contact the administrator if this persists.',
      type: ERROR_TYPE.FORBIDDEN_ERROR,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->403',
    },
    // error body with sub error code 120
    {
      name: 'verify 403 error response with code 120',
      code: 403,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.NOT_AVAILABLE,
      retryAfter: 0,
      message:
        'Calling services not available. Wait a moment and try again. Please contact the administrator if this persists.',
      type: ERROR_TYPE.FORBIDDEN_ERROR,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->403',
    },
    // error body with unknown/unhandled sub error code
    {
      name: 'verify 403 error response with unknown error code',
      code: 403,
      bodyPresent: true,
      subErrorCode: 999,
      retryAfter: 0,
      message: 'An unknown error occurred. Wait a moment and try again.',
      type: ERROR_TYPE.FORBIDDEN_ERROR,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->403',
    },
    /* 403 error code till here. */
    /* 503 error code from here. */
    // Without body
    {
      name: 'verify 503 error response without body',
      code: 503,
      bodyPresent: false,
      subErrorCode: 0,
      retryAfter: 0,
      message:
        'An error occurred on the server while processing the request. Wait a moment and try again.',
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Error response has no body, throwing default error',
    },
    // error body with sub error code 111
    {
      name: 'verify 503 error response with code 111',
      code: 503,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.INVALID_STATUS_UPDATE,
      retryAfter: 0,
      message:
        'An invalid status update has been received for the call. Wait a moment and try again.',
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->503',
    },
    // error body with sub error code 112
    {
      name: 'verify 503 error response with code 112',
      code: 503,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.DEVICE_NOT_REGISTERED,
      retryAfter: 0,
      message:
        'The client has unregistered. Please wait for the client to register before attempting the call. If error persists, sign out, sign back in and attempt the call.',
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->503',
    },
    // error body with sub error code 113
    {
      name: 'verify 503 error response with code 113',
      code: 503,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.CALL_NOT_FOUND,
      retryAfter: 0,
      message: 'Call is not found on the server. Wait a moment and try again.',
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->503',
    },
    // error body with sub error code 114
    {
      name: 'verify 503 error response with code 114',
      code: 503,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.ERROR_PROCESSING,
      retryAfter: 0,
      message:
        'An error occurred while processing the call on the server. Wait a moment and try again.',
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->503',
    },
    // error body with sub error code 115
    {
      name: 'verify 503 error response with code 115',
      code: 503,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.USER_BUSY,
      retryAfter: 0,
      message: 'Called user is busy.',
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->503',
    },
    // error body with sub error code 116
    {
      name: 'verify 503 error response with code 116',
      code: 503,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.PARSING_ERROR,
      retryAfter: 0,
      message:
        'An error occurred while parsing the provided information. Wait a moment and try again.',
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      errorLayer: ERROR_LAYER.MEDIA,
      cbExpected: true,
      logMsg: 'Status code: ->503',
    },
    // error body with sub error code 118
    {
      name: 'verify 503 error response with code 118',
      code: 503,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.NOT_ACCEPTABLE,
      retryAfter: 0,
      message:
        'An error occurred on the server while accepting the call. Wait a moment and try again. Please contact the administrator if this persists.',
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      errorLayer: ERROR_LAYER.MEDIA,
      cbExpected: true,
      logMsg: 'Status code: ->503',
    },
    // error body with sub error code 119
    {
      name: 'verify 503 error response with code 119',
      code: 503,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.CALL_REJECTED,
      retryAfter: 0,
      message:
        'Call rejected by the server. Wait a moment and try again. Please contact the administrator if this persists.',
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->503',
    },
    // error body with sub error code 120
    {
      name: 'verify 503 error response with code 120',
      code: 503,
      bodyPresent: true,
      subErrorCode: CALL_ERROR_CODE.NOT_AVAILABLE,
      retryAfter: 0,
      message:
        'Calling services not available. Wait a moment and try again. Please contact the administrator if this persists.',
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->503',
    },
    // error body with unknown/unhandled sub error code
    {
      name: 'verify 503 error response with unknown error code',
      code: 503,
      bodyPresent: true,
      subErrorCode: 999,
      retryAfter: 0,
      message: 'An unknown error occurred. Wait a moment and try again.',
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: 'Status code: ->503',
    },
    // with retry-after
    {
      name: 'verify 503 error response with retry-after',
      code: 503,
      bodyPresent: true,
      subErrorCode: 0,
      retryAfter: 60,
      message: 'An unknown error occurred. Wait a moment and try again.',
      type: ERROR_TYPE.SERVICE_UNAVAILABLE,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: false,
      logMsg: 'Retry Interval received: 60',
    },
    /* 503 error code till here. */
    /* 404 Not Found. */
    {
      name: 'verify 404 error response',
      code: 404,
      bodyPresent: true,
      subErrorCode: 0,
      retryAfter: 0,
      message: 'Call is no longer active. Wait a moment and try again.',
      type: ERROR_TYPE.NOT_FOUND,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: true,
      logMsg: '404 Call Not Found',
    },
    /* 500 Internal Server Error. */
    {
      name: 'verify 500 error response',
      code: 500,
      bodyPresent: true,
      subErrorCode: 0,
      retryAfter: 0,
      message: 'An unknown error occurred in the call. Wait a moment and try again.',
      type: ERROR_TYPE.SERVER_ERROR,
      errorLayer: ERROR_LAYER.MEDIA,
      cbExpected: true,
      logMsg: '500 Internal Server Error',
    },
    /* Unknown error code. */
    {
      name: 'verify unknown error response',
      code: 0,
      bodyPresent: true,
      subErrorCode: 0,
      retryAfter: 0,
      message: 'An unknown error occurred in the call. Wait a moment and try again.',
      type: ERROR_TYPE.DEFAULT,
      errorLayer: ERROR_LAYER.CALL_CONTROL,
      cbExpected: false,
      logMsg: 'Unknown Error',
    },
  ].map((stat) =>
    Object.assign(stat, {
      toString() {
        return this['name'];
      },
    })
  );

  /* eslint-disable @typescript-eslint/no-explicit-any */
  it.each(errorCodes)('%s', (codeObj, done: any) => {
    let cbTriggered = false;
    const mockPayload = <WebexRequestPayload>(<unknown>{
      statusCode: codeObj['code'],
      headers: {
        trackingid: 'webex-js-sdk_b5812e58-7246-4a9b-bf64-831bdf13b0cd_31',
        ...(codeObj['retryAfter'] && {'retry-after': codeObj['retryAfter']}),
      },
      ...(codeObj['bodyPresent'] && {
        body: {
          device: {
            deviceId: '8a67806f-fc4d-446b-a131-31e71ea5b010',
          },
          ...(codeObj['subErrorCode'] ? {errorCode: codeObj['subErrorCode']} : {}),
        },
      }),
    });

    const mockErrorEvent = {
      type: codeObj['type'],
      message: codeObj['message'],
      context: logObj,
      correlationId: dummyCorrelationId,
      errorLayer: codeObj['errorLayer'],
    };

    if (codeObj['cbExpected']) {
      call.on(EVENT_KEYS.CALL_ERROR, (errObj) => {
        expect(errObj).toMatchObject(mockErrorEvent);
        done();
      });
    } else {
      done();
    }

    handleCallErrors(
      (error: CallError) => {
        call.emit(EVENT_KEYS.CALL_ERROR, error);
        cbTriggered = true;
      },
      codeObj['errorLayer'],
      retryCallback,
      dummyCorrelationId,
      mockPayload,
      logObj.method,
      logObj.file
    );

    expect(cbTriggered).toBe(codeObj['cbExpected']);
    expect(logSpy).toBeCalledWith(codeObj['logMsg'], logObj);
    if (codeObj['retryAfter']) {
      expect(retryCallback).toBeCalledOnceWith(codeObj['retryAfter']);
    } else {
      expect(retryCallback).not.toBeCalled();
    }
  });
});

describe('parseMediaQualityStatistics tests', () => {
  const logSpyObj = jest.spyOn(log, 'log');
  const infoSpyObj = jest.spyOn(log, 'info');
  const warnSpyObj = jest.spyOn(log, 'warn');
  const logObj = {
    file: UTILS_FILE,
    method: parseMediaQualityStatistics.name,
  };
  const stats = getSampleRawAndParsedMediaStats();
  const {statsWithVoOneWayDelayAndNw} = stats;
  const {statsWithoutVoOneWayDelayAndNw} = stats;

  /**
   * TestCase inputs
   * name: TestCase name
   * original: Original RTCStatsReport
   * parsed: Parsed stats in form of CallRtpStats
   * logSpy: SpyInstance on the log object
   * logMsg: Expected log message.
   */
  const mqStats: {
    name: string;
    original: unknown;
    parsed: unknown;
    logSpy: unknown;
    logMsg: string;
  }[] = [
    {
      name: 'Valid stats with non-zero VoOneWayDelayMs and networkType vpn',
      original: statsWithVoOneWayDelayAndNw.raw,
      parsed: statsWithVoOneWayDelayAndNw.parsed,
      logSpy: logSpyObj,
      logMsg: JSON.stringify(statsWithVoOneWayDelayAndNw.parsed),
    },
    {
      name: 'Valid stats with zero VoOneWayDelayMs and undefined networkType',
      original: statsWithoutVoOneWayDelayAndNw.raw,
      parsed: statsWithoutVoOneWayDelayAndNw.parsed,
      logSpy: logSpyObj,
      logMsg: JSON.stringify(statsWithoutVoOneWayDelayAndNw.parsed),
    },
    {
      name: 'undefined stats passed to parse function',
      original: undefined,
      parsed: DUMMY_METRICS,
      logSpy: infoSpyObj,
      logMsg: 'RTCStatsReport is null, adding dummy stats',
    },
    {
      name: 'invalid metrics passed when outbound call is disconnected before a connect',
      original: {size: 26},
      parsed: DUMMY_METRICS,
      logSpy: warnSpyObj,
      logMsg: 'Caught error while parsing RTP stats, TypeError: stats.forEach is not a function',
    },
  ].map((stat) =>
    Object.assign(stat, {
      toString() {
        return this['name'];
      },
    })
  );

  it.each(mqStats)('%s', (stat) => {
    const result = parseMediaQualityStatistics(stat['original'] as unknown as RTCStatsReport);

    expect(result).toStrictEqual(stat['parsed']);
    expect(stat['logSpy']).toBeCalledOnceWith(stat['logMsg'], logObj);
  });
});

describe('Voicemail Sorting Tests', () => {
  /* Tests Voicemail sorting in ascending and descending orders */

  it('verify VoiceMails sorting in Ascending order', () => {
    const voiceMailList = <MessageInfo[]>(
      (<unknown>getVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo)
    );
    const sortedVoicemail = getSortedVoicemailList(voiceMailList, SORT.ASC);
    const voiceMailListAscOrder =
      getAscVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo;

    expect(sortedVoicemail).toStrictEqual(voiceMailListAscOrder);
  });

  it('verify VoiceMails sorting in Descending Order', () => {
    const voiceMailList = <MessageInfo[]>(
      (<unknown>getVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo)
    );
    const sortedVoicemail = getSortedVoicemailList(voiceMailList, SORT.DESC);
    const voiceMailListDescOrder =
      getDescVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo;

    expect(sortedVoicemail).toStrictEqual(voiceMailListDescOrder);
  });
});

describe('resolveContact tests', () => {
  const scimUrl = `${webex.internal.services._serviceUrls.identity}/${IDENTITY_ENDPOINT_RESOURCE}/${SCIM_ENDPOINT_RESOURCE}/${webex.internal.device.orgId}/${SCIM_USER_FILTER}`;

  it('Invalid CallingPartyInfo', () => {
    const callingPartyInfo = {} as CallingPartyInfo;

    resolveContact(callingPartyInfo).then((result) => {
      expect(result).toBeNull();
    });
  });

  it('Resolve by userExternalId', () => {
    const callingPartyInfo = {} as CallingPartyInfo;
    const webexSpy = jest.spyOn(webex, 'request').mockResolvedValue({
      statusCode: 200,
      body: getSampleScimResponse(),
    });

    callingPartyInfo.userExternalId = {$: 'userExternalId'};
    resolveContact(callingPartyInfo).then((displayInfo) => {
      expect(displayInfo?.name).toStrictEqual('Cathy');
      expect(displayInfo?.num).toStrictEqual('5008');
      expect(displayInfo?.avatarSrc).toStrictEqual(
        getSampleScimResponse().Resources[0].photos[0].value
      );
      expect(displayInfo?.id).toStrictEqual(getSampleScimResponse().Resources[0].id);

      const query = scimUrl + encodeURIComponent(`id eq "${callingPartyInfo.userExternalId?.$}"`);

      expect(webexSpy).toBeCalledOnceWith(expect.objectContaining({uri: query}));
    });
  });

  it('Resolve by userExternalId - SCIM exception', async () => {
    const callingPartyInfo = {} as CallingPartyInfo;
    const warnSpy = jest.spyOn(log, 'warn');

    const webexSpy = jest.spyOn(webex, 'request').mockRejectedValueOnce({statusCode: 500});

    callingPartyInfo.userExternalId = {$: 'userExternalId'};
    const displayInfo = await resolveContact(callingPartyInfo);

    expect(displayInfo?.name).toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith('Error response: - 500', {
      file: 'utils',
      method: 'resolveCallerIdDisplay',
    });

    const query = scimUrl + encodeURIComponent(`id eq "${callingPartyInfo.userExternalId?.$}"`);

    expect(webexSpy).toBeCalledOnceWith(expect.objectContaining({uri: query}));
  });

  it('Resolve by userExternalId - totalResults zero', async () => {
    const callingPartyInfo = {} as CallingPartyInfo;

    const scimResponse = getSampleScimResponse();

    scimResponse.totalResults = '0';

    const webexSpy = jest.spyOn(webex, 'request').mockResolvedValueOnce({
      statusCode: 200,
      body: scimResponse,
    });

    callingPartyInfo.userExternalId = {$: 'userExternalId'};
    const displayInfo = await resolveContact(callingPartyInfo);
    const query = scimUrl + encodeURIComponent(`id eq "${callingPartyInfo.userExternalId?.$}"`);

    expect(displayInfo?.name).toBeUndefined();
    expect(webexSpy).toBeCalledOnceWith(expect.objectContaining({uri: query}));

    scimResponse.totalResults = '1';
  });

  it('Resolve by userExternalId - no primary number and no phone numbers', async () => {
    const callingPartyInfo = {} as CallingPartyInfo;

    const scimResponse = getSampleScimResponse();

    scimResponse.Resources[0].phoneNumbers[1].primary = false;

    const webexSpy = jest.spyOn(webex, 'request').mockResolvedValueOnce({
      statusCode: 200,
      body: scimResponse,
    });

    callingPartyInfo.userExternalId = {$: 'userExternalId'};
    let displayInfo = await resolveContact(callingPartyInfo);
    const query = scimUrl + encodeURIComponent(`id eq "${callingPartyInfo.userExternalId?.$}"`);

    expect(webexSpy).toBeCalledOnceWith(expect.objectContaining({uri: query}));
    expect(displayInfo?.num).toStrictEqual('5009');
    webexSpy.mockReset();

    scimResponse.Resources[0].phoneNumbers[1].primary = true;

    /* No phone numbers */
    const {phoneNumbers} = scimResponse.Resources[0];

    scimResponse.Resources[0].phoneNumbers = [];

    webex.request.mockResolvedValueOnce({
      statusCode: 200,
      body: scimResponse,
    });

    displayInfo = await resolveContact(callingPartyInfo);
    expect(displayInfo?.num).toBeUndefined();
    expect(webexSpy).toBeCalledOnceWith(expect.objectContaining({uri: query}));

    scimResponse.Resources[0].phoneNumbers = phoneNumbers;
  });

  it('Resolve by userExternalId - no photo', () => {
    const callingPartyInfo = {} as CallingPartyInfo;
    const scimResponse = getSampleScimResponse();

    scimResponse.Resources[0].photos = [];
    const webexSpy = jest.spyOn(webex, 'request').mockResolvedValue({
      statusCode: 200,
      body: scimResponse,
    });

    callingPartyInfo.userExternalId = {$: 'userExternalId'};
    resolveContact(callingPartyInfo).then((displayInfo) => {
      expect(displayInfo?.name).toStrictEqual('Cathy');
      expect(displayInfo?.num).toStrictEqual('5008');
      expect(displayInfo?.avatarSrc).toStrictEqual('unknown');
      expect(displayInfo?.id).toStrictEqual(getSampleScimResponse().Resources[0].id);

      const query = scimUrl + encodeURIComponent(`id eq "${callingPartyInfo.userExternalId?.$}"`);

      expect(webexSpy).toBeCalledOnceWith(expect.objectContaining({uri: query}));
    });
  });

  it('Resolve by name', () => {
    const callingPartyInfo = {} as CallingPartyInfo;
    const webexSpy = jest
      .spyOn(webex.people, 'list')
      .mockResolvedValue(getSamplePeopleListResponse());

    callingPartyInfo.name = {$: 'Name'};
    resolveContact(callingPartyInfo).then((displayInfo) => {
      expect(displayInfo?.name).toStrictEqual(getSamplePeopleListResponse().items[0].displayName);
      expect(displayInfo?.num).toStrictEqual(
        getSamplePeopleListResponse().items[0].phoneNumbers[0].value
      );
      expect(displayInfo?.avatarSrc).toStrictEqual(getSamplePeopleListResponse().items[0].avatar);
      expect(displayInfo?.id).toStrictEqual(
        Buffer.from(getSamplePeopleListResponse().items[0].id, 'base64')
          .toString('binary')
          .split('/')
          .pop()
      );
      expect(webexSpy).toBeCalledOnceWith(expect.objectContaining({displayName: 'Name'}));
    });
  });

  it('Resolve by name - Empty Info', async () => {
    const callingPartyInfo = {} as CallingPartyInfo;

    const peopleListResponse = getSamplePeopleListResponse();
    const {items} = peopleListResponse;

    peopleListResponse.items = [];

    const webexSpy = jest.spyOn(webex.people, 'list').mockResolvedValueOnce(peopleListResponse);

    callingPartyInfo.name = {$: 'Name'};
    const displayInfo = await resolveContact(callingPartyInfo);

    expect(displayInfo?.name).toBeUndefined();
    expect(webexSpy).toBeCalledOnceWith(expect.objectContaining({displayName: 'Name'}));

    peopleListResponse.items = items;
  });

  it('Resolve by name - ID as plain UUID instead of part of URI', async () => {
    const callingPartyInfo = {} as CallingPartyInfo;

    const peopleListResponse = getSamplePeopleListResponse();
    const {id} = peopleListResponse.items[0];

    /* Yjg1M2JiZDEtMTEzNi00ZDI1LTkzOGQtMGMzNzUzMWIxMjMz -> b853bbd1-1136-4d25-938d-0c37531b1233 */
    peopleListResponse.items[0].id = 'Yjg1M2JiZDEtMTEzNi00ZDI1LTkzOGQtMGMzNzUzMWIxMjMz';

    const webexSpy = jest.spyOn(webex.people, 'list').mockResolvedValueOnce(peopleListResponse);

    callingPartyInfo.name = {$: 'Name'};
    let displayInfo = await resolveContact(callingPartyInfo);

    expect(webexSpy).toBeCalledOnceWith(expect.objectContaining({displayName: 'Name'}));
    expect(displayInfo?.name).toStrictEqual(peopleListResponse.items[0].displayName);
    expect(displayInfo?.num).toStrictEqual(peopleListResponse.items[0].phoneNumbers[0].value);
    expect(displayInfo?.avatarSrc).toStrictEqual(peopleListResponse.items[0].avatar);
    expect(displayInfo?.id).toStrictEqual(
      Buffer.from(peopleListResponse.items[0].id, 'base64').toString('binary').split('/').pop()
    );
    webexSpy.mockReset();

    /* Also test empty id */
    peopleListResponse.items[0].id = '';

    webex.people.list.mockResolvedValueOnce(peopleListResponse);

    displayInfo = await resolveContact(callingPartyInfo);
    expect(displayInfo?.id).toStrictEqual('');
    expect(displayInfo?.name).toStrictEqual(peopleListResponse.items[0].displayName);
    expect(webexSpy).toBeCalledOnceWith(expect.objectContaining({displayName: 'Name'}));

    peopleListResponse.items[0].id = id;
  });

  it('Resolve by name - Phone numbers no match for type - work', async () => {
    const callingPartyInfo = {} as CallingPartyInfo;

    const peopleListResponse = getSamplePeopleListResponse();
    const {phoneNumbers} = peopleListResponse.items[0];

    peopleListResponse.items[0].phoneNumbers[0].type = 'mobile';
    peopleListResponse.items[0].phoneNumbers[1].type = 'mobile';

    const webexSpy = jest.spyOn(webex.people, 'list').mockResolvedValueOnce(peopleListResponse);

    callingPartyInfo.name = {$: 'Name'};
    const displayInfo = await resolveContact(callingPartyInfo);

    expect(displayInfo?.name).toStrictEqual(peopleListResponse.items[0].displayName);
    expect(displayInfo?.num).toStrictEqual(peopleListResponse.items[0].phoneNumbers[0].value);
    expect(displayInfo?.avatarSrc).toStrictEqual(peopleListResponse.items[0].avatar);
    expect(webexSpy).toBeCalledOnceWith(expect.objectContaining({displayName: 'Name'}));

    peopleListResponse.items[0].phoneNumbers = phoneNumbers;
  });

  it('Resolve by name - Phone numbers empty', async () => {
    const callingPartyInfo = {} as CallingPartyInfo;

    const peopleListResponse = getSamplePeopleListResponse();
    const {phoneNumbers} = peopleListResponse.items[0];

    peopleListResponse.items[0].phoneNumbers = [];

    const webexSpy = jest.spyOn(webex.people, 'list').mockResolvedValueOnce(peopleListResponse);

    callingPartyInfo.name = {$: 'Name'};
    const displayInfo = await resolveContact(callingPartyInfo);

    expect(webexSpy).toBeCalledOnceWith(expect.objectContaining({displayName: 'Name'}));
    expect(displayInfo?.name).toStrictEqual(peopleListResponse.items[0].displayName);
    expect(displayInfo?.num).toBeUndefined();
    expect(displayInfo?.avatarSrc).toStrictEqual(peopleListResponse.items[0].avatar);

    peopleListResponse.items[0].phoneNumbers = phoneNumbers;
  });
});

describe('Store and Fetch voicemail tests', () => {
  /* Tests Voicemail pagination - storing voicemail list to and fetching from session storage */
  const dummyContext = 'dummy';
  const logContext = {
    file: 'voicemail',
    method: 'fetchVoicemail',
  };

  const getEncryptedVoicemail = (vmList: MessageInfo[]) => {
    return Buffer.from(JSON.stringify(vmList), 'utf8').toString('base64');
  };

  const getDecryptedVoicemail = () => {
    const decryptedList = JSON.parse(
      Buffer.from(sessionStorage.getItem(dummyContext) as string, 'base64').toString('utf8')
    );

    return decryptedList;
  };

  beforeAll(() => {
    // Mock storage
    const vmListStorage = {};

    global.Storage.prototype.setItem = jest.fn((key, value) => {
      vmListStorage[key] = value;
    });
    global.Storage.prototype.getItem = jest.fn((key) => vmListStorage[key]);
  });

  it('verify saving Voicemails in session storage', () => {
    const voicemailList = <MessageInfo[]>(
      (<unknown>getVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo)
    );

    storeVoicemailList(dummyContext, voicemailList);
    const voicemailFromSessionStorage = getDecryptedVoicemail();

    expect(global.sessionStorage.setItem).toHaveBeenCalledTimes(1);

    expect(voicemailFromSessionStorage).toEqual(voicemailList);
  });

  it('verify fetching all 5 voicemails from session storage', () => {
    const voicemailList = <MessageInfo[]>(
      (<unknown>getVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo)
    );

    const encryptedVm = getEncryptedVoicemail(voicemailList);

    global.sessionStorage.setItem(dummyContext, encryptedVm.toString());
    const voicemailFromSessionStorage = fetchVoicemailList(dummyContext, 0, 5, logContext);

    expect(global.Storage.prototype.getItem).toHaveBeenCalledTimes(1);

    expect(voicemailFromSessionStorage).toEqual({messages: voicemailList, moreVMAvailable: false});
  });

  it('verify fetching first 3 VoiceMails from session storage', () => {
    const voicemailList = <MessageInfo[]>(
      (<unknown>getVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo)
    );

    const encryptedVm = getEncryptedVoicemail(voicemailList);

    global.sessionStorage.setItem(dummyContext, encryptedVm.toString());

    const voicemailFromSessionStorage = fetchVoicemailList(dummyContext, 0, 3, logContext);

    expect(global.Storage.prototype.getItem).toHaveBeenCalledTimes(1);

    expect(voicemailFromSessionStorage).toEqual({
      messages: voicemailList.slice(0, 3),
      moreVMAvailable: true,
    });
  });

  it('verify fetching 2nd and 3rd Voicemails from session storage', () => {
    const voicemailList = <MessageInfo[]>(
      (<unknown>getVoicemailListJsonWXC.body.VoiceMessagingMessages.messageInfoList.messageInfo)
    );

    const encryptedVm = getEncryptedVoicemail(voicemailList);

    global.sessionStorage.setItem(dummyContext, encryptedVm.toString());

    const voicemailFromSessionStorage = fetchVoicemailList(dummyContext, 1, 2, logContext);

    expect(global.Storage.prototype.getItem).toHaveBeenCalledTimes(1);

    expect(voicemailFromSessionStorage).toEqual({
      messages: voicemailList.slice(1, 3),
      moreVMAvailable: true,
    });
  });

  it('verify fetch Voicemails with offset limit more than the available ones from session storage', () => {
    const voicemailList = <MessageInfo[]>[];

    const encryptedVm = getEncryptedVoicemail(voicemailList);

    global.sessionStorage.setItem(dummyContext, encryptedVm.toString());

    const voicemailFromSessionStorage = fetchVoicemailList(dummyContext, 1, 5, logContext);

    expect(global.Storage.prototype.getItem).toHaveBeenCalledTimes(1);

    expect(voicemailFromSessionStorage).toEqual({
      messages: voicemailList.slice(1, 5),
      moreVMAvailable: false,
    });
  });

  it('verify fetching Voicemails when it is []', () => {
    const voicemailFromSessionStorage = fetchVoicemailList(dummyContext, 1, 5, logContext);

    expect(global.Storage.prototype.getItem).toHaveBeenCalledTimes(1);

    expect(voicemailFromSessionStorage).toEqual({messages: [], moreVMAvailable: false});
  });

  it('verify fetching Voicemails when there is exception', () => {
    const voiceMailList = '$%%ˆ';
    const logSpy = jest.spyOn(log, 'warn');

    global.sessionStorage.setItem(dummyContext, voiceMailList);
    const voicemailFromSessionStorage = fetchVoicemailList(dummyContext, 1, 5, logContext);

    expect(global.Storage.prototype.getItem).toBeCalledOnceWith('dummy');

    expect(logSpy).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith(
      'Caught exception while fetching voicemail from storage. SyntaxError: Unexpected end of JSON input',
      logContext
    );
    expect(logSpy).toHaveBeenCalledWith('422 Exception has occurred', {});
    expect(voicemailFromSessionStorage).toEqual({messages: [], moreVMAvailable: false});
  });
});

describe('Infer id from  UUID Tests', () => {
  /* Tests conversion of UUID to hydra Id */

  it('verify encoding of userId to personId', () => {
    const uuid = '14533573-f6aa-429d-b4fe-58aa04a2b631';
    const hydraId: string = inferIdFromUuid(uuid, DecodeType.PEOPLE);
    const uuidAgain = Buffer.from(hydraId, 'base64').toString('binary');

    expect(`${INFER_ID_CONSTANT}/${DecodeType.PEOPLE}/${uuid}`).toStrictEqual(uuidAgain);
  });

  it('verify encoding of orgId', () => {
    const orgId = '24533573-f6aa-429d-b4fe-58aa04a2b630';
    const encodedOrgId: string = inferIdFromUuid(orgId, DecodeType.ORGANIZATION);
    const orgIdAgain = Buffer.from(encodedOrgId, 'base64').toString('binary');

    expect(`${INFER_ID_CONSTANT}/${DecodeType.ORGANIZATION}/${orgId}`).toStrictEqual(orgIdAgain);
  });
});

describe('Get endpoint by CALLING_BACKEND tests', () => {
  it('verify invalid calling backend ucm for xsi endpoint', async () => {
    expect(
      await getXsiActionEndpoint(
        webex,
        {
          file: 'testFile',
          method: 'testMethod',
        },
        CALLING_BACKEND.UCM
      )
    ).toBeInstanceOf(Error);
  });

  it('verify invalid calling backend wxc for vg endpoint', async () => {
    expect(await getVgActionEndpoint(webex, CALLING_BACKEND.WXC)).toBeInstanceOf(Error);
  });
});
