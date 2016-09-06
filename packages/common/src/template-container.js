/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import util from 'util';

/**
 * Factory which produces a multi-keyed container based on the provided set of
 * constructors
 * @param {mixed} containers
 * @returns {Container}
 */
function make(...containers) {
  const TopContainer = containers.shift();

  const data = new WeakMap();
  const sizes = new WeakMap();

  const ChildContainer = containers.length > 1 ? make(...containers) : containers[0];

  const name = `(${[TopContainer.name].concat(containers.map((container) => container.name)).join(`, `)})`;

  /**
   * Container that wraps an arbitrary set of tupples to their values
   */
  class Container {
    /**
     * @constructs Container
     */
    constructor(...args) {
      data.set(this, new TopContainer(...args));
      sizes.set(this, 0);
    }

    /**
     * getter for .size
     * @returns {number}
     */
    get size() {
      return sizes.get(this);
    }

    /**
     * Identical to Container#set() but leads slightly more intuitive code when
     * the container is based on a Set rather than a Map.
     * @returns {Container}
     */
    add(...args) {
      return this.set(...args);
    }

    /**
     * Removes all items from the container
     * @returns {undefined}
     */
    clear() {
      const ret = data.get(this).clear();
      sizes.set(this, 0);
      return ret;
    }

    /**
     * Removes the specified item to the container
     * @param {mixed} key
     * @param {Array<mixed>} keys
     * @returns {boolean}
     */
    delete(key, ...keys) {
      const mine = data.get(this);
      if (!keys.length) {
        return mine.delete(key);
      }

      const next = mine.get(key);
      if (!next) {
        return false;
      }

      const ret = next.delete(...keys);

      if (ret) {
        sizes.set(this, sizes.get(this) - 1);
      }

      if (next.size === 0) {
        mine.delete(key);
      }

      return ret;
    }

    /**
     * Retrieves the specified item from the container
     * @param {mixed} key
     * @param {Array<mixed>} keys
     * @returns {mixed}
     */
    get(key, ...keys) {
      const mine = data.get(this);

      if (!mine.get) {
        return mine;
      }

      if (!keys.length) {
        return mine.get(key);
      }

      const next = mine.get(key);
      if (!next) {
        return undefined;
      }

      if (!next.get) {
        return next;
      }
      return next.get(...keys);
    }

    /**
     * Indicates whether the container holds the specified item
     * @param {mixed} key
     * @param {Array<mixed>} keys
     * @returns {Boolean}
     */
    has(...args) {
      return typeof this.get(...args) !== `undefined`;
    }

    /**
     * Stores the specified item in the container
     * @param {mixed} key
     * @param {Array<mixed>} args
     * @param {mixed} value
     * @returns {Container}
     */
    set(...args) {
      let overwrite = false;
      if (this.has(...args)) {
        overwrite = true;
      }
      const mine = data.get(this);

      const key = args.shift();

      if (!mine.get) {
        insert(mine, key, ...args);
        return this;
      }

      let next = mine.get(key);
      if (!next) {
        if (!ChildContainer) {
          insert(mine, key, ...args);
          return this;
        }
        next = new ChildContainer();
        insert(mine, key, next);
      }
      insert(next, ...args);

      if (!overwrite) {
        sizes.set(this, sizes.get(this) + 1);
      }
      return this;
    }

    /**
     * @private
     * @returns {string}
     */
    inspect() {
      return `Container${name} {
  ${util.inspect(data.get(this), {depth: null})}
}`;
    }
  }

  return Container;
}

/**
 * Inserts into an arbitrary container
 * @param {Map|WeakMap|Set|WeakSet} container
 * @param {Array<mixed>} args
 * @private
 * @returns {undefined}
 */
function insert(container, ...args) {
  if (container.add) {
    container.add(...args);
    return;
  }

  if (container.set) {
    container.set(...args);
    return;
  }

  if (container.push) {
    container.push(...args);
    return;
  }
  throw new TypeError(`Could not determine how to insert into the specified container`);
}
export {make as default};
