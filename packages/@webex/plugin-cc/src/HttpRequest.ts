// This file can include common request to the API. Request method can be updated in the future based on needs.

import {HTTP_METHODS, IHttpResponse, WebexSDK} from './types';

export default class HttpRequest {
  webex: WebexSDK;

  constructor(webex: WebexSDK) {
    this.webex = webex;
  }

  /**
   * Common method to make HTTP Requests.
   * @returns {Promise<IHttpResponse>} Returns the response from the API.
   * @example
   * Create an instance of a class HttpRequest by passing webex object and call the request method.
   * const httpRequest = HttpRequest(webexObject);
   * const response = await httpRequest.request('apiURL', 'GET', {id: '123', name: 'test'});
   */

  public async request(URL: string, method: string, body: object = {}): Promise<IHttpResponse> {
    try {
      let response;
      switch (method) {
        case HTTP_METHODS.GET: {
          response = await this.webex.request({
            method,
            uri: URL,
          });
          break;
        }
        case HTTP_METHODS.POST: {
          response = await this.webex.request({
            method,
            uri: URL,
            body,
          });
          break;
        }
        default: {
          throw new Error(`Unsupported HTTP method: ${method}`);
        }
      }

      return Promise.resolve(response);
    } catch (error) {
      throw new Error(`Error while making request: ${error}`);
    }
  }
}
