/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {get, omit} from 'lodash';
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
    return new ResponseLoggerInterceptor({spark: this});
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

    const logger = get(this, `spark.logger`, console);
    if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
      logger.log(`timestamp (end): `, now.getTime(), now.toISOString());
      if (typeof response.body === `string` || Buffer.isBuffer(response.body)) {
        logger.log(`Response: `, `Not printed, it\`s probably a file`);
      }
      else if (typeof response.body === `object`) {
        try {
          logger.log(`Response: `, util.inspect(omit(response.body, `features`), {depth: null}));
        }
        catch (err) {
          logger.log(`Response: `, `[Not Serializable]`, err);
        }
      }
    }
    logger.log(`\\**********************************************************************/`);

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

    const logger = get(this, `spark.logger`, console);
    if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
      logger.log(`timestamp (end): `, now.getTime(), now.toISOString());
      try {
        logger.error(`Response: `, util.inspect(reason.body, {depth: null}));
      }
      catch (err) {
        logger.error(`Response: `, reason.body);
      }
    }
    logger.log(`\\**********************************************************************/`);

    return Promise.reject(reason);
  }

  /**
   * Prints the basic header
   * @param {Object} options
   * @param {HttpResponse|SparkHttpError} response
   * @returns {undefined}
   */
  printResponseHeader(options, response) {
    const logger = get(this, `spark.logger`, console);
    logger.log(`Status Code:`, response.statusCode);
    logger.log(`WEBEX_TRACKINGID:`, get(options, `headers.trackingid`) || get(response, `headers.trackingid`));
    logger.log(`Network duration:`, options.$timings.networkEnd - options.$timings.networkStart);
    logger.log(`Processing duration:`, options.$timings.requestEnd - options.$timings.requestStart);
  }
}
