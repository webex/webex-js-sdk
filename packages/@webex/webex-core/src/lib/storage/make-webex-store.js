/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import Events from 'ampersand-events';
import {oneFlight} from '@webex/common';

const bindings = new WeakMap();

/**
 * Makes a WebexStore for the specified type bound to the specified webex instance
 * @param {string} type
 * @param {ProxyWebex} webex
 * @private
 * @returns {WebexStore}
 */
export default function makeWebexStore(type, webex) {
  /**
   * Lazy Key-Value Store Interface
   */
  class WebexStore {
    /**
     * @param {Object} attrs
     * @param {Object} options
     * @returns {Store}
     */
    constructor() {
      webex.logger.debug(`webex-store: constructing ${type}Storage`);
      bindings.set(this, new Map());
    }

    /**
     * Provides easy access to the storage adapter identified in config.
     * @returns {Object}
     */
    get adapter() {
      return webex.config.storage[`${type}Adapter`];
    }

    /**
     * @returns {WeakMap}
     */
    get bindings() {
      return bindings.get(this);
    }

    /**
     * Clears the store
     * @returns {Promise}
     */
    clear() {
      const promises = [];

      this.bindings.forEach((binding) => {
        promises.push(binding.clear());
      });

      return Promise.all(promises);
    }

    /**
     * Deletes the specified key from the store
     * @param {string} namespace
     * @param {string} key
     * @returns {[type]}
     */
    del(namespace, key) {
      webex.logger.debug(`webex-store: removing ${namespace}:${key}`);

      return this._getBinding(namespace)
        .then((binding) => binding.del(key));
    }

    /**
     * Retrieves the value specified by key from the store. Rejects with
     * NotFoundError if no value can be found
     * @param {string} namespace
     * @param {string} key
     * @returns {Promise}
     */
    get(namespace, key) {
      webex.logger.debug(`webex-store: retrieving ${namespace}:${key}`);

      return this._getBinding(namespace)
        .then((binding) => binding.get(key));
    }

    /**
     * Writes a value to the store. Deletes the specified key from the store
     * if passed `undefined`
     * @param {string} namespace
     * @param {string} key
     * @param {any} value
     * @returns {Promise} Resolves with value (to simplify write-through caching)
     */
    put(namespace, key, value) {
      if (typeof value === 'undefined') {
        return this.del(namespace, key);
      }
      webex.logger.debug(`webex-store: setting ${namespace}:${key}`);

      return this._getBinding(namespace)
        .then((binding) => binding.put(key, value.serialize ? value.serialize() : value))
        .then(() => value);
    }

    @oneFlight({keyFactory: (namespace) => namespace})
    /**
     * Creates an interface bound to the specified namespace
     * @param {string} namespace
     * @private
     * @returns {Promise}
     */
    // suppress doc warning because decorators confuse eslint
    // eslint-disable-next-line require-jsdoc
    _getBinding(namespace) {
      return new Promise((resolve) => {
        webex.logger.debug(`storage: getting binding for \`${namespace}\``);
        const binding = this.bindings.get(namespace);

        if (binding) {
          webex.logger.debug(`storage: found binding for \`${namespace}\``);

          return resolve(binding);
        }

        return resolve(this.adapter.bind(namespace, {logger: webex.logger})
          .then((_binding) => {
            webex.logger.debug(`storage: made binding for \`${namespace}\``);
            this.bindings.set(namespace, _binding);

            return _binding;
          }));
      });
    }
  }

  Object.assign(WebexStore.prototype, Events);

  return new WebexStore();
}
