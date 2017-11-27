/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@ciscospark/http-core';

/**
 * @class
 */
export default class EmbargoInterceptor extends Interceptor {
  /**
   * @returns {EmbargoInterceptor}
   */
  static create() {
    /* eslint no-invalid-this: [0] */
    return new EmbargoInterceptor({spark: this});
  }

  /**
   * @see Interceptor#onResponseError
   * @param {Object} options
   * @param {Error} reason
   * @returns {Promise}
   */
  onResponseError(options, reason) {
    if (reason.statusCode === 451) {
      this.spark.internal.device.clear();
      this.spark.credentials.clear();
      this.spark.logger.info('Received `HTTP 451 Unavailable For Legal Reasons`, discarding credentials and device registration');
    }

    return Promise.reject(reason);
  }
}
