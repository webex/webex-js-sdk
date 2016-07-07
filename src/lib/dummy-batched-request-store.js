/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var SparkBase = require('../lib/spark-base');

/**
 * @class
 * @extends {SparkBase}
 */
var DummyBatchedRequestStore = SparkBase.extend(
  /** @lends DummyBatchedRequestStore.prototype */
  {
  create: function create() {
    return Promise.resolve();
  },

  fail: function fail() {
    return Promise.resolve();
  },

  get: function get() {
    return Promise.resolve();
  },

  initialize: function initialize() {
    return Promise.resolve();
  },

  remove: function remove() {
    return Promise.resolve();
  },

  succeed: function succeed() {
    return Promise.resolve();
  },

  _generateIndex: function _generateIndex() {
    return Promise.resolve();
  }
});

module.exports = DummyBatchedRequestStore;
