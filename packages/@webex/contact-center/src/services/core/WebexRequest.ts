import {WEBEX_REQUEST_FILE} from '../../constants';
import LoggerProxy from '../../logger-proxy';
import {METHODS} from './constants';
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
  private static instances = new WeakMap<WebexSDK, WebexRequest>();

  public static getInstance(options?: {webex: WebexSDK}): WebexRequest {
    if (options?.webex) {
      const existingInstance = WebexRequest.instances.get(options.webex);

      if (existingInstance) {
        WebexRequest.instance = existingInstance;

        return existingInstance;
      }

      const instance = new WebexRequest(options);
      WebexRequest.instances.set(options.webex, instance);
      WebexRequest.instance = instance;

      return instance;
    }

    return WebexRequest.instance;
  }

  private constructor(options: {webex: WebexSDK}) {
    const {webex} = options;
    this.webex = webex;
  }

  public async request(options: {
    service?: string;
    resource?: string;
    uri?: string;
    method: HTTP_METHODS;
    body?: RequestBody;
    headers?: Record<string, string | null>;
    addAuthHeader?: boolean;
    timeout?: number;
  }): Promise<IHttpResponse> {
    const {service, resource, uri, method, body, headers, addAuthHeader, timeout} = options;

    return this.webex.request({
      ...(service !== undefined ? {service} : {}),
      ...(resource !== undefined ? {resource} : {}),
      ...(uri !== undefined ? {uri} : {}),
      method,
      body,
      ...(headers ? {headers} : {}),
      ...(addAuthHeader !== undefined ? {addAuthHeader} : {}),
      ...(timeout !== undefined ? {timeout} : {}),
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
        method: METHODS.UPLOAD_LOGS,
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
        method: METHODS.UPLOAD_LOGS,
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
