/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint no-invalid-this: [0] */

import {
  curry,
  debounce,
  identity,
  result,
  wrap
} from 'lodash';
import {NotFoundError} from './errors';
import {make} from '@ciscospark/common';

/**
 * Stores the result of fn before returning it
 * @param  {string}   key
 * @returns {Promise} resolves with the result of fn
 */
export function persist(...args) {
  if (args.length === 3) {
    return persist(`@`)(...args);
  }

  const [key] = args;

  return function persistDecorator(target, prop, descriptor) {
    if (prop !== `initialize`) {
      // Once we have class-based alternative to AmpersandState, it should be
      // detected here.
      throw new TypeError(`@persist can only currently be applied to AmpersandState objects or their derivatives and must be applied to the initialize method`);
    }

    descriptor.value = wrap(descriptor.value, function persistExecutor(fn, ...initializeArgs) {
      // eslint-disable-next-line no-invalid-this
      const ret = Reflect.apply(fn, this, initializeArgs);
      const changeEvent = key === `@` ? `change` : `change:${key}`;

      // Some scenarios will lead to lots of change events on a single tick; we
      // really only care about writing once things have stopped changing. with
      // a debounce of zero, we're effectively coalescing all the changes
      // triggered by a single call to set() and commiting them on the next tick
      // eslint-disable-next-line no-invalid-this
      this.on(changeEvent, debounce(() => {
        if (key === `@`) {
          // eslint-disable-next-line no-invalid-this
          return this.boundedStorage.put(key, this);
        }

        // eslint-disable-next-line no-invalid-this
        return this.boundedStorage.put(key, this[key]);
      }, 0));
      return ret;
    });

    prepareInitialize(target, prop);
  };
}

const sym = Symbol();
const M = Map;
const S = Set;
const BlockingKeyMap = make(M, M, S);
const blockingKeys = new BlockingKeyMap();

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
    blockingKeys.add(target, prop, key);
    descriptor.value = wrap(descriptor.value, function waitForValueExecutor(fn, ...args) {
      const keys = blockingKeys.get(target, prop);
      return Promise.all([...keys].map((k) => this.boundedStorage.waitFor(k)))
        .then(() => Reflect.apply(fn, this, args));
    });

    // This *should* make decorators compatible with AmpersandState class
    // definitions
    if (typeof target === `object` && !target.prototype) {
      target[prop] = descriptor.value;
    }

    prepareInitialize(target, prop);

    return descriptor;
  };
}

/**
 * @param {Function} target
 * @param {string} prop
 * @returns {undefined}
 */
function prepareInitialize(target, prop) {
  if (!target[sym]) {
    target[sym] = true;
    if (target.initialize) {
      target.initialize = wrap(target.initialize, function applyInit(fn, ...args) {
        const ret = Reflect.apply(fn, this, args);
        Reflect.apply(init, this, args);
        return ret;
      });
      return;
    }

    target.initialize = init;
  }

  /**
   * @returns {undefined}
   */
  function init() {
    const self = this;
    this.spark.initialize = wrap(this.spark.initialize || identity, function applyInit(fn, ...args) {
      // Reminder: context here is `spark`, not `self`.
      Reflect.apply(fn, this, args);

      const set = curry((key, value) => {
        this.logger.info(`storage:(${self.getNamespace()}): got \`${key}\` for first time`);
        if (key === `@`) {
          self.parent.set({
            [self.getNamespace().toLowerCase()]: value
          });
        }
        else if (result(self[key], `isState`)) {
          self[key].set(value);
        }
        else {
          self.set(key, value);
        }
        this.logger.info(`storage:(${self.getNamespace()}): set \`${key}\` for first time`);
      });

      const handle = curry((key, reason) => {
        if (reason instanceof NotFoundError || process.env.NODE_ENV !== `production` && reason.toString().includes(`MockNotFoundError`)) {
          this.logger.info(`storage(${self.getNamespace()}): no data for \`${key}\`, continuing`);
          return Promise.resolve();
        }
        this.logger.error(`storage(${self.getNamespace()}): failed to init \`${key}\``, reason);
        return Promise.reject(reason);
      });

      const keys = blockingKeys.get(target, prop);
      keys.forEach((key) => this.boundedStorage.get(self.getNamespace(), key)
        .then(set(key))
        .catch(handle(key)));
    });
  }
}
