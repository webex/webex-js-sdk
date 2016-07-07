/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AbstractRequestBatcher = require('../../../lib/abstract-request-batcher');
var CirconusMetricsBatchedRequestQueue = require('./circonus-metrics-batched-request-queue');
var DummyBatchedRequestStore = require('../../../lib/dummy-batched-request-store');
var noop = require('lodash.noop');

/**
 * @extends AbstractRequestBatcher
 * @memberof Metrics
 */
var CirconusMetricsRequestBatcher = AbstractRequestBatcher.extend({
  children: {
    queue: CirconusMetricsBatchedRequestQueue,
    store: DummyBatchedRequestStore
  },

  namespace: 'Metrics',

  fetch: function fetch(payload) {
    if (this.config.enableMetrics) {
      return this._checkParameters(payload)
        .then(function _request() {
          var keyPath = payload.key.split('.');
          var api = keyPath.shift();
          payload.key = keyPath.join('.');

          if (!this.spark.device.isValidService(api)) {
            throw new Error(api + ' is not a known service. Please ensure your metric key begins with the service (conversation, locus, etc) that should recieve said metric.');
          }

          return AbstractRequestBatcher.prototype.fetch.call(this, api, payload);
        }.bind(this));
    }
  },

  _checkParameters: function _checkParameters(payload) {
    if (!payload) {
      return Promise.reject(new Error('`payload` is a required parameter'));
    }

    if (!payload.key) {
      return Promise.reject(new Error('`payload.key` is required'));
    }

    var keyPath = payload.key.split('.');
    var api = keyPath.shift();
    payload.key = keyPath.join('.');

    if (!this.spark.device.isValidService(api)) {
      return Promise.reject(new Error(api + ' is not a known service. Please ensure your metric key begins with the service (conversation, locus, etc) that should recieve said metric.'));
    }

    return Promise.resolve();
  },

  _request: function _request(payload) {
    return this.request({
      method: 'POST',
      api: payload.api,
      resource: 'metrics',
      body: {
        metrics: payload.queue
      }
    });
  },

  _processSuccess: noop,
  _processFailure: noop
});

module.exports = CirconusMetricsRequestBatcher;
