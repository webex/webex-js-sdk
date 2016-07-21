/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {AuthInterceptor} from '@ciscospark/spark-core';

/**
 * @class
 */
export default class DeviceAuthInterceptor extends AuthInterceptor {
  /**
   * @returns {DeviceAuthInterceptor}
   */
  static create() {
    /* eslint no-invalid-this: [0] */
    return new DeviceAuthInterceptor({spark: this});
  }

  /**
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  requiresCredentials(options) {
    if (options.uri.includes(this.spark.config.credentials.oauth.tokenUrl)) {
      return Promise.resolve(false);
    }

    if (options.uri.includes(this.spark.config.credentials.oauth.authorizeUrl)) {
      return Promise.resolve(false);
    }

    if (options.uri.includes(this.spark.config.credentials.samlUrl)) {
      return Promise.resolve(false);
    }

    if (options.service && this.spark.device.isService(options.service)) {
      return Promise.resolve(true);
    }

    if (options.uri && this.spark.device.isServiceUrl(options.uri)) {
      return Promise.resolve(true);
    }

    return Promise.resolve(false);
  }

  /**
   * Always returns false
   * @returns {boolean}
   */
  requiresClientCredentials() {
    return false;
  }
}
