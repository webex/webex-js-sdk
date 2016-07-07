/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var clone = require('lodash.clone');

var requestHeaderName = 'cisco-no-http-redirect';
var responseHeaderName = 'cisco-location';

var redirectProcessor = {
  pre: function pre(options) {
    if (this.spark.device.isServiceUrl(options.uri)) {
      options.headers[requestHeaderName] = true;
      options.redirectCount = options.redirectCount || 0;
    }
    return options;
  },
  post: function post(res) {
    if (res.headers && res.headers[responseHeaderName] && this.spark.device.isServiceUrl(res.headers[responseHeaderName])) {
      var options = clone(res.options);
      options.uri = res.headers[responseHeaderName];
      options.redirectCount += 1;
      if (options.redirectCount > this.config.maxAppLevelRedirects) {
        return Promise.reject(new Error('Maximum redirects exceeded'));
      }
      return this.request(options);
    }

    return res;
  }
};

module.exports = redirectProcessor;
