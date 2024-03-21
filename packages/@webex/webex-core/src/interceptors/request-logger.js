/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import util from 'util';

import {get, has, isArray, isString, omit} from 'lodash';
import {Interceptor} from '@webex/http-core';

/**
 * @class
 */
export default class RequestLoggerInterceptor extends Interceptor {
  /**
   * @returns {RequestLoggerInterceptor}
   */
  static create() {
    return new RequestLoggerInterceptor({webex: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    const logger = get(this, 'webex.logger', console);

    logger.info('/**********************************************************************\\ ');
    logger.info('Request:', options.method || 'GET', options.uri);
    logger.info('WEBEX_TRACKINGID: ', get(options, 'headers.trackingid'));
    /* istanbul ignore next */
    if (has(options, 'headers.x-trans-id')) {
      logger.info('X-Trans-ID: ', get(options, 'headers.x-trans-id'));
    }
    const now = new Date();

    if (process.env.ENABLE_VERBOSE_NETWORK_LOGGING) {
      logger.info('timestamp (start): ', now.getTime(), now.toISOString());
      try {
        // Determine if body is a buffer without relying on Buffer to avoid
        // node/browser conflicts.
        if (
          options.body &&
          options.body.length &&
          !isArray(options.body) &&
          !isString(options.body)
        ) {
          logger.info('Request Options:', util.inspect(omit(options, 'body'), {depth: null}));
        } else {
          logger.info('Request Options:', util.inspect(options, {depth: null}));
        }
      } catch (e) {
        logger.warn('Could not stringify request options:', e);
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
    const logger = get(this, 'webex.logger', console);

    logger.error('Request Failed: ', reason.stack);
    logger.info('\\**********************************************************************/');

    return Promise.reject(reason);
  }
}
