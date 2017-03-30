/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
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

  // it's an if-tree, splitting it up into more functions makes it more
  // difficult to interpet, not less
  /* eslint-disable complexity */
  /**
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  requiresCredentials(options) {
    if (options.uri.includes(this.spark.config.credentials.tokenUrl || this.spark.config.credentials.oauth.tokenUrl)) {
      return Promise.resolve(false);
    }

    if (options.uri.includes(this.spark.config.credentials.authorizeUrl || this.spark.config.credentials.oauth.authorizeUrl)) {
      return Promise.resolve(false);
    }

    if (options.uri.includes(this.spark.config.credentials.samlUrl)) {
      return Promise.resolve(false);
    }

    if (options.uri.includes(this.spark.config.hydraServiceUrl)) {
      return Promise.resolve(true);
    }

    return this.spark.device.isSpecificService(`hydra`, options.uri)
      .then((isHydra) => {
        if (isHydra) {
          return true;
        }

        if (options.service) {
          return this.spark.device.isService(options.service);
        }

        if (options.uri) {
          return this.spark.device.isServiceUrl(options.uri);
        }

        return Promise.resolve(false);
      });
  }
  /* eslint-enable complexity */
}
