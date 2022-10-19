/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */
import WebexPlugin from '../lib/webex-plugin';
import {registerPlugin} from '../webex-core';

const precedence = {
  error: ['log'],
  warn: ['error', 'log'],
  info: ['log'],
  debug: ['info', 'log'],
  trace: ['debug', 'info', 'log']
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

  return function wrappedConsoleMethod(...args) {
    /* eslint no-invalid-this: [0] */
    /* istanbul ignore if */
    if (process.env.NODE_ENV === 'test' && this.webex && this.webex.internal.device && this.webex.internal.device.url) {
      args.unshift(this.webex.internal.device.url.slice(-3));
    }
    console[level](...args);
  };
}

const Logger = WebexPlugin.extend({
  namespace: 'Logger',
  error: wrapConsoleMethod('error'),
  warn: wrapConsoleMethod('warn'),
  log: wrapConsoleMethod('log'),
  info: wrapConsoleMethod('info'),
  debug: wrapConsoleMethod('debug'),
  trace: wrapConsoleMethod('trace')
});

registerPlugin('logger', Logger);

export default Logger;
