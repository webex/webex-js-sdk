/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var SparkBase = require('../../../lib/spark-base');
var CirconusMetricsRequestBatcher = require('./circonus-metrics-request-batcher');
var ClientMetricsRequestBatcher = require('./client-metrics-request-batcher');
var SplunkMetricsRequestBatcher = require('./splunk-metrics-request-batcher');

/**
 * Represents a single metric to send to Circonus
 * @property key The name of the metric
 * @property type The type of the metric (INCREMENT, DECREMENT, GAUGE, STRING, MSECS)
 * @property value The value to send (doesn't apply for INCREMENT, DECREMENT)
 * @typedef {Object} MetricObject
 */

/**
  * @class
  * @extends {SparkBase}
  * @memberof Metrics
  */
var MetricsService = SparkBase.extend(
  /** @lends Metrics.MetricsService.prototype */
  {
  children: {
    circonus: CirconusMetricsRequestBatcher,
    splunk: SplunkMetricsRequestBatcher,
    clientMetrics: ClientMetricsRequestBatcher
  },

  namespace: 'Metrics',

  /**
   * Submits semi-structured metrics
   * @param eventName
   * @param props
   */
  sendSemiStructured: function sendSemiStructured(eventName, props) {
    var payload = {
      metricName: eventName
    };
    if (props.tags) {
      payload.tags = props.tags;
    }
    if (props.fields) {
      payload.fields = props.fields;
    }
    this.clientMetrics.fetch(payload);
  },

  /**
   * Submits an unstructured metrics
   * @param {string} key
   * @param {Object} value
   */
  sendUnstructured: function sendUnstructured(key, value) {
    this.splunk.fetch({
      key: key,
      value: value
    });
  },

  /**
   * Post a single metric to splunk
   * @deprecated Please switch to `this.sendUnstructured()`. Note: it does not
   * return a promise.
   * @param {Object} body the payload
   * @returns {Promise}
   */
  postSplunk: function postSplunk(body) {
    return this.request({
      api: 'metrics',
      resource: 'metrics',
      body: body,
      method: 'POST'
    }).then(function processResponse(res) {
      return res.body;
    });
  },

  /**
   * Increment the specified counter
   * @memberof MetricsService.prototype
   * @param {string} key The fully-qualified name of the metric to send (e.g.
   * it must contain locus, conversation, etc)
   */
  incrementCounter: function incrementCounter(key) {
    this.circonus.fetch({
      key: key,
      type: 'INCREMENT'
    });
  },

  /**
   * Decrement the specified counter
   * @memberof MetricsService.prototype
   * @param {string} key The fully-qualified name of the metric to send (e.g.
   * it must contain locus, conversation, etc)
   */
  decrementCounter: function decrementCounter(key) {
    this.circonus.fetch({
      key: key,
      type: 'DECREMENT'
    });
  },

  /**
   * Send a gauge value
   * @memberof MetricsService.prototype
   * @param {string} key   The fully-qualified name of the metric to send (e.g.
   * it must contain locus, conversation, etc)
   * @param {numeric} value The value to send
   */
  sendGauge: function sendGauge(key, value) {
    this.circonus.fetch({
      key: key,
      item: value,
      type: 'GAUGE'
    });
  },

  /**
   * Send a timer value
   * @memberof MetricsService.prototype
   * @param {string} key   The fully-qualified name of the metric to send (e.g.
   * it must contain locus, conversation, etc)
   * @param {numeric} value The value to send
   */
  sendTimer: function sendTimer(key, value) {
    this.circonus.fetch({
      key: key,
      value: value,
      type: 'MSECS'
    });
  }
});

module.exports = MetricsService;
