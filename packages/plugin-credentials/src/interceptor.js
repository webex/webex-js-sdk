/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {AuthInterceptor} from '@ciscospark/spark-core';

export default class AdvancedAuthInterceptor extends AuthInterceptor {
  /**
   * @returns {AuthInterceptor}
   */
  static create() {
    return new AdvancedAuthInterceptor({spark: this});
  }

  /**
   * Indicates whether or not the current request requires credentials
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  requiresCredentials(options) {
    return Promise.all([
      options.uri && this.spark.device.isSpecificService(`token`, options.uri),
      options.uri && this.spark.device.isSpecificService(`authorize`, options.uri),
      options.uri && this.spark.device.isSpecificService(`saml`, options.uri),
      options.service && this.spark.device.isService(options.service),
      !options.service && options.uri && this.spark.device.isServiceUrl(options.uri)
    ])
    .then(([isTokenUrl, isAuthorizeUrl, isSamlUrl, isService, isServiceUrl]) => {
      if (isTokenUrl || isAuthorizeUrl || isSamlUrl) {
        return false;
      }

      if (isService || isServiceUrl) {
        return true;
      }

      return false;
    });
  }
}
