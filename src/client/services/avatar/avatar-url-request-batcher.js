/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AbstractRequestBatcher = require('../../../lib/abstract-request-batcher');
var AvatarUrlBatchedRequestQueue = require('./avatar-url-batched-request-queue');
var AvatarUrlBatchedRequestStore = require('./avatar-url-batched-request-store');
var patterns = require('../../../util/patterns');

/**
 * @extends AbstractRequestBatcher
 * @memberof Avatar
 */
var AvatarUrlRequestBatcher = AbstractRequestBatcher.extend({
  children: {
    queue: AvatarUrlBatchedRequestQueue,
    store: AvatarUrlBatchedRequestStore
  },

  namespace: 'Avatar',

  _checkParameters: function _checkParameters(id, size) {
    if (!patterns.uuid.test(id)) {
      return Promise.reject(new Error('`id` must be a uuid'));
    }

    if (!size) {
      return Promise.reject(new Error('`size` is a required parameter'));
    }

    return Promise.resolve();
  },

  _request: function _request(payload) {
    return this.request({
      method: 'POST',
      api: 'avatar',
      resource: 'profiles/urls',
      body: payload
    });
  },

  _processSuccess: function _processSuccess(res) {
    try {
      res.options.body.forEach(function processItem(item) {
        item.sizes.forEach(function processItemSize(size) {
          var responseByUuid = res.body[item.uuid];
          if (responseByUuid) {
            var responseBySize = responseByUuid[size];
            if (responseBySize) {
              if (responseBySize.size !== size) {
                this.logger.warn('Avatar: substituted size "' + responseBySize.size + '" for "' + size + '"');
              }
              this.store.succeed(item.uuid, size, responseBySize.url);
            }
            else {
              this.store.fail(item.uuid, size, new Error('requested size not found in bulk avatar payload'));
            }
          }
          else {
            this.store.fail(item.uuid, size, new Error('requested uuid not found in bulk avatar payload'));
          }
        }.bind(this));
      }.bind(this));
    }
    catch (e) {
      this.logger.error(e);
    }
  },

  _processFailure: function _processFailure(res) {
    this.logger.error('avatar: request failed', res.statusCode, res.body);

    var err = new Error('bulk retrieval for avatar urls failed');
    res.options.body.forEach(function processItem(item) {
      item.sizes.forEach(function processItemSize(size) {
        this.store.fail(item.uuid, size, err);
      }.bind(this));
    }.bind(this));
  }
});

module.exports = AvatarUrlRequestBatcher;
