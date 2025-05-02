import {WEBEX_REQUEST_FILE} from '../../constants';
import LoggerProxy from '../../logger-proxy';
import {METRIC_EVENT_NAMES} from '../../metrics/constants';
import MetricsManager from '../../metrics/MetricsManager';
import {
  WebexSDK,
  HTTP_METHODS,
  IHttpResponse,
  RequestBody,
  UploadLogsResponse,
  LogsMetaData,
} from '../../types';

class WebexRequest {
  private webex: WebexSDK;
  private static instance: WebexRequest;

  public static getInstance(options?: {webex: WebexSDK}): WebexRequest {
    if (!WebexRequest.instance && options && options.webex) {
      WebexRequest.instance = new WebexRequest(options);
    }

    return WebexRequest.instance;
  }

  private constructor(options: {webex: WebexSDK}) {
    const {webex} = options;
    this.webex = webex;
  }

  public async request(options: {
    service: string;
    resource: string;
    method: HTTP_METHODS;
    body?: RequestBody;
  }): Promise<IHttpResponse> {
    const {service, resource, method, body} = options;

    return this.webex.request({
      service,
      resource,
      method,
      body,
    });
  }

  /**
   * This is used for uploading the logs to backend/mats.
   *
   * @param metaData - meta data to be uploaded.
   */
  public async uploadLogs(metaData: LogsMetaData = {}): Promise<UploadLogsResponse> {
    const feedbackId = crypto.randomUUID();
    try {
      const response = await this.webex.internal.support.submitLogs(
        {...metaData, feedbackId},
        undefined, // we dont send logs but take from webex logger
        {type: 'diff'} // this is to take the diff logs from previous upload
      );
      LoggerProxy.info(`Logs uploaded successfully with feedbackId: ${feedbackId}`, {
        module: WEBEX_REQUEST_FILE,
        method: 'uploadLogs',
      });

      MetricsManager.getInstance().trackEvent(
        METRIC_EVENT_NAMES.UPLOAD_LOGS_SUCCESS,
        {
          trackingId: response?.trackingid,
          feedbackId,
          correlationId: metaData?.correlationId,
        },
        ['behavioral']
      );

      return {
        trackingid: response.trackingid,
        ...(response.url ? {url: response.url} : {}),
        ...(response.userId ? {userId: response.userId} : {}),
        ...(response.correlationId ? {correlationId: response.correlationId} : {}),
        feedbackId,
      };
    } catch (error) {
      LoggerProxy.error(`Error uploading logs: ${error}`, {
        module: WEBEX_REQUEST_FILE,
        method: 'uploadLogs',
      });

      MetricsManager.getInstance().trackEvent(
        METRIC_EVENT_NAMES.UPLOAD_LOGS_FAILED,
        {
          stack: error?.stack,
          feedbackId,
          correlationId: metaData?.correlationId,
        },
        ['behavioral']
      );
      throw error;
    }
  }
}

export default WebexRequest;
