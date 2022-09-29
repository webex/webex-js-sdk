/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

/**
 * @class
 */
export default class AuthInterceptor extends Interceptor {
  /**
   * @returns {AuthInterceptor}
   */
  static create() {
    return new AuthInterceptor({webex: this});
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

        return this.webex.credentials.getUserToken()
          .then((token) => {
            options.headers.authorization = token.toString();

            return options;
          });
      });
  }

  /**
   * Determines if the provided options object needs an authorization header.
   *
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  requiresCredentials(options) {
    // Validate that authorization is necessary.
    if (options.addAuthHeader === false) {
      return Promise.resolve(false);
    }

    // Validate that the services plugin has been loaded before proceeding.
    if (!this.webex.internal.services) {
      return Promise.resolve(false);
    }

    // Destructure webex instance to isolate services plugin.
    const {services} = this.webex.internal;

    // Store the current service details if available and destructure details.
    const details = services.getServiceFromUrl(options.uri || '');
    const {name} = details || {};
    const {resource, uri} = options;
    const service = options.service || options.api;

    // Unique validation for the u2c service.
    if ((service && service === 'u2c') || (name && name === 'u2c')) {
      if (
        (resource && resource.includes('limited')) ||
        (uri && uri.includes('limited'))
      ) {
        return Promise.resolve(false);
      }

      return Promise.resolve(true);
    }


    // Validate that the allowed domains can be utilized.
    if (services.validateDomains &&
      services.hasAllowedDomains() &&
      (uri && services.isAllowedDomainUrl(uri))) {
      return Promise.resolve(true);
    }

    // Perform an additional validation in case the service does not exist yet.
    return services.waitForService({name: service, url: uri})
      .then((detectedUrl) => {
        // Validate that the url exists in the catalog.
        if (services.getServiceFromUrl(detectedUrl)) {
          return true;
        }

        // Return false to indicate authentication is not required.
        return false;
      })
      .catch((error) => {
        this.webex.logger.warn(
          'auth-interceptor: failed to validate service exists in catalog',
          error
        );

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
          this.webex.logger.info('auth: received 401, attempting to reauthenticate');

          if (reason.options.headers) {
            Reflect.deleteProperty(reason.options.headers, 'authorization');
          }

          if (this.webex.credentials.canRefresh) {
            return this.webex.credentials.refresh()
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

    if (options.replayCount > this.webex.config.maxAuthenticationReplays) {
      this.webex.logger.error(`auth: failed after ${this.webex.config.maxAuthenticationReplays} replay attempts`);

      return Promise.reject(new Error(`Failed after ${this.webex.config.maxAuthenticationReplays} replay attempts`));
    }

    this.webex.logger.info(`auth: replaying request ${options.replayCount} time`);

    return this.webex.request(options);
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
