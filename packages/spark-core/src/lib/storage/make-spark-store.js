/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import Events from 'ampersand-events';
import {oneFlight} from '@ciscospark/common';

const bindings = new WeakMap();

/**
 * Makes a SparkStore for the specified type bound to the specified spark instance
 * @param {string} type
 * @param {ProxySpark} spark
 * @returns {SparkStore}
 */
export default function makeSparkStore(type, spark) {

  /**
   * Lazy Key-Value Store Interface
   */
  class SparkStore {
    /**
     * @param {Object} attrs
     * @param {Object} options
     * @returns {Store}
     */
    constructor() {
      spark.logger.log(`spark-store: constructing ${type}Storage`);
      bindings.set(this, new Map());
    }

    /**
     * Provides easy access to the storage adapter identified in config.
     * @returns {Object}
     */
    get adapter() {
      return spark.config.storage[`${type}Adapter`];
    }

    /**
     * @returns {WeakMap}
     */
    get bindings() {
      return bindings.get(this);
    }

    /**
     * Deletes the specified key from the store
     * @param {string} namespace
     * @param {string} key
     * @returns {[type]}
     */
    del(namespace, key) {
      spark.logger.info(`spark-store: removing ${namespace}:${key}`);
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
      spark.logger.info(`spark-store: retrieving ${namespace}:${key}`);
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
      spark.logger.info(`spark-store: setting ${namespace}:${key}`);
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
    @oneFlight((namespace) => namespace)
    // suppress doc warning because decorators confuse eslint
    // eslint-disable-next-line require-jsdoc
    _getBinding(namespace) {
      return new Promise((resolve) => {
        spark.logger.info(`storage: getting binding for \`${namespace}\``);
        const binding = this.bindings.get(namespace);
        if (binding) {
          spark.logger.info(`storage: found binding for \`${namespace}\``);
          return resolve(binding);
        }

        return resolve(this.adapter.bind(namespace, {logger: spark.logger})
          .then((_binding) => {
            spark.logger.info(`storage: made binding for \`${namespace}\``);
            this.bindings.set(namespace, _binding);
            return _binding;
          }));
      });
    }
  }

  Object.assign(SparkStore.prototype, Events);

  return new SparkStore();
}
