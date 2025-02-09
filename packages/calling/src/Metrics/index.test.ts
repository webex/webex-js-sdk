/* eslint-disable dot-notation */
import {getMockDeviceInfo, getTestUtilsWebex} from '../common/testUtil';
import {getMetricManager} from './index';
import {METRIC_TYPE, METRIC_EVENT, REG_ACTION, VOICEMAIL_ACTION} from './types';
import {VERSION} from '../CallingClient/constants';
import {createClientError} from '../Errors/catalog/CallingDeviceError';
import {CallErrorObject, ErrorObject, ERROR_LAYER, ERROR_TYPE} from '../Errors/types';
import {RegistrationStatus, ServiceIndicator} from '../common/types';
import log from '../Logger';
import {createCallError} from '../Errors/catalog/CallError';

const webex = getTestUtilsWebex();

describe('CALLING: Metric tests', () => {
  const metricManager = getMetricManager(webex, ServiceIndicator.CALLING);
  const mockDeviceInfo = getMockDeviceInfo();
  const mockSubmitClientMetric = jest.fn();
  const MOCK_VERSION_NUMBER = '1.0.0';
  const originalEnv = process.env;

  webex.internal.metrics.submitClientMetrics = mockSubmitClientMetric;

  const mockCallId = '123456';
  const mockCorrelationId = '0931237';
  const mockCallAction = 'S_SEND_CALL_SETUP';
  const mockMediaAction = 'S_SEND_ROAP_OFFER';

  beforeEach(() => {
    mockSubmitClientMetric.mockClear();
    process.env = {
      ...originalEnv,
      CALLING_SDK_VERSION: MOCK_VERSION_NUMBER,
    };
  });

  it('initialize metric manager', () => {
    expect(metricManager).not.toBeNull();
    expect(metricManager['deviceInfo']).toBeUndefined();
  });

  it('update deviceInfo in metric manager', () => {
    expect(metricManager['deviceInfo']).toBeUndefined();
    metricManager.setDeviceInfo(mockDeviceInfo);
    expect(metricManager['deviceInfo']).toEqual(mockDeviceInfo);
  });

  describe('CallingClient metric tests', () => {
    it('submit registration success metric', () => {
      metricManager.setDeviceInfo(mockDeviceInfo);

      const expectedData = {
        tags: {
          action: REG_ACTION.REGISTER,
          device_id: mockDeviceInfo.device.deviceId,
          service_indicator: ServiceIndicator.CALLING,
        },
        fields: {
          device_url: mockDeviceInfo.device.clientDeviceUri,
          mobius_url: mockDeviceInfo.device.uri,
          calling_sdk_version: MOCK_VERSION_NUMBER,
        },
        type: METRIC_TYPE.BEHAVIORAL,
      };

      metricManager.submitRegistrationMetric(
        METRIC_EVENT.REGISTRATION,
        REG_ACTION.REGISTER,
        METRIC_TYPE.BEHAVIORAL,
        undefined
      );
      expect(mockSubmitClientMetric).toBeCalledOnceWith(METRIC_EVENT.REGISTRATION, expectedData);
    });

    it('submit registration failure metric', () => {
      metricManager.setDeviceInfo(mockDeviceInfo);

      const clientError = createClientError(
        '',
        {},
        ERROR_TYPE.DEFAULT,
        RegistrationStatus.INACTIVE
      );
      const err = <ErrorObject>{};

      err.context = {};
      err.message = 'Unknown Error';
      err.type = ERROR_TYPE.SERVICE_UNAVAILABLE;

      clientError.setError(err);

      const expectedData = {
        tags: {
          action: REG_ACTION.REGISTER,
          device_id: mockDeviceInfo.device.deviceId,
          service_indicator: ServiceIndicator.CALLING,
        },
        fields: {
          device_url: mockDeviceInfo.device.clientDeviceUri,
          mobius_url: mockDeviceInfo.device.uri,
          calling_sdk_version: MOCK_VERSION_NUMBER,
          error: clientError.getError().message,
          error_type: clientError.getError().type,
        },
        type: METRIC_TYPE.BEHAVIORAL,
      };

      metricManager.submitRegistrationMetric(
        METRIC_EVENT.REGISTRATION_ERROR,
        REG_ACTION.REGISTER,
        METRIC_TYPE.BEHAVIORAL,
        clientError
      );
      expect(mockSubmitClientMetric).toBeCalledOnceWith(
        METRIC_EVENT.REGISTRATION_ERROR,
        expectedData
      );
    });

    it('submit unknown registration metric', () => {
      const logSpy = jest.spyOn(log, 'warn');

      metricManager.submitRegistrationMetric(
        'invalidMetricName' as unknown as METRIC_EVENT,
        REG_ACTION.REGISTER,
        METRIC_TYPE.OPERATIONAL,
        undefined
      );

      expect(mockSubmitClientMetric).not.toBeCalled();
      expect(logSpy).toBeCalledOnceWith(
        'Invalid metric name received. Rejecting request to submit metric.',
        {
          file: 'metric',
          method: 'submitRegistrationMetric',
        }
      );
    });
  });

  describe('Call Metric tests', () => {
    beforeAll(() => {
      metricManager.setDeviceInfo(mockDeviceInfo);
    });

    it('submit call success metric', () => {
      const expectedData = {
        tags: {
          action: mockCallAction,
          device_id: mockDeviceInfo.device.deviceId,
          service_indicator: ServiceIndicator.CALLING,
        },
        fields: {
          device_url: mockDeviceInfo.device.clientDeviceUri,
          mobius_url: mockDeviceInfo.device.uri,
          calling_sdk_version: MOCK_VERSION_NUMBER,
          call_id: mockCallId,
          correlation_id: mockCorrelationId,
        },
        type: METRIC_TYPE.BEHAVIORAL,
      };

      metricManager.submitCallMetric(
        METRIC_EVENT.CALL,
        mockCallAction,
        METRIC_TYPE.BEHAVIORAL,
        mockCallId,
        mockCorrelationId
      );
      expect(mockSubmitClientMetric).toBeCalledOnceWith(METRIC_EVENT.CALL, expectedData);
    });

    it('submit call failure metric', () => {
      const callError = createCallError(
        '',
        {},
        ERROR_TYPE.DEFAULT,
        mockCorrelationId,
        ERROR_LAYER.CALL_CONTROL
      );

      const err = <CallErrorObject>{};

      err.context = {};
      err.message =
        'An invalid status update has been received for the call. Wait a moment and try again.';
      err.type = ERROR_TYPE.FORBIDDEN_ERROR;

      callError.setCallError(err);

      const expectedData = {
        tags: {
          action: mockCallAction,
          device_id: mockDeviceInfo.device.deviceId,
          service_indicator: ServiceIndicator.CALLING,
        },
        fields: {
          device_url: mockDeviceInfo.device.clientDeviceUri,
          mobius_url: mockDeviceInfo.device.uri,
          calling_sdk_version: MOCK_VERSION_NUMBER,
          call_id: mockCallId,
          correlation_id: mockCorrelationId,
          error: callError.getCallError().message,
          error_type: callError.getCallError().type,
        },
        type: METRIC_TYPE.BEHAVIORAL,
      };

      metricManager.submitCallMetric(
        METRIC_EVENT.CALL_ERROR,
        mockCallAction,
        METRIC_TYPE.BEHAVIORAL,
        mockCallId,
        mockCorrelationId,
        callError
      );
      expect(mockSubmitClientMetric).toBeCalledOnceWith(METRIC_EVENT.CALL_ERROR, expectedData);
    });

    it('submit unknown call metric', () => {
      const logSpy = jest.spyOn(log, 'warn');

      metricManager.submitCallMetric(
        'invalidMetricName' as unknown as METRIC_EVENT,
        mockCallAction,
        METRIC_TYPE.OPERATIONAL,
        mockCallId,
        mockCorrelationId
      );

      expect(mockSubmitClientMetric).not.toBeCalled();
      expect(logSpy).toBeCalledOnceWith(
        'Invalid metric name received. Rejecting request to submit metric.',
        {
          file: 'metric',
          method: 'submitCallMetric',
        }
      );
    });
  });

  describe('Media Metric tests', () => {
    const mockSdp = 'sdpInformation';

    beforeAll(() => {
      metricManager.setDeviceInfo(mockDeviceInfo);
    });

    it('submit media success metric', () => {
      const expectedData = {
        tags: {
          action: mockMediaAction,
          device_id: mockDeviceInfo.device.deviceId,
          service_indicator: ServiceIndicator.CALLING,
        },
        fields: {
          device_url: mockDeviceInfo.device.clientDeviceUri,
          mobius_url: mockDeviceInfo.device.uri,
          calling_sdk_version: MOCK_VERSION_NUMBER,
          call_id: mockCallId,
          correlation_id: mockCorrelationId,
          local_media_details: mockSdp,
          remote_media_details: mockSdp,
        },
        type: METRIC_TYPE.BEHAVIORAL,
      };

      metricManager.submitMediaMetric(
        METRIC_EVENT.MEDIA,
        mockMediaAction,
        METRIC_TYPE.BEHAVIORAL,
        mockCallId,
        mockCorrelationId,
        mockSdp,
        mockSdp
      );
      expect(mockSubmitClientMetric).toBeCalledOnceWith(METRIC_EVENT.MEDIA, expectedData);
    });

    it('submit media failure metric', () => {
      const callError = createCallError(
        '',
        {},
        ERROR_TYPE.DEFAULT,
        mockCorrelationId,
        ERROR_LAYER.MEDIA
      );

      const err = <CallErrorObject>{};

      err.context = {};
      err.message =
        'An error occurred while parsing the provided information. Wait a moment and try again.';
      err.type = ERROR_TYPE.SERVICE_UNAVAILABLE;

      callError.setCallError(err);

      const expectedData = {
        tags: {
          action: mockMediaAction,
          device_id: mockDeviceInfo.device.deviceId,
          service_indicator: ServiceIndicator.CALLING,
        },
        fields: {
          device_url: mockDeviceInfo.device.clientDeviceUri,
          mobius_url: mockDeviceInfo.device.uri,
          calling_sdk_version: MOCK_VERSION_NUMBER,
          call_id: mockCallId,
          correlation_id: mockCorrelationId,
          local_media_details: mockSdp,
          remote_media_details: mockSdp,
          error: callError.getCallError().message,
          error_type: callError.getCallError().type,
        },
        type: METRIC_TYPE.BEHAVIORAL,
      };

      metricManager.submitMediaMetric(
        METRIC_EVENT.MEDIA_ERROR,
        mockMediaAction,
        METRIC_TYPE.BEHAVIORAL,
        mockCallId,
        mockCorrelationId,
        mockSdp,
        mockSdp,
        callError
      );
      expect(mockSubmitClientMetric).toBeCalledOnceWith(METRIC_EVENT.MEDIA_ERROR, expectedData);
    });

    it('submit unknown media metric', () => {
      const logSpy = jest.spyOn(log, 'warn');

      metricManager.submitMediaMetric(
        'invalidMetricName' as unknown as METRIC_EVENT,
        mockMediaAction,
        METRIC_TYPE.OPERATIONAL,
        mockCallId,
        mockCorrelationId,
        mockSdp,
        mockSdp
      );

      expect(mockSubmitClientMetric).not.toBeCalled();
      expect(logSpy).toBeCalledOnceWith(
        'Invalid metric name received. Rejecting request to submit metric.',
        {
          file: 'metric',
          method: 'submitMediaMetric',
        }
      );
    });
  });

  describe('BNR metric tests', () => {
    beforeAll(() => {
      metricManager.setDeviceInfo(mockDeviceInfo);
    });

    it('submit bnr enabled metric', () => {
      const expectedData = {
        tags: {
          device_id: mockDeviceInfo.device.deviceId,
          service_indicator: ServiceIndicator.CALLING,
        },
        fields: {
          device_url: mockDeviceInfo.device.clientDeviceUri,
          mobius_url: mockDeviceInfo.device.uri,
          calling_sdk_version: MOCK_VERSION_NUMBER,
          call_id: mockCallId,
          correlation_id: mockCorrelationId,
        },
        type: METRIC_TYPE.BEHAVIORAL,
      };

      metricManager.submitBNRMetric(
        METRIC_EVENT.BNR_ENABLED,
        METRIC_TYPE.BEHAVIORAL,
        mockCallId,
        mockCorrelationId
      );

      expect(mockSubmitClientMetric).toBeCalledOnceWith(METRIC_EVENT.BNR_ENABLED, expectedData);
    });

    it('submit bnr disabled metric', () => {
      const expectedData = {
        tags: {
          device_id: mockDeviceInfo.device.deviceId,
          service_indicator: ServiceIndicator.CALLING,
        },
        fields: {
          device_url: mockDeviceInfo.device.clientDeviceUri,
          mobius_url: mockDeviceInfo.device.uri,
          calling_sdk_version: MOCK_VERSION_NUMBER,
          call_id: mockCallId,
          correlation_id: mockCorrelationId,
        },
        type: METRIC_TYPE.BEHAVIORAL,
      };

      metricManager.submitBNRMetric(
        METRIC_EVENT.BNR_DISABLED,
        METRIC_TYPE.BEHAVIORAL,
        mockCallId,
        mockCorrelationId
      );

      expect(mockSubmitClientMetric).toBeCalledOnceWith(METRIC_EVENT.BNR_DISABLED, expectedData);
    });

    it('submit unknown bnr metric', () => {
      const logSpy = jest.spyOn(log, 'warn');

      metricManager.submitBNRMetric(
        'invalidMetricName' as unknown as METRIC_EVENT,
        METRIC_TYPE.BEHAVIORAL,
        mockCallId,
        mockCorrelationId
      );

      expect(mockSubmitClientMetric).not.toBeCalled();
      expect(logSpy).toBeCalledOnceWith(
        'Invalid metric name received. Rejecting request to submit metric.',
        {
          file: 'metric',
          method: 'submitBNRMetric',
        }
      );
    });
  });

  describe('Voicemail metric tests', () => {
    beforeAll(() => metricManager.setDeviceInfo(mockDeviceInfo));

    it('submit voicemail success metric', () => {
      const expectedData1 = {
        tags: {
          action: VOICEMAIL_ACTION.GET_VOICEMAILS,
          device_id: mockDeviceInfo.device.deviceId,
        },
        fields: {
          device_url: mockDeviceInfo.device.clientDeviceUri,
          calling_sdk_version: MOCK_VERSION_NUMBER,
        },
        type: METRIC_TYPE.BEHAVIORAL,
      };

      metricManager.submitVoicemailMetric(
        METRIC_EVENT.VOICEMAIL,
        VOICEMAIL_ACTION.GET_VOICEMAILS,
        METRIC_TYPE.BEHAVIORAL
      );
      expect(mockSubmitClientMetric).toBeCalledOnceWith(METRIC_EVENT.VOICEMAIL, expectedData1);

      mockSubmitClientMetric.mockClear();

      const expectedData2 = {
        ...expectedData1,
        tags: {...expectedData1.tags, message_id: 'messageId', action: VOICEMAIL_ACTION.DELETE},
      };

      metricManager.submitVoicemailMetric(
        METRIC_EVENT.VOICEMAIL,
        VOICEMAIL_ACTION.DELETE,
        METRIC_TYPE.BEHAVIORAL,
        'messageId'
      );

      expect(mockSubmitClientMetric).toBeCalledOnceWith(METRIC_EVENT.VOICEMAIL, expectedData2);
    });

    it('submit voicemail failure metric', () => {
      const errorMessage = 'User is not authenticated';
      const expectedData1 = {
        tags: {
          action: VOICEMAIL_ACTION.GET_VOICEMAILS,
          device_id: mockDeviceInfo.device.deviceId,
          message_id: undefined,
          error: errorMessage,
          status_code: 401,
        },
        fields: {
          device_url: mockDeviceInfo.device.clientDeviceUri,
          calling_sdk_version: MOCK_VERSION_NUMBER,
        },
        type: METRIC_TYPE.BEHAVIORAL,
      };

      metricManager.submitVoicemailMetric(
        METRIC_EVENT.VOICEMAIL_ERROR,
        VOICEMAIL_ACTION.GET_VOICEMAILS,
        METRIC_TYPE.BEHAVIORAL,
        undefined,
        errorMessage,
        401
      );
      expect(mockSubmitClientMetric).toBeCalledOnceWith(
        METRIC_EVENT.VOICEMAIL_ERROR,
        expectedData1
      );

      mockSubmitClientMetric.mockClear();

      const expectedData2 = {
        ...expectedData1,
        tags: {...expectedData1.tags, message_id: 'messageId', action: VOICEMAIL_ACTION.DELETE},
      };

      metricManager.submitVoicemailMetric(
        METRIC_EVENT.VOICEMAIL_ERROR,
        VOICEMAIL_ACTION.DELETE,
        METRIC_TYPE.BEHAVIORAL,
        'messageId',
        errorMessage,
        401
      );

      expect(mockSubmitClientMetric).toBeCalledOnceWith(
        METRIC_EVENT.VOICEMAIL_ERROR,
        expectedData2
      );
    });

    it('submit unknown voicemail metric', () => {
      const logSpy = jest.spyOn(log, 'warn');

      metricManager.submitVoicemailMetric(
        'invalidMetricName' as unknown as METRIC_EVENT,
        VOICEMAIL_ACTION.GET_VOICEMAILS,
        METRIC_TYPE.BEHAVIORAL
      );

      expect(mockSubmitClientMetric).not.toBeCalled();
      expect(logSpy).toBeCalledOnceWith(
        'Invalid metric name received. Rejecting request to submit metric.',
        {
          file: 'metric',
          method: 'submitVoicemailMetric',
        }
      );
    });
  });

  describe('Calling_Sdk_Version fallback test', () => {
    it('submit metric with fallback version', () => {
      process.env = {};
      metricManager.setDeviceInfo(mockDeviceInfo);
      const expectedData = {
        tags: {
          device_id: mockDeviceInfo.device.deviceId,
          service_indicator: ServiceIndicator.CALLING,
        },
        fields: {
          device_url: mockDeviceInfo.device.clientDeviceUri,
          mobius_url: mockDeviceInfo.device.uri,
          calling_sdk_version: VERSION,
          call_id: mockCallId,
          correlation_id: mockCorrelationId,
        },
        type: METRIC_TYPE.BEHAVIORAL,
      };

      metricManager.submitBNRMetric(
        METRIC_EVENT.BNR_ENABLED,
        METRIC_TYPE.BEHAVIORAL,
        mockCallId,
        mockCorrelationId
      );

      expect(mockSubmitClientMetric).toBeCalledOnceWith(METRIC_EVENT.BNR_ENABLED, expectedData);
    });
  });
});
