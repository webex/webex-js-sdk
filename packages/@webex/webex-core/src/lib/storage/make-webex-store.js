/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {EventEmitter} from 'events';
import {oneFlight} from '@webex/common';
import MemoryStoreAdapter from './memory-store-adapter';

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
  class WebexStore extends EventEmitter {
    /**
     * @param {Object} attrs
     * @param {Object} options
     * @returns {Store}
     */
    constructor() {
      super(); // Initialize EventEmitter
      webex.logger.debug(`webex-store: constructing ${type}Storage`);
      bindings.set(this, new Map());
      this._adapter = null; // Cache for lazy-loaded adapter
    }

    /**
     * Provides easy access to the storage adapter identified in config.
     * Implements lazy loading like the old AmpState derived properties.
     * @returns {Object}
     */
    get adapter() {
      // Return cached adapter if available
      if (this._adapter) {
        return this._adapter;
      }

      // Safety check: ensure storage config exists before accessing adapter
      if (!webex.config || !webex.config.storage) {
        webex.logger.warn(
          `webex-store: storage config not available for ${type}Storage, using MemoryStoreAdapter`
        );
        // Use MemoryStoreAdapter as fallback
        this._adapter = MemoryStoreAdapter;

        return this._adapter;
      }

      const adapter = webex.config.storage[`${type}Adapter`];
      if (!adapter) {
        webex.logger.warn(
          `webex-store: ${type}Adapter not found in config, using MemoryStoreAdapter`
        );
        // Use MemoryStoreAdapter as fallback
        this._adapter = MemoryStoreAdapter;

        return this._adapter;
      }

      // Cache the adapter for future use
      this._adapter = adapter;

      return this._adapter;
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

      return Promise.all(promises).then((result) => {
        // Emit clear event for listeners
        this.emit('clear');

        return result;
      });
    }

    /**
     * Deletes the specified key from the store
     * @param {string} namespace
     * @param {string} key
     * @returns {[type]}
     */
    del(namespace, key) {
      webex.logger.debug(`webex-store: removing ${namespace}:${key}`);

      return this._getBinding(namespace).then((binding) => {
        return binding.del(key).then((result) => {
          // Emit delete event for listeners
          this.emit('delete', namespace, key);

          return result;
        });
      });
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

      return this._getBinding(namespace).then((binding) => {
        return binding.get(key).then((value) => {
          // Emit get event for listeners (useful for caching strategies)
          this.emit('get', namespace, key, value);

          return value;
        });
      });
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
        .then(() => {
          // Emit put event for listeners
          this.emit('put', namespace, key, value);

          return value;
        });
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

        return resolve(
          this.adapter.bind(namespace, {logger: webex.logger}).then((_binding) => {
            webex.logger.debug(`storage: made binding for \`${namespace}\``);
            this.bindings.set(namespace, _binding);

            // Emit binding created event
            this.emit('binding:created', namespace, _binding);

            return _binding;
          })
        );
      });
    }
  }

  return new WebexStore();
}
