/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var deviceUrlProcessor = {
  pre: function pre(options) {
    if (deviceUrlProcessor.requiresDeviceUrl.call(this, options)) {
      options.headers['Cisco-Device-URL'] = this.spark.device.url;
    }
    return options;
  },

  requiresDeviceUrl: function requiresDeviceUrl(options) {
    // Only add the device url header if (a) we have a device url to add and (b)
    // if there are already other headers in place that will trigger a CORS
    // preflight and (c) we are not calling CI.
    return !!(this.spark.device && this.spark.device.url) && Object.keys(options.headers).length > 0 && options.api !== 'oauth' && options.api !== 'saml';
  }
};

module.exports = deviceUrlProcessor;
