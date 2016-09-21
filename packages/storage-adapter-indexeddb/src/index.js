/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

 /* eslint-env browser */

import localforage from 'localforage';

import {NotFoundError} from '@ciscospark/spark-core';

const namespaces = new WeakMap();
const loggers = new WeakMap();

/**
* IndexedDB adapter for spark-core storage layer
*/
export default class StorageAdapterIndexedDB {
  /**
   * @constructs {StorageAdapterIndexedDB}
   * @param {string} basekey localforage key under which
   * all namespaces will be stored
   */
  constructor(basekey) {
    /**
     * localforage binding
     */
    this.Bound = class {
      /**
       * @constructs {Bound}
       * @param {string} namespace
       * @param {Object} options
       */
      constructor(namespace, options) {
        namespaces.set(this, namespace);
        loggers.set(this, options.logger);
      }

      /**
       * @param {Object} data
       * @private
       * @returns {undefined}
       */
      _save(data) {
        const rawData = localforage.getItem(basekey);
        const allData = rawData ? JSON.parse(rawData) : {};
        allData[namespaces.get(this)] = data;

        localforage.setItem(basekey, JSON.stringify(allData));
      }

      /**
       * Removes the specified key
       * @param {string} key
       * @returns {Promise}
       */
      del(key) {
        return new Promise((resolve) => {
          loggers.get(this).info(`indexeddb-store-adapter: deleting \`${key}\``);
          const data = this._load();
          Reflect.deleteProperty(data, key);
          this._save(data);
          resolve();
        });
      }

      /**
       * Retrieves the data at the specified key
       * @param {string} key
       * @returns {Promise<mixed>}
       */
      get(key) {
        return new Promise((resolve, reject) => {
          loggers.get(this).info(`indexeddb-store-adapter: reading \`${key}\``);

          return localforage.getItem(key)
            .then((value) => {
              if (value) {
                return resolve(value);
              }
              return reject(new NotFoundError(`No value found for ${key}`));
            });
        });
      }

      /**
       * Stores the specified value at the specified key
       * @param {string} key
       * @param {mixed} value
       * @returns {Promise}
       */
      put(key, value) {
        loggers.get(this).info(`indexeddb-store-adapter: writing \`${key}\``);
        return localforage.setItem(key, value);
      }
    };
  }

  /**
  * Returns an adapter bound to the specified namespace
  * @param {string} namespace
  * @param {Object} options
  * @returns {Promise<Bound>}
  */
  bind(namespace, options) {
    options = options || {};
    if (!namespace) {
      return Promise.reject(new Error(`\`namespace\` is required`));
    }

    if (!options.logger) {
      return Promise.reject(new Error(`\`options.logger\` is required`));
    }

    options.logger.info(`indexeddb-store-adapter: returning binding`);

    return Promise.resolve(new this.Bound(namespace, options));
  }
}
