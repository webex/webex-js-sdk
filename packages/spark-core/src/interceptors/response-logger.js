/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

 /* eslint no-console:[0] */

import {get} from 'lodash';
import util from 'util';
import {Interceptor} from '@ciscospark/http-core';

/**
 * @class
 */
export default class ResponseLoggerInterceptor extends Interceptor {
  /**
   * @returns {ResponseLoggerInterceptor}
   */
  static create() {
    return new ResponseLoggerInterceptor(this);
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @param {HttpResponse} response
   * @returns {Object}
   */
  onResponse(options, response) {
    const now = new Date();
    this.printResponseHeader(options, response);

    if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
      console.log(`timestamp (end): `, now.getTime(), now.toISOString());

      if (typeof response.body === `string` || Buffer.isBuffer(response.body)) {
        console.log(`Response: `, `Not printed, it\`s probably a file`);
      }
      else if (typeof response.body === `object`) {
        try {
          console.log(`Response: `, util.inspect(options, {depth: null}));
        }
        catch (err) {
          console.log(`Response: `, `[Not Serializable]`, err);
        }
      }
    }
    console.log(`\\**********************************************************************/`);

    return response;
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @param {Object} reason
   * @returns {Object}
   */
  onResponseError(options, reason) {
    const now = new Date();
    this.printResponseHeader(options, reason);

    if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
      console.log(`timestamp (end): `, now.getTime(), now.toISOString());
      try {
        console.error(`Response: `, util.inspect(reason.body, {depth: null}));
      }
      catch (err) {
        console.error(`Response: `, reason.body);
      }
    }
    console.log(`\\**********************************************************************/`);

    return Promise.reject(reason);
  }

  /**
   * Prints the basic header
   * @param {Object} options
   * @param {HttpResponse|SparkHttpError} response
   * @returns {undefined}
   */
  printResponseHeader(options, response) {
    console.log(`Status Code:`, response.statusCode);
    console.log(`WEBEX_TRACKINGID:`, get(options, `headers.trackingid`) || get(response, `headers.trackingid`));
    console.log(`Network duration:`, options.$timings.networkEnd - options.$timings.networkStart);
    console.log(`Processing duration:`, options.$timings.requestEnd - options.$timings.requestStart);
  }
}
