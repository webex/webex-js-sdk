/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {Defer, oneFlight} from '@webex/common';
import {isArray, isObject, result} from 'lodash';

import {NotFoundError} from './errors';

const defers = new WeakMap();

/**
 * Walks an object before writing it to the store and omits empty arrays
 * @private
 * @param {Object} value
 * @returns {Object}
 */
function serialize(value) {
  if (!isObject(value)) {
    return value;
  }

  const serialized = value.serialize ? value.serialize() : value;

  Object.keys(serialized).forEach((key) => {
    const val = serialized[key];

    if (isArray(val)) {
      if (val.length === 0) {
        serialized[key] = undefined;
      } else {
        serialized[key] = val.map(serialize);
      }
    } else if (isObject(val)) {
      Object.keys(val).forEach((k) => {
        val[k] = serialize(val[k]);
      });
    }
  });

  const empty = Object.keys(serialized).reduce((acc, key) => acc && !serialized[key], true);

  if (empty) {
    return undefined;
  }

  return serialized;
}

/**
 * [makeWebexPluginStorage description]
 * @param {[type]} type
 * @param {[type]} context
 * @private
 * @returns {[type]}
 */
export default function makeWebexPluginStorage(type, context) {
  /**
   * Interface between WebexPlugin and Webex#boundeStorage or
   * Webex#unboundedStorage
   */
  class WebexPluginStorage {
    /**
     * @param {Object} attrs
     * @param {Object} options
     * @returns {WebexPluginStorage}
     */
    constructor() {
      defers.set(this, new Map());
    }

    /**
     * Clears an entire namespace
     * @returns {Promise}
     */
    clear() {
      return context.webex[`${type}Storage`].del(context.getNamespace());
    }

    /**
     * Deletes the specified key from the store
     * @param {string} key
     * @returns {[type]}
     */
    del(...args) {
      return context.webex[`${type}Storage`].del(context.getNamespace(), ...args);
    }

    /**
     * Retrieves the value specified by key from the store. Rejects with
     * NotFoundError if no value can be found
     * @param {string} key
     * @returns {Promise}
     */
    get(key) {
      let defer = defers.get(this).get(key);

      if (!defer) {
        defer = new Defer();
        defers.get(this).set(key, defer);
      }

      return context.webex[`${type}Storage`].get(context.getNamespace(), key).then((res) => {
        defer.resolve();

        return res;
      });
    }

    /**
     * Writes a value to the store
     * @param {string} key
     * @param {any} value
     * @returns {Promise}
     */
    put(key, value) {
      return context.webex[`${type}Storage`].put(context.getNamespace(), key, serialize(value));
    }

    /**
     * Returns a Promise that won't resolve until the value specified by key has
     * been attempted to be loaded from the store. This allows us to lazily
     * prevent certain method from executing until the specified keys have been
     * retrieved from the store.
     * @param {string} key
     * @returns {Promise}
     */
    waitFor(key) {
      context.logger.debug(
        `plugin-storage(${context.getNamespace()}): waiting to init key \`${key}\``
      );
      const defer = defers.get(this).get(key);

      if (defer) {
        context.logger.debug(
          `plugin-storage(${context.getNamespace()}): already inited \`${key}\``
        );

        return defer.promise;
      }

      context.logger.debug(`plugin-storage(${context.getNamespace()}): initing \`${key}\``);

      return this.initValue(key);
    }

    @oneFlight({keyFactory: (key) => `initValue-${key}`})
    /**
     * Attempts to load the specified key from the store and set it on the parent
     * object.
     * @param {string} key
     * @returns {Promise} Resolves (but not with the retrieved value) when
     * the value retrieval complete
     */
    // suppress doc warning because decorators confuse eslint
    // eslint-disable-next-line require-jsdoc
    initValue(key) {
      const defer = new Defer();

      defers.get(this).set(key, defer);

      // Intentionally bypasses this.get so we don't resolve the promise until
      // after the parent value is set.
      context.webex[`${type}Storage`]
        .get(context.getNamespace(), key)
        .then((value) => {
          context.logger.debug(
            `plugin-storage(${context.getNamespace()}): got \`${key}\` for first time`
          );
          if (key === '@') {
            context.parent.set(value);
          } else if (result(context[key], 'isState')) {
            context[key].set(value);
          } else {
            context.set(key, value);
          }
          context.logger.debug(
            `plugin-storage(${context.getNamespace()}): set \`${key}\` for first time`
          );
          defer.resolve();
          context.logger.debug(`plugin-storage(${context.getNamespace()}): inited \`${key}\``);
        })
        .catch((reason) => {
          // The  next conditional is a bit of an unfortunate solution to deal
          // with circular dependencies in unit tests. It should not effect
          // integration tests or production code.
          if (
            reason instanceof NotFoundError ||
            (process.env.NODE_ENV !== 'production' &&
              reason.toString().includes('MockNotFoundError'))
          ) {
            context.logger.debug(
              `plugin-storage(${context.getNamespace()}): no data for \`${key}\`, continuing`
            );

            return defer.resolve();
          }
          context.logger.warn(
            `plugin-storage(${context.getNamespace()}): failed to init \`${key}\``,
            reason
          );

          return defer.reject(reason);
        });

      return defer.promise;
    }
  }

  return new WebexPluginStorage();
}
