/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var Defer = require('../util/defer');
var isObject = require('lodash.isobject');
var last = require('lodash.last');
var SparkBase = require('../lib/spark-base');

/**
 * @class
 * @extends {SparkBase}
 */
var BatchedRequestStore = SparkBase.extend(
  /** @lends BatchedRequestStore.prototype */
  {
  indexArgumentsLength: 1,

  session: {
    requests: {
      type: 'object',
      required: true,
      default: function _buffer() {
        return {};
      }
    }
  },

  create: function create() {
    var id = this._generateIndex.apply(this, arguments);
    var defer = this.requests[id];
    if (defer) {
      throw new Error('There is already an outstanding request for the specified identifier(s)');
    }
    this.requests[id] = defer = new Defer();
    return defer;
  },

  fail: function fail() {
    if (arguments.length <= this.indexArgumentsLength) {
      throw new Error('`error` is a required parameter');
    }

    var defer = this.get.apply(this, arguments);

    var error = last(arguments);

    this.remove.apply(this, arguments);
    defer.reject(error);
  },

  get: function get() {
    var id = this._generateIndex.apply(this, arguments);
    var defer = this.requests[id];
    if (!defer) {
      throw new Error('No outstanding request for specified identifier(s)');
    }
    return defer;
  },

  initialize: function initialize() {
    if (!this.namespace) {
      /* jscs:disable */
      var parent = this;
      /* jscs:enable */
      while (parent && !parent.namespace) {
        parent = parent.parent;
      }
      if (parent && parent.namespace) {
        this.namespace = parent.namespace;
      }
    }
  },

  remove: function remove() {
    var id = this._generateIndex.apply(this, arguments);
    delete this.requests[id];
  },

  succeed: function succeed() {
    if (arguments.length <= this.indexArgumentsLength) {
      throw new Error('`result` is a required parameter');
    }

    var defer = this.get.apply(this, arguments);

    var result = last(arguments);
    defer.resolve(result);
  },

  _generateIndex: function _generateIndex(id) {
    if (!id) {
      throw new Error('`id` is a required parameter');
    }

    if (isObject(id)) {
      // TODO use a fast, short hashing algorithm (will probably need to convert
      // this to an async method).
      id = JSON.stringify(id);
    }

    return id;
  }
});

module.exports = BatchedRequestStore;
