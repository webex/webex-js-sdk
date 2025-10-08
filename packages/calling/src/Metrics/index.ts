import {CallError, CallingClientError} from '../Errors';
import {METRIC_FILE, VERSION} from '../CallingClient/constants';
import {CallId, CorrelationId, IDeviceInfo, MobiusServers, ServiceIndicator} from '../common/types';
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

  public submitUploadLogsMetric(
    name: METRIC_EVENT,
    action: string,
    type: METRIC_TYPE,
    trackingId?: string,
    feedbackId?: string,
    correlationId?: string,
    stack?: string,
    callId?: string,
    broadworksCorrelationInfo?: string
  ) {
    let data;

    const commonData = {
      tags: {
        action,
        device_id: this.deviceInfo?.device?.deviceId,
        service_indicator: this.serviceIndicator,
      },
      fields: {
        device_url: this.deviceInfo?.device?.clientDeviceUri,
        mobius_url: this.deviceInfo?.device?.uri,
        calling_sdk_version: process.env.CALLING_SDK_VERSION || VERSION,
        correlation_id: correlationId,
        broadworksCorrelationInfo,
        tracking_id: trackingId,
        feedback_id: feedbackId,
        call_id: callId,
      },
      type,
    };

    switch (name) {
      case METRIC_EVENT.UPLOAD_LOGS_SUCCESS: {
        data = commonData;

        break;
      }

      case METRIC_EVENT.UPLOAD_LOGS_FAILED: {
        data = {
          ...commonData,
          fields: {
            ...commonData.fields,
            error: stack,
          },
        };

        break;
      }
    }

    if (data) {
      this.webex.internal.metrics.submitClientMetrics(name, data);
    }
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
   * @param region - Region string.
   * @param trackingId - Tracking ID string.
   */
  public submitRegionInfoMetric(
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    mobiusHost: string,
    clientRegion: string,
    countryCode: string,
    trackingId?: string
  ) {
    const data = {
      tags: {
        action: metricAction,
        device_id: this.deviceInfo?.device?.deviceId,
        service_indicator: ServiceIndicator.CALLING,
      },
      fields: {
        device_url: this.deviceInfo?.device?.clientDeviceUri,
        mobius_url: this.deviceInfo?.device?.uri,
        calling_sdk_version: process.env.CALLING_SDK_VERSION || VERSION,
        mobius_host: mobiusHost,
        client_region: clientRegion,
        country_code: countryCode,
        tracking_id: trackingId,
      },
      type,
    };

    this.webex.internal.metrics.submitClientMetrics(name, data);
  }

  /**
   * @param name - Name of the metric being submitted.
   * @param metricAction - Type of action sent in the metric.
   * @param type - Type of metric.
   * @param mobiusServers - Array of Mobius server objects.
   */
  public submitMobiusServersMetric(
    name: METRIC_EVENT,
    metricAction: string,
    type: METRIC_TYPE,
    mobiusServers: MobiusServers,
    trackingId?: string
  ) {
    const data = {
      tags: {
        action: metricAction,
        device_id: this.deviceInfo?.device?.deviceId,
        service_indicator: ServiceIndicator.CALLING,
      },
      fields: {
        device_url: this.deviceInfo?.device?.clientDeviceUri,
        mobius_url: this.deviceInfo?.device?.uri,
        calling_sdk_version: process.env.CALLING_SDK_VERSION || VERSION,
        primary_mobius_servers_region: mobiusServers.primary.region,
        primary_mobius_servers_uris: mobiusServers.primary.uris.join(','),
        backup_mobius_servers_region: mobiusServers.backup.region,
        backup_mobius_servers_uris: mobiusServers.backup.uris.join(','),
        tracking_id: trackingId,
      },
      type,
    };

    this.webex.internal.metrics.submitClientMetrics(name, data);
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
            calling_sdk_version: process.env.CALLING_SDK_VERSION || VERSION,
            reg_source: caller,
            server_type: serverType,
            trackingId,
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
              calling_sdk_version: process.env.CALLING_SDK_VERSION || VERSION,
              reg_source: caller,
              server_type: serverType,
              trackingId,
              keepalive_count: keepaliveCount,
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
    callError?: CallError
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
            calling_sdk_version: process.env.CALLING_SDK_VERSION || VERSION,
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
              calling_sdk_version: process.env.CALLING_SDK_VERSION || VERSION,
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
    localSdp?: string,
    remoteSdp?: string,
    callError?: CallError
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
            calling_sdk_version: process.env.CALLING_SDK_VERSION || VERSION,
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
              calling_sdk_version: process.env.CALLING_SDK_VERSION || VERSION,
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
    let data;

    switch (name) {
      case METRIC_EVENT.VOICEMAIL: {
        data = {
          tags: {
            action: metricAction,
            device_id: this.deviceInfo?.device?.deviceId,
            message_id: messageId,
          },
          fields: {
            device_url: this.deviceInfo?.device?.clientDeviceUri,
            calling_sdk_version:
              typeof process !== 'undefined' && process.env.CALLING_SDK_VERSION
                ? process.env.CALLING_SDK_VERSION
                : VERSION,
          },
          type,
        };
        break;
      }

      case METRIC_EVENT.VOICEMAIL_ERROR: {
        data = {
          tags: {
            action: metricAction,
            device_id: this.deviceInfo?.device?.deviceId,
            message_id: messageId,
            error: voicemailError,
            status_code: statusCode,
          },
          fields: {
            device_url: this.deviceInfo?.device?.clientDeviceUri,
            calling_sdk_version:
              typeof process !== 'undefined' && process.env.CALLING_SDK_VERSION
                ? process.env.CALLING_SDK_VERSION
                : VERSION,
          },
          type,
        };
        break;
      }

      default:
        log.warn('Invalid metric name received. Rejecting request to submit metric.', {
          file: METRIC_FILE,
          method: this.submitVoicemailMetric.name,
        });
        break;
    }
    if (data) {
      this.webex.internal.metrics.submitClientMetrics(name, data);
    }
  }

  public submitBNRMetric(
    name: METRIC_EVENT,
    type: METRIC_TYPE,
    callId: CallId,
    correlationId: CorrelationId
  ) {
    let data;

    if (name === METRIC_EVENT.BNR_ENABLED || name === METRIC_EVENT.BNR_DISABLED) {
      data = {
        tags: {
          device_id: this.deviceInfo?.device?.deviceId,
          service_indicator: this.serviceIndicator,
        },
        fields: {
          device_url: this.deviceInfo?.device?.clientDeviceUri,
          mobius_url: this.deviceInfo?.device?.uri,
          calling_sdk_version: process.env.CALLING_SDK_VERSION || VERSION,
          call_id: callId,
          correlation_id: correlationId,
        },
        type,
      };
    } else {
      log.warn('Invalid metric name received. Rejecting request to submit metric.', {
        file: METRIC_FILE,
        method: this.submitBNRMetric.name,
      });
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
