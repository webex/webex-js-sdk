/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var requestEventsProcessor = {
  pre: {
    onResolve: function onResolve(options) {
      this.trigger('request:start', options);
      return options;
    },
    onReject: function onReject(options, reason) {
      this.trigger('request:end', options, reason);
      this.trigger('request:failure', options, reason);
      throw options;
    }
  },
  post: {
    onResolve: function onResolve(res) {
      this.trigger('request:end', res.options, res);
      this.trigger('request:success', res.options, res);
      return res;
    },
    onReject: function onReject(res) {
      this.trigger('request:end', res.options, res);
      this.trigger('request:failure', res.options, res);
      throw res;
    }
  }
};

module.exports = requestEventsProcessor;
