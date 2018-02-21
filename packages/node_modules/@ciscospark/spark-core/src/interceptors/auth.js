/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
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
   * @see {@link Interceptor#onRequest}
   * @param {Object} options
   * @returns {Object}
   */
  onRequest(options) {
    options.headers = options.headers || {};

    // If Authorizations is already set, don't overwrite it
    if ('authorization' in options.headers || 'auth' in options) {
      // If Authorization is set to null, false, or undefined, delete it to
      // prevent a CORS preflight.
      if (!options.headers.authorization) {
        Reflect.deleteProperty(options.headers, 'authorization');
      }
      return Promise.resolve(options);
    }

    return this.requiresCredentials(options)
      .then((requires) => {
        if (!requires) {
          return options;
        }

        return this.spark.credentials.getUserToken()
          .then((token) => {
            options.headers.authorization = token.toString();
            return options;
          });
      });
  }

  /**
   * Determines if the provided options object needs an auth header
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  requiresCredentials(options) {
    if (options.uri && options.uri.includes(this.spark.config.device.preDiscoveryServices.hydraServiceUrl)) {
      return Promise.resolve(true);
    }

    if (!this.spark.internal.device) {
      return Promise.resolve(false);
    }

    return this.spark.internal.device.isSpecificService('hydra', options.uri)
      .then((isHydra) => {
        if (isHydra) {
          return true;
        }

        if (options.service) {
          return this.spark.internal.device.isService(options.service);
        }

        if (options.uri) {
          return this.spark.internal.device.isServiceUrl(options.uri);
        }
        return false;
      });
  }

  /**
   * @see {@link Interceptor#onResponseError}
   * @param {Object} options
   * @param {Error} reason
   * @returns {Object}
   */
  onResponseError(options, reason) {
    return this.shouldAttemptReauth(reason, options)
      .then((shouldAttemptReauth) => {
        if (shouldAttemptReauth) {
          this.spark.logger.info('auth: received 401, attempting to reauthenticate');

          if (reason.options.headers) {
            Reflect.deleteProperty(reason.options.headers, 'authorization');
          }

          if (this.spark.credentials.canRefresh) {
            return this.spark.credentials.refresh()
              .then(() => this.replay(options));
          }
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
    if (options.replayCount) {
      options.replayCount += 1;
    }
    else {
      options.replayCount = 1;
    }

    if (options.replayCount > this.spark.config.maxAuthenticationReplays) {
      this.spark.logger.error(`auth: failed after ${this.spark.config.maxAuthenticationReplays} replay attempts`);
      return Promise.reject(new Error(`Failed after ${this.spark.config.maxAuthenticationReplays} replay attempts`));
    }

    this.spark.logger.info(`auth: replaying request ${options.replayCount} time`);

    return this.spark.request(options);
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
