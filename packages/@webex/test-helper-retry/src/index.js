/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint-disable max-nested-callbacks */

/* istanbul ignore next */
if (typeof Promise === 'undefined') {
  // eslint-disable-next-line global-require
  require('es6-promise').polyfill();
}

const backoffPattern = [0, 1000, 2000, 4000, 8000, 16000, 32000, 32000, 32000];

/**
 * @param {Function} fn
 * @returns {Object}
 */
function retry(fn) {
  return backoffPattern.reduce(
    (promise, delay) =>
      promise.catch(
        (err) =>
          new Promise((resolve) => {
            if (err) {
              console.error(`###Test error: ${err}. Retrying test in ${delay} seconds`);
            }

            setTimeout(() => {
              resolve(fn());
            }, delay);
          })
      ),
    Promise.reject()
  );
}

/**
 * Determines the expected timeout for the test.
 * @param {number} estimate estimated of how long a single attempt should take
 * @returns {number}
 */
function timeout(estimate) {
  return backoffPattern.reduce((sum, next) => sum + next + estimate, 0);
}

module.exports = retry;
retry.timeout = timeout;
