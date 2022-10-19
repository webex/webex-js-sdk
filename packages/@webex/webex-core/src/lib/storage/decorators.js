/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

/* eslint no-invalid-this: [0] */

import {
  curry,
  debounce,
  identity,
  result,
  wrap
} from 'lodash';
import {make} from '@webex/common';

import {NotFoundError} from './errors';

/**
 * Stores the result of fn before returning it
 * @param  {string} key
 * @private
 * @returns {Promise} resolves with the result of fn
 */
export function persist(...args) {
  if (args.length === 3) {
    return persist('@')(...args);
  }

  const [key, decider] = args;

  return function persistDecorator(target, prop, descriptor) {
    if (prop !== 'initialize') {
      // Once we have class-based alternative to AmpersandState, it should be
      // detected here.
      throw new TypeError('@persist can only currently be applied to AmpersandState objects or their derivatives and must be applied to the initialize method');
    }

    descriptor.value = wrap(descriptor.value, function persistExecutor(fn, ...initializeArgs) {
      const ret = Reflect.apply(fn, this, initializeArgs);
      const changeEvent = key === '@' ? 'change' : `change:${key}`;

      // Some scenarios will lead to lots of change events on a single tick; we
      // really only care about writing once things have stopped changing. with
      // a debounce of zero, we're effectively coalescing all the changes
      // triggered by a single call to set() and commiting them on the next tick
      // eslint-disable-next-line no-invalid-this
      this.on(changeEvent, debounce(() => {
        const shouldPersist = !decider || Reflect.apply(decider, this, ...initializeArgs);

        if (!shouldPersist) {
          return Promise.resolve();
        }
        if (key === '@') {
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

const M = Map;
const S = Set;
const BlockingKeyMap = make(M, M, S);
const blockingKeys = new BlockingKeyMap();

/**
 * Prevents fn from executing until key has been (attempted to be) loaded
 * @param {string} key
 * @param {Function} fn
 * @private
 * @returns {Promise} result of fn
 */
export function waitForValue(key) {
  if (!key) {
    throw new Error('`key` is required');
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
    if (typeof target === 'object' && !target.prototype) {
      target[prop] = descriptor.value;
    }

    prepareInitialize(target, prop);

    return descriptor;
  };
}

const inited = new Set();

/**
 * finds a means of identitying the `target` param passed to
 * `prepareInitialize()`. When possible, avoids duplicate `init()` calls if
 * namespaces collide
 *
 * @param {Object|Constructor} target
 * @private
 * @returns {String|Constructor}
 */
function identifyTarget(target) {
  if (target.namespace) {
    return target.namespace;
  }

  return target;
}

const stack = new Set();

/**
 * @param {Function} target
 * @param {string} prop
 * @private
 * @returns {undefined}
 */
function prepareInitialize(target, prop) {
  const id = identifyTarget(target);

  if (!inited.has(id)) {
    inited.add(id);
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
   * @private
   * @returns {undefined}
   */
  function init() {
    const self = this;
    const namespace = this.getNamespace();

    this.webex.initialize = wrap(this.webex.initialize || identity, function applyInit(fn, ...args) {
      // Call webex's initalize method first
      // Reminder: in order for MockWebex to accept initial storage data, the
      // wrapped initialize() must be invoked before attempting to load data.
      // Reminder: context here is `webex`, not `self`.
      stack.add(namespace);
      Reflect.apply(fn, this, args);

      // Then prepare a function for setting values retrieved from storage
      const set = curry((key, value) => {
        this.logger.debug(`storage:(${namespace}): got \`${key}\` for first time`);
        if (key === '@') {
          self.parent.set({
            [namespace.toLowerCase()]: value
          });
        }
        else if (result(self[key], 'isState')) {
          self[key].set(value);
        }
        else {
          self.set(key, value);
        }
        this.logger.debug(`storage:(${namespace}): set \`${key}\` for first time`);
      });

      // And prepare an error handler for when those keys can't be found
      const handle = curry((key, reason) => {
        if (reason instanceof NotFoundError || process.env.NODE_ENV !== 'production' && reason.toString().includes('MockNotFoundError')) {
          this.logger.debug(`storage(${namespace}): no data for \`${key}\`, continuing`);

          return Promise.resolve();
        }
        this.logger.error(`storage(${namespace}): failed to init \`${key}\``, reason);

        return Promise.reject(reason);
      });

      // Iterate over the list of keys marked as blocking via `@waitForValue`
      const keys = blockingKeys.get(target, prop);
      const promises = [];

      keys.forEach((key) => {
        promises.push(this.boundedStorage.get(namespace, key)
          .then(set(key))
          .catch(handle(key)));
      });

      Promise.all(promises)
        .then(() => {
          stack.delete(namespace);
          if (stack.size === 0) {
            this.loaded = true;
          }
        });
    });
  }
}
