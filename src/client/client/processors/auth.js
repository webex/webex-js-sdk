/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var authProcessor = {
  pre: function pre(options) {
    // If Authorizations is already set, don't overwrite it
    if ('Authorization' in options.headers) {

      // If Authorization is set to null, false, or undefined, delete it to
      // prevent a CORS preflight.
      if (!options.headers.Authorization) {
        delete options.headers.Authorization;
      }

      return options;
    }

    var promise;

    if (authProcessor.requiresClientCredentials.call(this, options)) {
      promise = authProcessor.getClientCredentials.call(this);
    }
    else if (authProcessor.requiresCredentials.call(this, options)) {
      promise = this.spark.credentials.getAuthorization();
    }

    if (promise) {
      return promise
        .then(function addAuthHeader(authorization) {
          options.headers.Authorization = authorization;
          return options;
        });
    }

    return options;
  },
  post: {
    onReject: function onReject(res) {
      if (authProcessor.shouldAttemptReauth.call(this, res, res.options)) {
        this.logger.info('auth: received 401, attempting to reauthenticate');

        if (res.options.headers) {
          delete res.options.headers.Authorization;
        }

        // Pass force: true so that we can reauthenticate even if the access
        // token has not expired
        return this.spark.credentials.authenticate({force: true})
          // TODO make replay more accessible
          // reminder: res.options must be passed by reference becuase clone or
          // cloneDeep may remove `toJSON()`
          .then(authProcessor.replay.bind(this, res.options));
      }

      throw res;
    }
  },

  replay: function replay(options) {
    options.replayCount = options.replayCount || 1;

    this.logger.info('auth: replaying request for ' + options.replayCount + ' time');

    if (options.replayCount > this.spark.config.maxReplayAttempts) {
      this.logger.error('auth: failed after ' + this.spark.config.maxReplayAttempts + ' replay attempts');
      throw new Error('Failed after ' + this.spark.config.maxReplayAttempts + ' replay attempts');
    }

    return this.request(options);
  },

  shouldAttemptReauth: function shouldAttemptReauth(response, options) {
    if (options && options.shouldRefreshAccessToken === false) {
      return false;
    }

    if (response.statusCode === 401) {
      return true;
    }

    return false;
  },

  requiresCredentials: function requiresCredentials(options) {
    if (options.uri.indexOf(this.spark.config.device.deviceRegistrationUrl) === 0) {
      return true;
    }

    if (options.api && this.spark.device.isValidService(options.api)) {
      return true;
    }

    if (options.uri && this.spark.device.isServiceUrl(options.uri)) {
      return true;
    }

    return false;
  },

  requiresClientCredentials: function requiresClientCredentials(options) {
    return options.api === 'atlas' && options.resource && (options.resource.indexOf('users/email/') !== -1);
  },

  getClientCredentials: function getClientCredentials() {
    return this.spark.credentials.getClientAuthorization();
  }
};

module.exports = authProcessor;
