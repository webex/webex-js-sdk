/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var assign = require('lodash.assign');
var SparkBase = require('../../lib/spark-base');
var pick = require('lodash.pick');

/**
 * @class
 * @extends {SparkBase}
 */
var MercuryMetrics = SparkBase.extend(
  /** @lends MercuryMetrics.prototype */
  {
  submitConnectMetric: function submitConnectMetric() {
    var payload;
    if (this.lastDisconnect) {
      payload = assign(this.lastDisconnect, {
        duration: Date.now() - this.lastDisconnect.timestamp
      });
      delete this.lastDisconnect.timestamp;
    }
    else {
      payload = this._preparePayload({reason: 'new'});
    }

    this.spark.metrics.sendUnstructured('mercuryConnect', assign(payload, {version: 6}));
    this.lastDisconnect = undefined;
  },

  submitConnectionFailureMetric: function submitConnectionFailureMetric(event) {
    var payload = this._preparePayload(pick(event, 'code', 'reason'));
    this.spark.metrics.sendUnstructured('mercuryConnectionFailure', assign(payload, {version: 6}));
  },

  submitDisconnectMetric: function submitDisconnectMetric(options) {
    var payload = this._preparePayload({action: options.action}, options.event);

    this.spark.metrics.sendUnstructured('mercuryDisconnect', assign(payload, {version: 6}));

    // copy the values from payload so we don't attach the timestamp to the
    // not-quite-sent metric.
    this.lastDisconnect = assign({
      timestamp: Date.now()
    }, payload);
  },

  submitForceClosureMetric: function submitForceClosureMetric() {
    var payload = this._preparePayload({});
    this.spark.metrics.sendUnstructured('mercuryForceClosure', assign(payload, {version: 6}));
  },

  submitSkipSequenceMetric: function submitSkipSequenceMetric(actual, expected) {
    var payload = this._preparePayload({
      expected: expected,
      actual: actual
    });

    this.spark.metrics.sendUnstructured('mercurySeqNumMismatch', assign(payload, {version: 6}));
  },

  submitUnexpectedClosureMetric: function submitUnexpectedClosureMetric(event) {
    var payload = this._preparePayload({}, event);

    this.spark.metrics.sendUnstructured('mercuryUnexpectedClosure', assign(payload, {version: 6}));
  },

  initialize: function initialize() {
    /**
     * payload from the last disconnect metric sent
     * @type {Object}
     * @memberof MercuryMetrics.prototype
     */
    this.lastDisconnect = undefined;
  },

  _preparePayload: function _preparePayload(payload, event) {
    assign(payload, {
      deviceUrl: this.spark.device.url,
      userId: this.spark.device.userId,
      webSocketUrl: this.spark.device.webSocketUrl
    }, pick(event, 'reason', 'code'));

    return payload;
  }
});

module.exports = MercuryMetrics;
