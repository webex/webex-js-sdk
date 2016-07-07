/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var urlProcessor = {
  pre: function pre(options) {
    if (!options.uri) {

      urlProcessor.checkOptions(options);

      var uri = this.spark.device.getServiceUrl(options.api);

      if (!uri) {
        uri = this.spark.device.getPreAuthServiceUrl(options.api);
      }

      if (!uri) {
        throw new Error('`' + options.api + '` is not a known service');
      }

      // strip leading and trailing slashes before assembling the full uri
      if (options.resource) {
        var pattern = /(?:^\/)|(?:\/$)/;
        uri = uri.replace(pattern, '') + '/' + options.resource.replace(pattern, '');
      }

      options.uri = uri;
    }

    return options;
  },

  checkOptions: function checkOptions(options) {
    if (!options.api) {
      throw new Error('An `api` or `uri` parameter is required');
    }

    if (!options.resource) {
      throw new Error('A `resource` parameter is required');
    }
  }
};

module.exports = urlProcessor;
