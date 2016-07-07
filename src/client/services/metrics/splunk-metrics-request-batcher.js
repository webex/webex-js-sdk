/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var AbstractRequestBatcher = require('../../../lib/abstract-request-batcher');
var defaults = require('lodash.defaults');
var noop = require('lodash.noop');
var SplunkMetricsBatchedRequestQueue = require('./splunk-metrics-batched-request-queue');
var DummyBatchedRequestStore = require('../../../lib/dummy-batched-request-store');

/**
 * @extends AbstractRequestBatcher
 * @memberof Metrics
 */
var SplunkMetricsRequestBatcher = AbstractRequestBatcher.extend({
  children: {
    queue: SplunkMetricsBatchedRequestQueue,
    store: DummyBatchedRequestStore
  },

  namespace: 'Metrics',

  fetch: function fetch(payload) {
    if (this.config.enableMetrics) {
      defaults(payload, {
        version: this.config.appVersion,
        appType: this.config.appType
      });
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
      resource: 'metrics',
      body: {
        metrics: payload
      }
    });
  },

  _processSuccess: noop,
  _processFailure: noop
});

module.exports = SplunkMetricsRequestBatcher;
