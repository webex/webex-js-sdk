/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

 /* eslint no-console:[0] */

import {get, has, isArray, isString, omit} from 'lodash';
import util from 'util';
import {Interceptor} from '@ciscospark/http-core';

/**
 * @class
 */
export default class RequestLoggerInterceptor extends Interceptor {
  /**
   * @returns {RequestLoggerInterceptor}
   */
  static create() {
    return new RequestLoggerInterceptor(this);
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    console.log(`/**********************************************************************\\ `);
    console.log(`Request:`, options.method || `GET`, options.uri);
    console.log(`WEBEX_TRACKINGID: `, get(options, `headers.trackingid`));
    /* istanbul ignore next */
    if (has(options, `headers.x-trans-id`)) {
      console.log(`X-Trans-ID: `, get(options, `headers.x-trans-id`));
    }
    if (has(this, `spark.device.userId`)) {
      console.log(`User ID:`, get(this, `spark.device.userId`));
    }
    const now = new Date();
    if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
      console.log(`timestamp (start): `, now.getTime(), now.toISOString());
      try {
        // Determine if body is a buffer without relying on Buffer to avoid
        // node/browser conflicts.
        if (options.body && options.body.length && !isArray(options.body) && !isString(options.body)) {
          console.log(`Request Options:`, util.inspect(omit(options, `body`), {depth: null}));
        }
        else {
          console.log(`Request Options:`, util.inspect(options, {depth: null}));
        }
      }
      catch (e) {
        console.warn(`Could not stringify request options:`, e);
      }
    }

    return Promise.resolve(options);
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @param {Error} reason
   * @returns {Object}
   */
  onRequestError(options, reason) {
    // We need to do the normal onRequest logging, but then log how the request
    // failed since the response logger won't be called.
    this.onRequest(options);
    console.error(`Request Failed: `, reason.stack);
    console.log(`\\**********************************************************************/`);

    return Promise.reject(reason);
  }
}
