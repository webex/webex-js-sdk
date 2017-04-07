/**!
*
* Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
*/

import {Interceptor} from '@ciscospark/http-core';

/**
* @class
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
    if (this.requiresDeviceUrl(options)) {
      options.headers[`Cisco-Device-URL`] = this.spark.device.url;
    }
    return options;
  }

  /**
  * Only add the device url header if (a) we have a device url to add and
  * (b) if there are already other headers in place that will trigger a CORS
  *     preflight and
  * (c) we are not calling CI.
  * @param {Object} options
  * @returns {boolean}
  */
  requiresDeviceUrl(options) {
    return !!(this.spark.device && this.spark.device.url) && Object.keys(options.headers).length > 0 && options.service !== `oauth` && options.service !== `saml`;
  }
}
