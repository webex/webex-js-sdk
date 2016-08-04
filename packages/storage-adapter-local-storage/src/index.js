/**!
 *
 * Copyright (c) 2015 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

/* eslint-env browser */

const namespaces = new WeakMap();

export default class StorageAdapterLocalStorage {
  constructor(basekey) {
    this.Bound = class {
      constructor(namespace) {
        namespaces.set(this, namespace);
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
          const data = this._load();
          Reflect.deleteProperty(data, key);
          this._save(data);
          resolve();
        });
      }

      get(key) {
        return new Promise((resolve, reject) => {
          const data = this._load();
          const value = data[key];
          if (value) {
            return resolve(value);
          }

          return reject(new Error(`No value found for ${key}`));
        });
      }

      put(key, value) {
        return new Promise((resolve) => {
          const data = this._load();
          data[key] = value;
          this._save(data);
          resolve();
        });
      }
    };
  }

  bind(namespace) {
    return Promise.resolve(new this.Bound(namespace));
  }
}
