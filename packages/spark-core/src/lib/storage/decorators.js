/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

// Note: these are not currently decorators as describe by the spec. Once the
// spec is ratified and implemented somewhere, these should be refactored.

import {tap} from '@ciscospark/common';

/**
 * Stores the result of fn before returning it
 * @param  {string}   key
 * @param  {Function} fn
 * @returns {Promise} resolves with the result of fn
 */
export function persistResult(key, fn) {
  if (!key) {
    throw new Error(`\`key\` is required`);
  }

  if (!fn) {
    throw new Error(`\`fn\` is required`);
  }

  return function _persistValue(...args) {
    return Reflect.apply(fn, this, args)
      .then(tap(() => {
        if (key === `@`) {
          this.storage.put(key, this);
        }
        else {
          this.storage.put(key, this[key]);
        }
      }));
  };

}

/**
 * Prevents fn from executing until key has been (attempted to be) loaded
 * @param {string} key
 * @param {Function} fn
 * @returns {Promise} result of fn
 */
export function waitForValue(key, fn) {
  if (!key) {
    throw new Error(`\`key\` is required`);
  }

  if (!fn) {
    throw new Error(`\`fn\` is required`);
  }

  return function _waitForValue(...args) {
    return this.storage.waitFor(key)
      .then(() => Reflect.apply(fn, this, args));
  };
}

/**
 * combination of waitForValue and persistResult
 * @param {string} key
 * @param {Function} fn
 * @returns {Promise}
 */
export function waitForValueAndPersistResult(key, fn) {
  return waitForValue(key, persistResult(key, fn));
}
