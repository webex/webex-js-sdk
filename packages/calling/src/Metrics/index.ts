import {CallError, CallingClientError} from '../Errors';
import {METRIC_FILE, VERSION} from '../CallingClient/constants';
import {CallId, CorrelationId, IDeviceInfo, ServiceIndicator} from '../common/types';
import {WebexSDK} from '../SDKConnector/types';
import {REG_ACTION, IMetricManager, METRIC_TYPE, METRIC_EVENT, SERVER_TYPE} from './types';
import {LineError} from '../Errors/catalog/LineError';
import log from '../Logger';

let metricManager: IMetricManager;

/**
 *
 */
class MetricManager implements IMetricManager {
  private webex: WebexSDK;

  private deviceInfo?: IDeviceInfo;

  private serviceIndicator?: ServiceIndicator;

  /**
   * @param webex - Webex object used to send metrics.
   * @param indicator - Service Indicator.
   */
  public constructor(webex: WebexSDK, indicator?: ServiceIndicator) {
    log.info('Initializing metric manager...', {file: METRIC_FILE});
    this.webex = webex;
    this.serviceIndicator = indicator;
  }

  /**
   * Creates a base metric object with common fields and tags.
   * @param action - The action for the metric tag.
   * @param type - The type of the metric.
   * @returns A base metric data object.
   */
  private createBaseMetric(action: string, type: METRIC_TYPE) {
    const fields: {[key: string]: any} = {
      device_url: this.deviceInfo?.device?.clientDeviceUri,
      mobius_url: this.deviceInfo?.device?.uri,
      calling_sdk_version: process.env.CALLING_SDK_VERSION || VERSION,
    };

    return {
      tags: {
        action,
        device_id: this.deviceInfo?.device?.deviceId,
        service_indicator: this.serviceIndicator,
      },
      fields,
      type,
    };
  }

  public submitUploadLogsMetric(
    name: METRIC_EVENT,
    action: string,
    type: METRIC_TYPE,
    trackingId?: string,
    feedbackId?: string,
    correlationId?: string,
    stack?: string,
    callId?: string
  ) {
    const data = this.createBaseMetric(action, type);
    data.fields.correlation_id = correlationId;
    data.fields.tracking_id = trackingId;
    data.fields.feedback_id = feedbackId;
    data.fields.call_id = callId;

    if (name === METRIC_EVENT.UPLOAD_LOGS_FAILED) {
      data.fields.error = stack;
    } else if (name !== METRIC_EVENT.UPLOAD_LOGS_SUCCESS) {
      log.warn('Invalid metric name for upload logs metric.', {
        file: METRIC_FILE,
        method: 'submitUploadLogsMetric',
      });

      return;
    }

    this.webex.internal.metrics.submitClientMetrics(name, data);
  }

  /**
   * @param deviceInfo - DeviceInfo object.
   */
  public setDeviceInfo(deviceInfo: IDeviceInfo) {
    this.deviceInfo = deviceInfo;
  }

  /**
   * @param name - Name of the metric being submitted.
   * @param metricAction - Type of action sent in the metric.
   * @param type - Type of metric.
   * @param clientError - Error object used to populate error details in metric.
   */
  public submitRegistrationMetric(
    name: METRIC_EVENT,
    metricAction: REG_ACTION,
    type: METRIC_TYPE,
    caller: string,
    serverType: SERVER_TYPE,
    trackingId: string,
    keepaliveCount?: number,
    clientError?: LineError | CallingClientError
  ) {
    const data = this.createBaseMetric(metricAction, type);
    data.fields.reg_source = caller;
    data.fields.server_type = serverType;
    data.fields.trackingId = trackingId;

    if (name === METRIC_EVENT.REGISTRATION_ERROR && clientError) {
      data.fields.keepalive_count = keepaliveCount;
      data.fields.error = clientError.getError().message;
      data.fields.error_type = clientError.getError().type;
    } else if (name !== METRIC_EVENT.REGISTRATION) {
      log.warn('Invalid metric name for registration metric.', {
        file: METRIC_FILE,
        method: 'submitRegistrationMetric',
      });

      return;
    }

    this.webex.internal.metrics.submitClientMetrics(name, data);
  }

  /**
   * @param name - Name of the metric being submitted.
   * @param metricAction - Type of action sent in the metric.
   * @param type - Type of metric.
   * @param callId - Call ID of the call sending the metric.
   * @param correlationId - Correlation ID of the call sending the metric.
   * @param callError - Error object used to populate error details in metric.
   */
  public submitCallMetric(
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    callId: CallId,
    correlationId: CorrelationId,
    callError?: CallError
  ) {
    const data = this.createBaseMetric(metricAction, type);
    data.fields.call_id = callId;
    data.fields.correlation_id = correlationId;

    if (name === METRIC_EVENT.CALL_ERROR && callError) {
      data.fields.error = callError.getCallError().message;
      data.fields.error_type = callError.getCallError().type;
    } else if (name !== METRIC_EVENT.CALL) {
      log.warn('Invalid metric name for call metric.', {
        file: METRIC_FILE,
        method: 'submitCallMetric',
      });

      return;
    }

    this.webex.internal.metrics.submitClientMetrics(name, data);
  }

  /**
   * @param name - Name of the metric being submitted.
   * @param metricAction - Type of action sent in the metric.
   * @param type - Type of metric.
   * @param callId - Call ID of the call sending the metric.
   * @param correlationId - Correlation ID of the call sending the metric.
   * @param localSdp - Local SDP information for media metric.
   * @param remoteSdp - Remote SDP information for media metric.
   * @param callError - Error object used to populate error details in metric.
   */
  public submitMediaMetric(
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    callId: CallId,
    correlationId: CorrelationId,
    localSdp?: string,
    remoteSdp?: string,
    callError?: CallError
  ) {
    const data = this.createBaseMetric(metricAction, type);
    data.fields.call_id = callId;
    data.fields.correlation_id = correlationId;
    data.fields.local_media_details = localSdp;
    data.fields.remote_media_details = remoteSdp;

    if (name === METRIC_EVENT.MEDIA_ERROR && callError) {
      data.fields.error = callError.getCallError().message;
      data.fields.error_type = callError.getCallError().type;
    } else if (name !== METRIC_EVENT.MEDIA) {
      log.warn('Invalid metric name for media metric.', {
        file: METRIC_FILE,
        method: 'submitMediaMetric',
      });

      return;
    }

    this.webex.internal.metrics.submitClientMetrics(name, data);
  }

  /**
   * @param name - Name of the metric being submitted.
   * @param metricAction - Type of action sent in the metric.
   * @param type - Type of metric.
   * @param messageId - Message identifier of a Voicemail message.
   * @param voicemailError - Error string used to populate error details in metric.
   * @param statusCode - Status code used to populate error details in metric.
   */
  public submitVoicemailMetric(
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    messageId?: string,
    voicemailError?: string,
    statusCode?: number
  ) {
    if (name !== METRIC_EVENT.VOICEMAIL && name !== METRIC_EVENT.VOICEMAIL_ERROR) {
      log.warn('Invalid metric name received. Rejecting request to submit metric.', {
        file: METRIC_FILE,
        method: this.submitVoicemailMetric.name,
      });

      return;
    }

    const data = this.createBaseMetric(metricAction, type);

    if (messageId) {
      // @ts-ignore
      data.tags.message_id = messageId;
    }

    if (name === METRIC_EVENT.VOICEMAIL_ERROR) {
      data.fields.error = voicemailError;
      data.fields.status_code = statusCode;
    }

    this.webex.internal.metrics.submitClientMetrics(name, data);
  }

  public submitBNRMetric(
    name: METRIC_EVENT,
    type: METRIC_TYPE,
    callId: CallId,
    correlationId: CorrelationId
  ) {
    if (name !== METRIC_EVENT.BNR_ENABLED && name !== METRIC_EVENT.BNR_DISABLED) {
      log.warn('Invalid metric name received. Rejecting request to submit metric.', {
        file: METRIC_FILE,
        method: this.submitBNRMetric.name,
      });

      return;
    }

    const data = this.createBaseMetric(name, type);
    data.fields.call_id = callId;
    data.fields.correlation_id = correlationId;

    this.webex.internal.metrics.submitClientMetrics(name, data);
  }
}

/**
 * @param webex - Webex object to communicate with metrics microservice.
 * @param indicator - Service Indicator.
 */
export const getMetricManager = (
  webex?: WebexSDK,
  indicator?: ServiceIndicator
): IMetricManager => {
  if (!metricManager && webex) {
    metricManager = new MetricManager(webex, indicator);
  }

  return metricManager;
};

export default getMetricManager;
