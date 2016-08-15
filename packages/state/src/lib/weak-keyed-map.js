/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

const data = new WeakMap();
const sizes = new WeakMap();

/**
 * Container for instance-key-value triples.
 */
export default class WeakKeyedMap {
  /**
   * Constructor
   * @returns {WeakKeyedMap}
   */
  constructor() {
    data.set(this, new WeakMap());
    sizes.set(this, new WeakMap());
  }

  /**
   * Returns the number of instance-key-value triples in the map
   * @returns {Number}
   */
  get size() {
    return sizes.get(this);
  }

  /**
   *
   * Removes all triples from the map
   * @returns {undefined}
   */
  clear() {
    return data.delete(this);
  }

  /**
   * Removes the specified element from the object
   * @param {Object} instance
   * @param {any} key
   * @returns {boolean} Returns `true` if an element in the object existed and
   * has been removed, or `false` if the element does not exist.
   */
  delete(instance, key) {
    const dat = data.get(this);

    const instanceData = dat.get(instance);
    if (!instanceData) {
      return false;
    }

    const ret = instanceData.delete(key);
    if (instanceData.size === 0) {
      dat.delete(instance);
    }
    if (ret) {
      sizes.set(this, sizes.get(this) - 1);
    }
    return ret;
  }

  /**
   * Retrieves a value from the object
   * @param {Object} instance
   * @param {any} key
   * @returns {any}
   */
  get(instance, key) {
    const dat = data.get(this);
    const instanceData = dat.get(instance);
    if (!instanceData) {
      return undefined;
    }

    if (typeof key === `undefined`) {
      return new Map(instanceData);
    }

    return instanceData.get(key);
  }

  /**
   * Indicates if the object contains the specified value
   * @param {Object} instance
   * @param {any} key
   * @returns {any}
   */
  has(instance, key) {
    return Boolean(this.get(instance, key));
  }

  /**
   * Adds a value to the object
   * @param {Object} instance
   * @param {any} key
   * @param {any} value
   * @returns {WeakKeyedMap}
   */
  set(instance, key, value) {
    const dat = data.get(this);
    let instanceData = dat.get(instance);
    if (!instanceData) {
      instanceData = new Map();
      dat.set(instance, instanceData);
    }

    if (!instanceData.has(key)) {
      sizes.set(this, sizes.get(this) + 1);
    }

    instanceData.set(key, value);
    return this;
  }

}
