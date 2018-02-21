/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {Interceptor} from '@ciscospark/http-core';
import {set} from 'lodash';

/**
 * Adds 'cisco-device-url' header, as appropriate, to requests
 */
export default class DeviceUrlInterceptor extends Interceptor {
  /**
  * @returns {DeviceUrlInterceptor}
  */
  static create() {
    /* eslint no-invalid-this: [0] */
    return new DeviceUrlInterceptor({spark: this});
  }

  /**
  * @see Interceptor#onRequest
  * @param {Object} options
  * @returns {Object}
  */
  onRequest(options) {
    if (!this.spark.internal.device.url || options.headers && 'cisco-device-url' in options.headers && !options.headers['cisco-device-url']) {
      return Promise.resolve(options);
    }

    return Promise.resolve(options.service || this.spark.internal.device.determineService(options.uri))
      .then((service) => {
        if (service && service !== 'oauth' && service !== 'saml') {
          set(options, 'headers[\'cisco-device-url\']', this.spark.internal.device.url);
        }
        return options;
      })
      .catch((err) => {
        if (err.message.match(/does not reflect a known service/)) {
          return options;
        }

        throw err;
      });
  }
}
