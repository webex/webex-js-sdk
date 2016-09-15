/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import SparkPlugin from '../lib/spark-plugin';
import {registerPlugin} from '../spark-core';

const precedence = {
  error: [`log`],
  warn: [`error`, `log`],
  info: [`log`],
  debug: [`info`, `log`],
  trace: [`debug`, `info`, `log`]
};

/**
 * Assigns the specified console method to Logger; uses `precedence` to fallback
 * to other console methods if the current environment doesn't provide the
 * specified level.
 * @param {string} level
 * @returns {Function}
 */
function wrapConsoleMethod(level) {
  /* eslint no-console: [0] */
  let impls = precedence[level];
  if (impls) {
    impls = impls.slice();
    while (!console[level]) {
      level = impls.pop();
    }
  }

  if (process.env.LOG_TIMESTAMPS) {
    return (...args) => console[level](Date.now(), ...args);
  }

  return console[level].bind(console);
}

const Logger = SparkPlugin.extend({
  namespace: `Logger`,
  error: wrapConsoleMethod(`error`),
  warn: wrapConsoleMethod(`warn`),
  log: wrapConsoleMethod(`log`),
  info: wrapConsoleMethod(`info`),
  debug: wrapConsoleMethod(`debug`),
  trace: wrapConsoleMethod(`trace`)
});

registerPlugin(`logger`, Logger);

export default Logger;
