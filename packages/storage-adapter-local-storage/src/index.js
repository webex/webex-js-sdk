/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint-env browser */

import {NotFoundError} from '@ciscospark/spark-core';

const namespaces = new WeakMap();
const loggers = new WeakMap();

export default class StorageAdapterLocalStorage {
  constructor(basekey) {
    this.Bound = class {
      constructor(namespace, options) {
        namespaces.set(this, namespace);
        loggers.set(this, options.logger);
      }

      _load() {
        const rawData = localStorage.getItem(basekey);
        const allData = rawData ? JSON.parse(rawData) : {};
        return allData[namespaces.get(this)] || {};
      }

      _save(data) {
        const rawData = localStorage.getItem(basekey);
        const allData = rawData ? JSON.parse(rawData) : {};
        allData[namespaces.get(this)] = data;

        localStorage.setItem(basekey, JSON.stringify(allData));
      }

      del(key) {
        return new Promise((resolve) => {
          loggers.get(this).info(`local-storage-store-adapter: deleting \`${key}\``);
          const data = this._load();
          Reflect.deleteProperty(data, key);
          this._save(data);
          resolve();
        });
      }

      get(key) {
        return new Promise((resolve, reject) => {
          loggers.get(this).info(`local-storage-store-adapter: reading \`${key}\``);
          const data = this._load();
          const value = data[key];
          if (value) {
            return resolve(value);
          }

          return reject(new NotFoundError(`No value found for ${key}`));
        });
      }

      put(key, value) {
        return new Promise((resolve) => {
          loggers.get(this).info(`local-storage-store-adapter: writing \`${key}\``);
          const data = this._load();
          data[key] = value;
          this._save(data);
          resolve();
        });
      }
    };
  }

  bind(namespace, options) {
    options = options || {};
    if (!namespace) {
      return Promise.reject(new Error(`\`namespace\` is required`));
    }

    if (!options.logger) {
      return Promise.reject(new Error(`\`options.logger\` is required`));
    }

    options.logger.info(`local-storage-store-adapter: returning binding`);

    return Promise.resolve(new this.Bound(namespace, options));
  }
}
