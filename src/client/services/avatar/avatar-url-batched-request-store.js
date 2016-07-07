/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var BatchedRequestStore = require('../../../lib/batched-request-store');

var AvatarUrlRequestStore = BatchedRequestStore.extend({
  indexArgumentsLength: 2,

  namespace: 'Avatar',

  remove: function remove(id) {
    if (arguments.length > 1) {
      return BatchedRequestStore.prototype.remove.apply(this, arguments);
    }

    if (!id) {
      throw new Error('`id` is a required parameter');
    }

    Object.keys(this.requests).forEach(function search(key) {
      if (key.indexOf(id) === 0) {
        this.requests[key] = undefined;
      }
    }.bind(this));
  },

  succeed: function succeed(id, size, url) {
    if (!id) {
      throw new Error('`id` is a required parameter');
    }

    if (!size) {
      throw new Error('`size` is a required parameter');
    }

    if (!url) {
      throw new Error('`url` is a required parameter');
    }

    BatchedRequestStore.prototype.succeed.apply(this, arguments);

    setTimeout(this.remove.bind(this, id, size), this.config.cacheExpiration);
  },

  _generateIndex: function _generateIndex(id, size) {
    if (!id) {
      throw new Error('`id` is a required parameter');
    }

    if (!size) {
      throw new Error('`size` is a required parameter');
    }

    return id + '-' + size;
  }
});

module.exports = AvatarUrlRequestStore;
