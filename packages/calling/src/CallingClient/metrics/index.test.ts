/* eslint-disable dot-notation */
import {getMockDeviceInfo, getTestUtilsWebex} from '../../common/testUtil';
import {getMetricManager} from '.';
import {METRIC_TYPE, METRIC_EVENT, REG_ACTION} from './types';
import {VERSION} from '../constants';
import {createClientError} from '../../Errors/catalog/CallingDeviceError';
import {CallErrorObject, ErrorObject, ERROR_LAYER, ERROR_TYPE} from '../../Errors/types';
import {MobiusStatus, ServiceIndicator} from '../../common/types';
import log from '../../Logger';
import {createCallError} from '../../Errors/catalog/CallError';

const webex = getTestUtilsWebex();

describe('CALLING: Metric tests', () => {
  const metricManager = getMetricManager(webex, ServiceIndicator.CALLING);
  const mockDeviceInfo = getMockDeviceInfo();
  const mockSubmitClientMetric = jest.fn();

  webex.internal.metrics.submitClientMetrics = mockSubmitClientMetric;

  const mockCallId = '123456';
  const mockCorrelationId = '0931237';
  const mockCallAction = 'S_SEND_CALL_SETUP';
  const mockMediaAction = 'S_SEND_ROAP_OFFER';

  beforeEach(() => {
    mockSubmitClientMetric.mockClear();
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
          calling_sdk_version: VERSION,
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

      const clientError = createClientError('', {}, ERROR_TYPE.DEFAULT, MobiusStatus.DEFAULT);
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
          calling_sdk_version: VERSION,
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
      expect(logSpy).toBeCalledTimes(1);
      expect(logSpy).toBeCalledWith(
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
          calling_sdk_version: VERSION,
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
        mockCorrelationId,
        undefined
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
          calling_sdk_version: VERSION,
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
        mockCorrelationId,
        undefined
      );

      expect(mockSubmitClientMetric).not.toBeCalled();
      expect(logSpy).toBeCalledTimes(1);
      expect(logSpy).toBeCalledWith(
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
          calling_sdk_version: VERSION,
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
        mockSdp,
        undefined
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
          calling_sdk_version: VERSION,
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
        mockSdp,
        undefined
      );

      expect(mockSubmitClientMetric).not.toBeCalled();
      expect(logSpy).toBeCalledTimes(1);
      expect(logSpy).toBeCalledWith(
        'Invalid metric name received. Rejecting request to submit metric.',
        {
          file: 'metric',
          method: 'submitMediaMetric',
        }
      );
    });
  });
});
