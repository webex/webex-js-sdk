/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

module.exports = function cappedDebounce(fn, wait, options) {
  if (!fn) {
    throw new Error('`fn` must be a function');
  }

  if (!wait) {
    throw new Error('`wait` is required');
  }

  options = options || {};
  if (!options.maxWait) {
    throw new Error('`options.maxWait` is required');
  }
  if (!options.maxCalls) {
    throw new Error('`options.maxCalls` is required');
  }

  var maxCalls = options.maxCalls;
  var maxWait = options.maxWait;

  var count = 0;

  var waitTimer;
  var maxWaitTimer;
  return function wrapper() {
    count++;
    clearTimeout(waitTimer);
    waitTimer = setTimeout(exec.bind(this), wait);

    if (!maxWaitTimer) {
      maxWaitTimer = setTimeout(exec.bind(this), maxWait);
    }

    if (count > maxCalls) {
      exec.call(this);
      return;
    }
  };

  function exec() {
    clearTimeout(waitTimer);
    waitTimer = undefined;
    clearTimeout(maxWaitTimer);
    maxWaitTimer = undefined;
    count = 0;

    fn.call(this);
  }
};
