/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var BatchedRequestStore = require('../../../../lib/batched-request-store');

/**
 * @class
 * @extends BatchedRequestStore
 * @memberof Encryption
 */
var KmsRequestStore = BatchedRequestStore.extend({
  create: function create(req, timeout) {
    if (!timeout) {
      throw new Error('`timeout` is required');
    }

    var defer = BatchedRequestStore.prototype.create.apply(this, arguments);

    var timer = setTimeout(function func() {
      this.logger.warn('kms: request timed out; request id:', req.requestId, 'timeout: ', timeout);
      this.remove(req);
      defer.reject(new Error('KMS request did not return in a timely manner'));
    }.bind(this), timeout);

    defer.promise.then(cancelTimer);
    defer.promise.catch(cancelTimer);

    return defer;

    function cancelTimer() {
      clearTimeout(timer);
    }
  },

  _generateIndex: function _generateIndex(r) {
    var requestId = r.requestId || r.body.requestId;
    if (!requestId) {
      throw new Error('Could not find a `requestId` on `r`');
    }
    return requestId;
  }
});

module.exports = KmsRequestStore;
