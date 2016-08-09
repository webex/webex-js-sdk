/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import {tap} from '@ciscospark/common';
import {identity, result, wrap} from 'lodash';
import {NotFoundError} from './errors';

/**
 * Stores the result of fn before returning it
 * @param  {string}   key
 * @returns {Promise} resolves with the result of fn
 */
export function persist(key) {
  if (!key) {
    throw new Error(`\`key\` is required`);
  }

  return function persistDecorator(target, prop, descriptor) {
    descriptor.value = wrap(descriptor.value, function persistExecutor(fn, ...args) {
      /* eslint no-invalid-this: [0] */
      return Reflect.apply(fn, this, args)
        .then(tap(() => {
          if (key === `@`) {
            return this.boundedStorage.put(key, this);
          }

          return this.boundedStorage.put(key, this[key]);
        }));
    });

    // This *should* make decorators compatible with AmpersandState class
    // definitions
    if (typeof target === `object` && !target.prototype) {
      target[prop] = descriptor.value;
    }

    prepareInitialize(target, key);

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

  return function waitForValueDecorator(target, prop, descriptor) {
    descriptor.value = wrap(descriptor.value, function waitForValueExecutor(fn, ...args) {
      return this.boundedStorage.waitFor(key)
        .then(() => Reflect.apply(fn, this, args));
    });

    // This *should* make decorators compatible with AmpersandState class
    // definitions
    if (typeof target === `object` && !target.prototype) {
      target[prop] = descriptor.value;
    }

    prepareInitialize(target, key);

    return descriptor;
  };
}

function prepareInitialize(target, key) {
  if (target.initialize) {
    target.initialize = wrap(target.initialize, function applyInit(fn, ...args) {
      const ret = Reflect.apply(fn, this, args);
      Reflect.apply(init, this, args);
      return ret;
    });
    return;
  }

  target.initialize = init;

  function init(attrs, options) {
    const self = this;
    this.spark.initialize = wrap(this.spark.initialize || identity, function applyInit(fn, ...args) {
      // Reminder: context here is `spark`, not `self`.
      Reflect.apply(fn, this, args);
      this.boundedStorage.get(self.getNamespace(), key)
        .then((value) => {
          this.logger.info(`storage:(${self.getNamespace()}): got \`${key}\` for first time`);
          if (key === `@`) {
            self.parent.set(value);
          }
          else if (result(self[key], `isState`)) {
            self[key].set(value);
          }
          else {
            self.set(key, value);
          }
          this.logger.info(`storage:(${self.getNamespace()}): set \`${key}\` for first time`);
        })
        .catch((reason) => {
          if (reason instanceof NotFoundError || process.env.NODE_ENV !== `production` && reason.toString().includes(`MockNotFoundError`)) {
            this.logger.info(`storage(${self.getNamespace()}): no data for \`${key}\`, continuing`);
            return Promise.resolve();
          }
          this.logger.error(`storage(${self.getNamespace()}): failed to init \`${key}\``, reason);
          return Promise.reject(reason);
        });
    });
  }
}
