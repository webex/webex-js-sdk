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
export default class StorageAdapterLocalForage {
  /**
   * @constructs {StorageAdapterLocalForage}
   * @param {string} basekey localforage key under which
   * all namespaces will be stored
   */
  constructor() {
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
       * Removes the specified key
       * @param {string} key
       * @returns {Promise}
       */
      del(key) {
        const key_ = `${namespaces.get(this)}/${key}`;
        loggers.get(this).info(`local-forage-store-adapter: deleting \`${key_}\``);
        return localforage.removeItem(key_);
      }

      /**
       * Retrieves the data at the specified key
       * @param {string} key
       * @see https://localforage.github.io/localForage/#data-api-getitem
       * @returns {Promise<mixed>}
       */
      get(key) {
        const key_ = `${namespaces.get(this)}/${key}`;
        loggers.get(this).info(`local-forage-store-adapter: reading \`${key_}\``);
        return localforage.getItem(key_)
          .then((value) => {
            // if the key does not exist, getItem() will return null
            if (value === null) {
              return localforage.keys()
                .then((keys) => {
                  if (keys.indexOf(key_) > -1) {
                    return Promise.resolve(value);
                  }
                  return Promise.reject(new NotFoundError(`No value found for ${key_}`));
                });
            }
            //  even if undefined is saved, null will be returned by getItem()
            return Promise.resolve(value);
          });
      }

      /**
       * Stores the specified value at the specified key.
       * If key is undefined, removes the specified key.
       * @param {string} key
       * @param {mixed} value
       * @returns {Promise}
       */
      put(key, value) {
        if (typeof value === `undefined`) {
          return this.del(key);
        }
        const key_ = `${namespaces.get(this)}/${key}`;
        loggers.get(this).info(`local-forage-store-adapter: writing \`${key_}\``);
        return localforage.setItem(key_, value);
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

    options.logger.info(`local-forage-store-adapter: returning binding`);

    return Promise.resolve(new this.Bound(namespace, options));
  }
}
