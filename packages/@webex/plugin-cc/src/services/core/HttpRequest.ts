import {WebexSDK, HTTP_METHODS, IHttpResponse, RequestBody} from '../../types';

class HttpRequest {
  private webex: WebexSDK;
  private static instance: HttpRequest;

  public static getInstance(options?: {webex: WebexSDK}): HttpRequest {
    if (!HttpRequest.instance && options && options.webex) {
      HttpRequest.instance = new HttpRequest(options);
    }

    return HttpRequest.instance;
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
}

export default HttpRequest;
