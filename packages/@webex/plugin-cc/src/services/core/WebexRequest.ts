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
   * Uploads logs to backend/mats.
   *
   * @param metaData - meta data to be uploaded.
   */
  public async uploadLogs(metaData: LogsMetaData): Promise<UploadLogsResponse> {
    return this.webex.internal.support.submitLogs(metaData);
  }
}

export default WebexRequest;
