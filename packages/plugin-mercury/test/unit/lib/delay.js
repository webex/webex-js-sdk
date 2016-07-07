/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

/**
 * Promisy wrapper around setTimeout for helping with tests.
 * @private
 * @param {number} timeout
 * @returns {Promise}
 */
export default function delay(timeout) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout);
  });
}
