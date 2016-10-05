/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AbstractRequestBatcher = require('../../../lib/abstract-request-batcher');
var defaults = require('lodash.defaults');
var noop = require('lodash.noop');
var ClientMetricsBatchedRequestQueue = require('./client-metrics-batched-request-queue');
var DummyBatchedRequestStore = require('../../../lib/dummy-batched-request-store');

/**
 * @extends AbstractRequestBatcher
 * @memberof Metrics
 */
var ClientMetricsRequestBatcher = AbstractRequestBatcher.extend({
  children: {
    queue: ClientMetricsBatchedRequestQueue,
    store: DummyBatchedRequestStore
  },

  namespace: 'Metrics',

  fetch: function fetch(payload) {
    if (this.config.enableMetrics) {
      defaults(payload);
      return AbstractRequestBatcher.prototype.fetch.apply(this, arguments);
    }

    return Promise.resolve();
  },

  _checkParameters: function _checkParameters(payload) {
    if (!payload) {
      return Promise.reject(new Error('`payload` is a required parameter'));
    }

    return Promise.resolve();
  },

  _request: function _request(payload) {
    return this.request({
      method: 'POST',
      api: 'metrics',
      resource: 'clientmetrics',
      body: {
        metrics: payload
      }
    });
  },

  _processSuccess: noop,
  _processFailure: noop
});

module.exports = ClientMetricsRequestBatcher;
