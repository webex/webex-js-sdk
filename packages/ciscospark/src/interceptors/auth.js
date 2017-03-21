/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {AuthInterceptor} from '@ciscospark/spark-core';

/**
 * @class CiscoSparkAuthInterceptor
 * @private
 */
export default class CiscoSparkAuthInterceptor extends AuthInterceptor {
  /**
   * @returns {CiscoSparkAuthInterceptor}
   */
  static create() {
    /* eslint no-invalid-this: [0] */
    return new CiscoSparkAuthInterceptor({spark: this});
  }

  /**
   * @param {Object} options
   * @returns {boolean}
   */
  requiresCredentials(options) {
    if (options.uri.includes(this.spark.config.hydraServiceUrl)) {
      return true;
    }

    return false;
  }
}
