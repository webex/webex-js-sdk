// This file can include common request to the API. Request method can be updated in the future based on needs.

import {HTTP_METHODS, WebexSDK} from './types';

export default class Request {
  webex: WebexSDK;

  constructor(webex: WebexSDK) {
    this.webex = webex;
  }

  /**
   * Common method to make HTTP Requests.
   * @returns {Promise<any>} A promise that eventually resolves to an API response.
   * @example
   * Create an instance of a class Request by passing webex object and call the request method.
   * const request = Request(webexObject);
   * const response = await request.request('apiURL', '');
   * console.log(response);
   */

  public async request(URL: string, requestMethod: string, body: object = {}): Promise<any> {
    try {
      let response;
      switch (requestMethod) {
        case HTTP_METHODS.GET: {
          response = await this.webex.request({
            method: requestMethod,
            uri: URL,
          });
          break;
        }
        case HTTP_METHODS.POST: {
          response = await this.webex.request({
            method: requestMethod,
            uri: URL,
            body,
          });
          break;
        }
      }

      return Promise.resolve(response);
    } catch (error) {
      throw new Error(`Error while making request: ${error}`);
    }
  }
}
