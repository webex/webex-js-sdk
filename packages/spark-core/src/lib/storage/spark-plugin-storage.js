/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import {Defer, oneFlight} from '@ciscospark/common';
import {NotFoundError} from './errors';
import SparkPlugin2 from '../spark-plugin-2';

const defers = new WeakMap();

/**
 * AmpersandState#children compatible, lazily-bound interface to Spark#storage
 */
export default class SparkPluginStorage extends SparkPlugin2 {
  /**
   * @param {Object} attrs
   * @param {Object} options
   * @returns {SparkPluginStorage}
   */
  constructor(...args) {
    super(...args);
    defers.set(this, new Map());
  }

  /**
   * Clears an entire namespace
   * @returns {Promise}
   */
  clear() {
    return this.spark.storage.del(this.namespace);
  }

  /**
   * Deletes the specified key from the store
   * @param {string} key
   * @returns {[type]}
   */
  del(...args) {
    return this.spark.storage.del(this.namespace, ...args);
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

    return this.spark.storage.get(this.namespace, key)
      .then((res) => {
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
  put(...args) {
    return this.spark.storage.put(this.namespace, ...args);
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
    this.logger.info(`plugin-storage(${this.namespace}): waiting to init key \`${key}\``);
    const defer = defers.get(this).get(key);
    if (defer) {
      this.logger.info(`plugin-storage(${this.namespace}): already inited \`${key}\``);
      return defer.promise;
    }

    this.logger.info(`plugin-storage(${this.namespace}): initing \`${key}\``);
    return this.initValue(key);
  }

  /**
   * Attempts to load the specified key from the store and set it on the parent
   * object.
   * @param {string} key
   * @returns {Promise} Resolves (but not with the retrieved value) when
   * the value retrieval complete
   */
  @oneFlight({keyFactory: (key) => `initValue-${key}`})
  initValue(key) {
    const defer = new Defer();

    // Intentionally bypasses this.get so we don't resolve the promise until
    // after the parent value is set.
    this.spark.storage.get(this.namespace, key)
      .then((value) => {
        this.logger.info(`plugin-storage(${this.namespace}): got \`${key}\` for first time`);
        if (key === `@`) {
          this.parent.set(value);
        }
        else {
          this.parent.set(key, value);
        }
        this.logger.info(`plugin-storage(${this.namespace}): set \`${key}\` for first time`);
        defer.resolve();
        this.logger.info(`plugin-storage(${this.namespace}): inited \`${key}\``);
      })
      .catch((reason) => {
        // The  next conditional is a bit of an unfortunate solution to deal
        // with circular dependencies in unit tests. It should not effect
        // integration tests or production code.
        if (reason instanceof NotFoundError || process.env.NODE_ENV !== `production` && reason.toString().includes(`MockNotFoundError`)) {
          this.logger.info(`plugin-storage(${this.namespace}): no data for \`${key}\`, continuing`);
          return defer.resolve();
        }
        this.logger.info(`plugin-storage(${this.namespace}): failed to init \`${key}\``, reason);
        return defer.reject(reason);
      });

    return defer.promise;
  }
}
