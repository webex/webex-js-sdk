/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * Injects code into a promise chain without modifying the promise chain's result
 * @param {Function} fn
 * @returns {Promise}
 * @example
 * function f() {
 *   return Promise.resolve(5);
 * }
 *
 * return f()
 *   .then(tap(() => return 12)
 *   .then((res) => assert(res === 5);
 */
export default function tap(fn) {
  return (r) => new Promise((resolve) => {
    resolve(fn(r));
  })
    .then(() => r)
    .catch(() => r);
}
