/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var trackingIdProcessor = {
  pre: function pre(options) {
    if (trackingIdProcessor.requiresTrackingID.call(this, options)) {
      options.headers.TrackingID = this.trackingId;
    }

    return options;
  },

  requiresTrackingID: function requiresTrackingID(options) {
    if (options.api && this.spark.device.isValidService(options.api)) {
      return true;
    }

    if (options.uri && this.spark.device.isServiceUrl(options.uri)) {
      return true;
    }

    if (options.uri && this.spark.device.isPreAuthServiceUrl(options.uri)) {
      return true;
    }

    if (options.uri && this.spark.device.isDeviceRegistrationUrl(options.uri)) {
      return true;
    }

    return false;
  }
};

module.exports = trackingIdProcessor;
