/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {Interceptor} from '@ciscospark/http-core';

/**
 * @class
 */
export default class AuthInterceptor extends Interceptor {
  /**
   * @returns {AuthInterceptor}
   */
  static create() {
    return new AuthInterceptor({spark: this});
  }

  /**
   * @see Interceptor#onRequest
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    // If Authorizations is already set, don't overwrite it
    if (`authorization` in options.headers) {
      // If Authorization is set to null, false, or undefined, delete it to
      // prevent a CORS preflight.
      if (!options.headers.authorization) {
        Reflect.deleteProperty(options.headers, `authorization`);
      }
      return options;
    }

    return Promise.all([
      this.requiresCredentials(options),
      this.requiresClientCredentials(options)
    ])
      .then((results) => {
        const [requiresCredentials, requiresClientCredentials] = results;
        if (requiresCredentials) {
          return this.spark.credentials.getAuthorization();
        }
        else if (requiresClientCredentials) {
          return this.spark.credentials.getClientCredentials();
        }
        return null;
      })
      .then((authorization) => {
        options.headers.authorization = authorization;
        return options;
      });
  }

  /**
   * @see Interceptor#onRequestError
   * @param {Object} options
   * @param {Error} reason
   * @returns {Object}
   */
  onRequestError(options, reason) {
    return this.shouldAttemptReauth(reason, options)
      .then((shouldAttemptReauth) => {
        if (shouldAttemptReauth) {
          this.spark.logger.info(`auth: received 401, attempting to reauthenticate`);

          if (reason.options.headers) {
            Reflect.deleteProperty(reason.options.headers, `authorization`);
          }

          return this.spark.credentials.authorize({force: true})
            .then(() => this.replay(options));
        }

        return Promise.reject(reason);
      });
  }

  /**
   * Replays the request
   * @param {Object} options
   * @returns {Object}
   */
  replay(options) {
    options.replayCount = options.replayCount || 1;

    this.spark.logger.info(`auth: replaying request ${options.replayCount} time`);

    if (options.replayCount > this.spark.config.maxReplayAttempts) {
      this.spark.logger.error(`auth: failed after ${this.spark.config.maxReplayAttempts} replay attempts`);
      return Promise.reject(new Error(`Failed after ${this.spark.config.maxReplayAttempts} replay attempts`));
    }

    return this.spark.request(options);
  }

  /**
   * Indicates whether or not the current request requires credentials
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  requiresCredentials(options) {
    this.spark.logger.warn(`AuthInterceptor: #requiresCredentials should be overridden`);
    if (options.uri.includes(this.spark.config.credentials.oauth.tokenUrl)) {
      return Promise.resolve(false);
    }

    if (options.uri.includes(this.spark.config.credentials.oauth.authorizeUrl)) {
      return Promise.resolve(false);
    }

    if (options.uri.includes(this.spark.config.credentials.samlUrl)) {
      return Promise.resolve(false);
    }

    return Promise.resolve(true);
  }

  /**
   * Indicates whether or not the current request requires client credentials
   * @returns {Promise<boolean>}
   */
  requiresClientCredentials() {
    this.spark.logger.warn(`AuthInterceptor: #requiresClientCredentials should be overridden`);
    return Promise.resolve(false);
  }

  /**
   * Indicates whether or not the current request should refresh its access
   * token in event of a 401
   * @param {Error} reason
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  shouldAttemptReauth(reason, options) {
    if (options && options.shouldRefreshAccessToken === false) {
      return Promise.resolve(false);
    }

    if (reason.statusCode === 401) {
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }
}
