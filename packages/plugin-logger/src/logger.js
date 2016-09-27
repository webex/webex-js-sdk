/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-console: [0] */

import {
  SparkHttpError,
  SparkPlugin
} from '@ciscospark/spark-core';

import {
  cloneDeep,
  isArray,
  isObject
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

export const levels = Object.keys(precedence).filter((level) => level !== `silent`);

const fallbacks = {
  error: [`log`],
  warn: [`error`, `log`],
  info: [`log`],
  debug: [`info`, `log`],
  trace: [`debug`, `info`, `log`]
};

const re = /[Aa]uthorization/;
/**
 * Recursively strips "authorization" fields from the specified object
 * @param {Object} object
 * @returns {Object}
 */
function walkAndFilter(object) {
  if (isArray(object)) {
    return object.map(walkAndFilter);
  }
  if (!isObject(object)) {
    return object;
  }
  for (const key in object) {
    if (key.match(re)) {
      Reflect.deleteProperty(object, key);
    }
    else {
      console.log(key);
      console.log(object);
      object[key] = walkAndFilter(object[key]);
    }
  }
  return object;
}

const Logger = SparkPlugin.extend({
  namespace: `Logger`,

  session: {
    buffer: {
      type: `array`,
      default() {
        return [];
      }
    }
  },

  filter(...args) {
    return args.map((arg) => {
      // SparkHttpError already ensures auth tokens don't get printed, so, no
      // need to alter it here.
      if (arg instanceof Error) {
        // karma logs won't print subclassed errors correctly, so we need
        // explicitly call their tostring methods.
        if (process.env.NODE_ENV === `test` && typeof window !== `undefined`) {
          let ret = arg.toString();
          ret += `BEGIN STACK`;
          ret += arg.stack;
          ret += `END STACK`;
          return ret;
        }

        return arg;
      }

      arg = cloneDeep(arg);
      return walkAndFilter(arg);
    });
  },

  shouldPrint(level) {
    return precedence[level] <= precedence[this._getCurrentLevel()];
  },

  _getCurrentLevel() {
    // If a level has been explicitly set via config, alway use it.
    if (this.config.level) {
      return this.config.level;
    }

    // Always use debug-level logging in development or test mode;
    if (process.env.NODE_ENV === `development` || process.env.NODE_ENV === `test`) {
      return `trace`;
    }

    // Use server-side-feature toggles to configure log levels
    const level = this.spark.device && this.spark.device.features.developer.get(`log-level`);
    if (level) {
      if (levels.includes(level)) {
        return level;
      }
    }

    // Show verbose but not full-debug logging for team members;
    if (this.spark.device && this.spark.device.features.entitlement.get(`team-member`)) {
      return `log`;
    }

    return `error`;
  }
});

levels.forEach((level) => {
  let impls = fallbacks[level];
  let impl = level;
  if (impls) {
    impls = impls.slice();
    while (!console[impl]) {
      impl = impls.pop();
    }
  }

  Logger.prototype[level] = function wrappedConsoleMethod(...args) {
    try {
      const filtered = this.filter(...args);
      if (this.shouldPrint(level)) {
        console[impl](...filtered);
      }

      const stringified = filtered.map((item) => {
        if (item instanceof SparkHttpError) {
          return item.toString();
        }
        return item;
      });
      stringified.unshift(Date.now());
      this.buffer.push(stringified);
      if (this.buffer.length > this.config.historyLength) {
        this.buffer.shift();
      }
    }
    catch (reason) {
      /* istanbul ignore next */
      console.warn(`failed to execute Logger#${level}`, reason);
    }
  };
});


export default Logger;
