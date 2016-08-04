/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import Events from 'ampersand-events';

const bindings = new WeakMap();
const parents = new WeakMap();

/**
 * Lazy Key-Value Storage Interface
 */
export default class Storage {
  /**
   * @param {Object} attrs
   * @param {Object} options
   * @returns {Storage}
   */
  constructor(attrs, options) {
    bindings.set(this, new Map());
    parents.set(this, options.parent);
  }

  /**
   * Provides easy access to the storage adapter identified in config.
   * @returns {Object}
   */
  get adapter() {
    return this.parent.config.storage.adapter;
  }

  /**
   * @returns {WeakMap}
   */
  get bindings() {
    return bindings.get(this);
  }

  /**
   * @returns {Object}
   */
  get parent() {
    return parents.get(this);
  }

  /**
   * @returns {Logger}
   */
  get logger() {
    return this.parent.logger;
  }

  /**
   * Deletes the specified key from the store
   * @param {string} namespace
   * @param {string} key
   * @returns {[type]}
   */
  del(namespace, key) {
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
    return this._getBinding(namespace)
      .then((binding) => binding.get(key));
  }

  /**
   * Writes a value to the store
   * @param {string} namespace
   * @param {string} key
   * @param {any} value
   * @returns {Promise} Resolves with value (to simplify write-through caching)
   */
  put(namespace, key, value) {
    if (typeof value === `undefined`) {
      throw new Error(`cannot put \`undefined\` in storage (namespace: ${namespace}; key: ${key})`);
    }

    return this._getBinding(namespace)
      .then((binding) => binding.put(key, value.serialize ? value.serialize() : value))
      .then(() => value);
  }

  /**
   * Creates an interface bound to the specified namespace
   * @param {string} namespace
   * @returns {Promise}
   */
  _getBinding(namespace) {
    return new Promise((resolve) => {
      this.logger.info(`storage: getting binding for \`${namespace}\``);
      const binding = this.bindings.get(namespace);
      if (binding) {
        this.logger.info(`storage: found binding for \`${namespace}\``);
        return resolve(binding);
      }

      return resolve(this.adapter.bind(namespace, this.parent)
        .then((_binding) => {
          this.logger.info(`storage: made binding for \`${namespace}\``);
          this.bindings.set(namespace, _binding);
          return _binding;
        }));
    });
  }
}

Object.assign(Storage.prototype, Events);
