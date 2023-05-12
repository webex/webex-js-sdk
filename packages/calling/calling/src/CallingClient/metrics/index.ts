import {CallError, CallingClientError} from 'Errors';
import {METRIC_FILE, VERSION} from '../constants';
import {CallId, CorrelationId, IDeviceInfo, ServiceIndicator} from '../../common/types';
import {WebexSDK} from '../../SDKConnector/types';
import {REG_ACTION, IMetricManager, METRIC_TYPE, METRIC_EVENT} from './types';
import log from '../../Logger';

let metricManager: IMetricManager;

/**
 *
 */
class MetricManager implements IMetricManager {
  private webex: WebexSDK;

  private deviceInfo?: IDeviceInfo;

  private serviceIndicator: ServiceIndicator;

  /**
   * @param webex - Webex object used to send metrics.
   * @param indicator - Service Indicator.
   */
  public constructor(webex: WebexSDK, indicator: ServiceIndicator) {
    log.info('Initializing metric manager...', {file: METRIC_FILE});
    this.webex = webex;
    this.serviceIndicator = indicator;
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
    clientError: CallingClientError | undefined
  ) {
    let data;

    switch (name) {
      case METRIC_EVENT.REGISTRATION: {
        data = {
          tags: {
            action: metricAction,
            device_id: this.deviceInfo?.device?.deviceId,
            service_indicator: this.serviceIndicator,
          },
          fields: {
            device_url: this.deviceInfo?.device?.clientDeviceUri,
            mobius_url: this.deviceInfo?.device?.uri,
            calling_sdk_version: VERSION,
          },
          type,
        };
        break;
      }

      case METRIC_EVENT.REGISTRATION_ERROR: {
        if (clientError) {
          data = {
            tags: {
              action: metricAction,
              device_id: this.deviceInfo?.device?.deviceId,
              service_indicator: this.serviceIndicator,
            },
            fields: {
              device_url: this.deviceInfo?.device?.clientDeviceUri,
              mobius_url: this.deviceInfo?.device?.uri,
              calling_sdk_version: VERSION,
              error: clientError.getError().message,
              error_type: clientError.getError().type,
            },
            type,
          };
        }
        break;
      }

      default:
        log.warn('Invalid metric name received. Rejecting request to submit metric.', {
          file: METRIC_FILE,
          method: this.submitRegistrationMetric.name,
        });
        break;
    }

    if (data) {
      this.webex.internal.metrics.submitClientMetrics(name, data);
    }
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
    callError: CallError | undefined
  ) {
    let data;

    switch (name) {
      case METRIC_EVENT.CALL: {
        data = {
          tags: {
            action: metricAction,
            device_id: this.deviceInfo?.device?.deviceId,
            service_indicator: this.serviceIndicator,
          },
          fields: {
            device_url: this.deviceInfo?.device?.clientDeviceUri,
            mobius_url: this.deviceInfo?.device?.uri,
            calling_sdk_version: VERSION,
            call_id: callId,
            correlation_id: correlationId,
          },
          type,
        };
        break;
      }

      case METRIC_EVENT.CALL_ERROR: {
        if (callError) {
          data = {
            tags: {
              action: metricAction,
              device_id: this.deviceInfo?.device?.deviceId,
              service_indicator: this.serviceIndicator,
            },
            fields: {
              device_url: this.deviceInfo?.device?.clientDeviceUri,
              mobius_url: this.deviceInfo?.device?.uri,
              calling_sdk_version: VERSION,
              call_id: callId,
              correlation_id: correlationId,
              error: callError.getCallError().message,
              error_type: callError.getCallError().type,
            },
            type,
          };
        }
        break;
      }

      default:
        log.warn('Invalid metric name received. Rejecting request to submit metric.', {
          file: METRIC_FILE,
          method: this.submitCallMetric.name,
        });
        break;
    }

    if (data) {
      this.webex.internal.metrics.submitClientMetrics(name, data);
    }
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
    localSdp: string | undefined,
    remoteSdp: string | undefined,
    callError: CallError | undefined
  ) {
    let data;

    switch (name) {
      case METRIC_EVENT.MEDIA: {
        data = {
          tags: {
            action: metricAction,
            device_id: this.deviceInfo?.device?.deviceId,
            service_indicator: this.serviceIndicator,
          },
          fields: {
            device_url: this.deviceInfo?.device?.clientDeviceUri,
            mobius_url: this.deviceInfo?.device?.uri,
            calling_sdk_version: VERSION,
            call_id: callId,
            correlation_id: correlationId,
            local_media_details: localSdp,
            remote_media_details: remoteSdp,
          },
          type,
        };
        break;
      }

      case METRIC_EVENT.MEDIA_ERROR: {
        if (callError) {
          data = {
            tags: {
              action: metricAction,
              device_id: this.deviceInfo?.device?.deviceId,
              service_indicator: this.serviceIndicator,
            },
            fields: {
              device_url: this.deviceInfo?.device?.clientDeviceUri,
              mobius_url: this.deviceInfo?.device?.uri,
              calling_sdk_version: VERSION,
              call_id: callId,
              correlation_id: correlationId,
              local_media_details: localSdp,
              remote_media_details: remoteSdp,
              error: callError.getCallError().message,
              error_type: callError.getCallError().type,
            },
            type,
          };
        }
        break;
      }

      default:
        log.warn('Invalid metric name received. Rejecting request to submit metric.', {
          file: METRIC_FILE,
          method: this.submitMediaMetric.name,
        });
        break;
    }

    if (data) {
      this.webex.internal.metrics.submitClientMetrics(name, data);
    }
  }
}

/**
 * @param webex - Webex object to communicate with metrics microservice.
 * @param indicator - Service Indicator.
 */
export const getMetricManager = (webex: WebexSDK, indicator: ServiceIndicator): IMetricManager => {
  if (!metricManager) {
    metricManager = new MetricManager(webex, indicator);
  }

  return metricManager;
};
