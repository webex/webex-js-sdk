/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* eslint no-console: [0] */

var SparkBase = require('../lib/spark-base');
var assign = require('lodash.assign');
var contains = require('lodash.contains');
var util = require('util');

function wrapConsoleMethod(level) {
  // Fall back to log if the desired log level isn't implemented in this
  // environment.
  if (!console[level]) {
    level = 'log';
  }

  return function wrappedConsoleMethod() {
    var args = Array.prototype.slice.call(arguments);

    // Delete any sensitive data that might be logged.
    args.forEach(this._cleanseMsg);

    // Store arguments in the buffer
    var argString = args.map(function stringify(arg) {
      return util.inspect(arg, {depth: null});
    }).join(',');

    this._buffer.push(util.format('%s %s %s', (new Date()).toISOString(), level.toUpperCase(), argString));

    // Keep the buffer to a reasonable size
    if (this._buffer.length > this.config.maxBufferSize) {
      this._buffer.shift();
    }

    // Proxy the corresponding console method, if appropriate
    if (this._shouldPrint(level)) {
      console[level].apply(console, args);
    }
  };
}

/**
 * Inspired by andlog with customizations for Spark.
 * @class
 * @extends {SparkBase}
 * @memberof Core
 */
var Logger = SparkBase.extend(
  /** @lends Logger.prototype */
  {
  namespace: 'Logger',

  session: {
    _buffer: {
      type: 'array',
      required: true,
      default: function _buffer() {
        return [];
      }
    }
  },

  _getCurrentLevel: function _getCurrentLevel() {
    // If a level has been explicitly set via config, alway use it.
    if (this.config.level) {
      return this.config.level;
    }

    // Always use debug-level logging in development or test mode;
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      return 'trace';
    }

    // Use server-side-feature toggles to configure log levels
    var level = this.spark.device.features.developer.get('log-level');
    if (level) {
      if (contains(Object.keys(Logger.levels), level)) {
        return level;
      }
    }

    // Show verbose but not full-debug logging for team members;
    if (this.spark.device.features.entitlement.get('team-member')) {
      return 'log';
    }

    return 'error';
  },

  _shouldPrint: function _shouldPrint(level) {
    return Logger.levels[level] <= Logger.levels[this._getCurrentLevel()];
  },

  _cleanseMsg: function _cleanseMsg(msg) {
    if (msg && msg.headers) {
      delete msg.headers.Authorization;
    }
    if (msg && msg.options && msg.options.headers) {
      delete msg.options.headers.Authorization;
    }
  },

  error: wrapConsoleMethod('error'),
  warn: wrapConsoleMethod('warn'),
  log: wrapConsoleMethod('log'),
  info: wrapConsoleMethod('info'),
  debug: wrapConsoleMethod('debug'),
  trace: wrapConsoleMethod('trace')
});

assign(Logger,
  /** @lends Logger */
  {
  /**
   * @enum {string}
   */
  levels: {
    silent: 0,
    error: 1,
    warn: 2,
    log: 3,
    info: 4,
    debug: 5,
    trace: 6
  }
});

module.exports = Logger;
