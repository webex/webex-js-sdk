/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

// Note: these are not currently decorators as describe by the spec. Once the
// spec is ratified and implemented somewhere, these should be refactored.

import {tap} from '@ciscospark/common';
import {wrap} from 'lodash';

/**
 * Stores the result of fn before returning it
 * @param  {string}   key
 * @returns {Promise} resolves with the result of fn
 */
export function persist(key) {
  if (!key) {
    throw new Error(`\`key\` is required`);
  }

  return function decorate(target, prop, descriptor) {
    descriptor.value = wrap(descriptor.value, function executor(fn, ...args) {
      /* eslint no-invalid-this: [0] */
      return Reflect.apply(fn, this, args)
        .then(tap(() => {
          if (key === `@`) {
            this.storage.put(key, this);
          }
          else {
            this.storage.put(key, this[key]);
          }
        }));
    });

    // This *should* make decorators compatible with AmpersandState class
    // definitions
    if (typeof target === `object` && !target.prototype) {
      target[prop] = descriptor.value;
    }

    return descriptor;
  };
}

/**
 * Prevents fn from executing until key has been (attempted to be) loaded
 * @param {string} key
 * @param {Function} fn
 * @returns {Promise} result of fn
 */
export function waitForValue(key) {
  if (!key) {
    throw new Error(`\`key\` is required`);
  }

  return function decorate(target, prop, descriptor) {
    descriptor.value = wrap(descriptor.value, function _waitForValue(fn, ...args) {
      return this.storage.waitFor(key)
        .then(() => Reflect.apply(fn, this, args));
    });

    // This *should* make decorators compatible with AmpersandState class
    // definitions
    if (typeof target === `object` && !target.prototype) {
      target[prop] = descriptor.value;
    }

    return descriptor;
  };
}
