/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@webex/http-core';

/**
 * @class
 */
export default class EmbargoInterceptor extends Interceptor {
  /**
   * @returns {EmbargoInterceptor}
   */
  static create() {
    /* eslint no-invalid-this: [0] */
    return new EmbargoInterceptor({webex: this});
  }

  /**
   * @see Interceptor#onResponseError
   * @param {Object} options
   * @param {Error} reason
   * @returns {Promise}
   */
  onResponseError(options, reason) {
    if (reason.statusCode === 451) {
      const {device} = this.webex.internal;
      const loggerMessage = [
        'Received `HTTP 451 Unavailable For Legal Reasons`, ',
        'discarding credentials and device registration',
      ].join('');

      if (device) {
        this.webex.internal.device.clear();
      }

      this.webex.credentials.clear();
      this.webex.logger.info(loggerMessage);
    }

    return Promise.reject(reason);
  }
}
