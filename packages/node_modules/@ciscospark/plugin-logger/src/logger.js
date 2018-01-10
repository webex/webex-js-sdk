/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {inBrowser, patterns} from '@ciscospark/common';

import {
  SparkHttpError,
  SparkPlugin
} from '@ciscospark/spark-core';

import {
  cloneDeep,
  has,
  isArray,
  isObject,
  isString
} from 'lodash';

const precedence = {
  silent: 0,
  error: 1,
  warn: 2,
  log: 3,
  info: 4,
  debug: 5,
  trace: 6
};

export const levels = Object.keys(precedence).filter((level) => level !== 'silent');

const fallbacks = {
  error: ['log'],
  warn: ['error', 'log'],
  info: ['log'],
  debug: ['info', 'log'],
  trace: ['debug', 'info', 'log']
};

const authTokenKeyPattern = /[Aa]uthorization/;

/**
 * Recursively strips "authorization" fields from the specified object
 * @param {Object} object
 * @private
 * @returns {Object}
 */
function walkAndFilter(object) {
  if (isArray(object)) {
    return object.map(walkAndFilter);
  }
  if (!isObject(object)) {
    if (isString(object)) {
      if (patterns.email.test(object)) {
        return '-- REDACTED --';
      }
    }
    return object;
  }

  for (const [key, value] of Object.entries(object)) {
    if (authTokenKeyPattern.test(key)) {
      Reflect.deleteProperty(object, key);
    }
    else {
      object[key] = walkAndFilter(value);
    }
  }

  return object;
}

/**
 * @class
 */
const Logger = SparkPlugin.extend({
  namespace: 'Logger',

  derived: {
    level: {
      cache: false,
      fn() {
        return this.getCurrentLevel();
      }
    }
  },
  session: {
    buffer: {
      type: 'array',
      default() {
        return [];
      }
    }
  },

  /**
   * Ensures auth headers don't get printed in logs
   * @param {Array<mixed>} args
   * @private
   * @memberof Logger
   * @returns {Array<mixed>}
   */
  filter(...args) {
    return args.map((arg) => {
      // SparkHttpError already ensures auth tokens don't get printed, so, no
      // need to alter it here.
      if (arg instanceof Error) {
        // karma logs won't print subclassed errors correctly, so we need
        // explicitly call their tostring methods.
        if (process.env.NODE_ENV === 'test' && inBrowser) {
          let ret = arg.toString();
          ret += 'BEGIN STACK';
          ret += arg.stack;
          ret += 'END STACK';
          return ret;
        }

        return arg;
      }

      arg = cloneDeep(arg);
      return walkAndFilter(arg);
    });
  },

  /**
   * Determines if the current level allows logs at the specified level to be
   * printed
   * @param {string} level
   * @private
   * @memberof Logger
   * @returns {boolean}
   */
  shouldPrint(level) {
    return precedence[level] <= precedence[this.getCurrentLevel()];
  },

  /**
   * Determines if the current level allows logs at the specified level to be
   * put into the log buffer. We're configuring it omit trace and debug logs
   * because there are *a lot* of debug logs that really don't provide value at
   * runtime (they're helpful for debugging locally, but really just pollute the
   * uploaded logs and push useful info out).
   * @param {string} level
   * @private
   * @memberof Logger
   * @returns {boolean}
   */
  shouldBuffer(level) {
    return precedence[level] <= precedence.info;
  },

  /**
   * Indicates the current log level based on env vars, feature toggles, and
   * user type.
   * @instance
   * @memberof Logger
   * @private
   * @memberof Logger
   * @returns {string}
   */
  // eslint-disable-next-line complexity
  getCurrentLevel() {
    // If a level has been explicitly set via config, alway use it.
    if (this.config.level) {
      return this.config.level;
    }

    if (levels.includes(process.env.CISCOSPARK_LOG_LEVEL)) {
      return process.env.CISCOSPARK_LOG_LEVEL;
    }

    // Always use debug-level logging in test mode;
    if (process.env.NODE_ENV === 'test') {
      return 'trace';
    }

    // Use server-side-feature toggles to configure log levels
    const level = this.spark.internal.device && this.spark.internal.device.features.developer.get('log-level');
    if (level) {
      if (levels.includes(level)) {
        return level;
      }
    }

    return 'error';
  }
});

levels.forEach((level) => {
  let impls = fallbacks[level];
  let impl = level;
  if (impls) {
    impls = impls.slice();
    // eslint-disable-next-line no-console
    while (!console[impl]) {
      impl = impls.pop();
    }
  }

  // Much of the complexity in the following function is due to a test-mode-only
  // helper
  // eslint-disable-next-line complexity
  Logger.prototype[level] = function wrappedConsoleMethod(...args) {
    try {
      const shouldPrint = this.shouldPrint(level);
      const shouldBuffer = this.shouldBuffer(level);
      if (!shouldBuffer && !shouldPrint) {
        return;
      }

      const filtered = this.filter(...args);
      const stringified = filtered.map((item) => {
        if (item instanceof SparkHttpError) {
          return item.toString();
        }
        return item;
      });

      if (shouldPrint) {
        // when logging an object in browsers, we tend to get a dynamic
        // reference, thus going back to look at the logged value doesn't
        // necessarily show the state at log time, thus we print the stringified
        // value.
        const toPrint = inBrowser ? stringified : filtered;
        /* istanbul ignore if */
        if (process.env.NODE_ENV === 'test' && has(this, 'spark.internal.device.url')) {
          toPrint.unshift(this.spark.internal.device.url.slice(-3));
        }
        // eslint-disable-next-line no-console
        console[impl](...toPrint);
      }

      if (shouldBuffer) {
        stringified.unshift(Date.now());
        this.buffer.push(stringified);
        if (this.buffer.length > this.config.historyLength) {
          this.buffer.shift();
        }
      }
    }
    catch (reason) {
      /* istanbul ignore next */
      // eslint-disable-next-line no-console
      console.warn(`failed to execute Logger#${level}`, reason);
    }
  };
});

export default Logger;
