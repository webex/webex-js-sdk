/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AbstractRequestBatcher = require('../../../../lib/abstract-request-batcher');
var cappedDebounce = require('../../../../util/capped-debounce.js');
var KmsRequestQueue = require('./kms-request-queue');
var KmsRequestStore = require('./kms-request-store');
var noop = require('lodash.noop');

var KmsRequestBatcher = AbstractRequestBatcher.extend({
  children: {
    queue: KmsRequestQueue,
    store: KmsRequestStore
  },

  namespace: 'Encryption',

  processKmsMessageEvent: function processKmsMessageEvent(event) {
    return Promise.all(event.encryption.kmsMessages.map(process, this));

    function process(kmsMessage) {
      try {
        if (kmsMessage.status < 400) {
          this.store.succeed(kmsMessage, kmsMessage.body);
        }
        else {
          this.store.fail(kmsMessage, kmsMessage.body);
        }
      }
      catch (e) {
        this.logger.warn('kms: received response for unknown request id; this is probably a timeout that will be retried');
      }
    }
  },

  _checkParameters: function _checkParameters(req) {
    if (!req.method) {
      return Promise.reject(new Error('`req.method` is required'));
    }

    if (!req.uri) {
      return Promise.reject(new Error('`req.uri` is required'));
    }

    if (!req.wrapped) {
      return Promise.reject(new Error('`req` must be wrapped before submitting it'));
    }

    return Promise.resolve();
  },

  _processQueue: function _processQueue() {
    this._processQueue = cappedDebounce(this.__processQueue, this.config.bulkFetchDebounceDelay, {
      maxWait: this.config.bulkFetchDebounceMutltiplier*this.config.bulkFetchDebounceDelay,
      maxCalls: this.config.bulkFetchQueueCap
    });
    this._processQueue.apply(this, arguments);
  },

  _request: function _request(payload) {
    return this.spark.encryption.kms._getKMSCluster()
      .then(function setDestination(cluster) {
        this.logger.debug('kms: batched request length', payload.kmsMessages.length);
        payload.destination = cluster;
        return this.request({
          api: 'encryption',
          body: payload,
          method: 'POST',
          resource: 'kms/messages'
        });
      }.bind(this));
  },

  _processSuccess: noop

  // TODO _processFailure should deal should mark all requested keys as failed
});

module.exports = KmsRequestBatcher;
