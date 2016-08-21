/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

/* istanbul ignore next */
if (typeof Promise === 'undefined') {
  // eslint-disable-next-line global-require
  require('es6-promise').polyfill();
}

var backoffPattern = [0, 1000, 2000, 4000, 8000, 16000, 32000, 32000, 32000];

/**
 * @param {Function} fn
 * @returns {Object}
 */
function retry(fn) {
  return backoffPattern.reduce(function(promise, delay) {
    return promise.catch(function() {
      return new Promise(function(resolve) {
        setTimeout(function() {
          resolve(fn());
        }, delay);
      });
    });
  }, Promise.reject());
}

/**
 * Determines the expected timeout for the test.
 * @param {number} estimate estimated of how long a single attempt should take
 * @returns {number}
 */
function timeout(estimate) {
  return backoffPattern.reduce(function(sum, next) {return sum + next + estimate;}, 0);
}

module.exports = retry;
retry.timeout = timeout;
