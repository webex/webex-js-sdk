/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

import Events from 'ampersand-events';

const namespaces = new WeakMap();
const parents = new WeakMap();

// TODO SparkPlugin2 should probably be based on AmpersandState
/**
 * AmpersandState#children compatible plugin base
 */
export default class SparkPlugin2 {
  /**
   * @returns {Object}
   */
  get config() {
    const namespace = this.getNamespace();
    if (namespace) {
      return this.spark.config[namespace.toLowerCase()];
    }

    return this.spark.config;
  }

  /**
   * @returns {Logger}
   */
  get logger() {
    return this.spark.logger;
  }

  /**
   * @returns {string}
   */
  get namespace() {
    return namespaces.get(this);
  }

  /**
   * @returns {Object}
   */
  get parent() {
    return parents.get(this);
  }

  /**
   * @returns {ProxySpark}
   */
  get spark() {
    return this.parent.spark || this.parent;
  }

  /**
   * @param {Object} attrs
   * @param {Object} options
   * @returns {SparkPlugin2}
   */
  constructor(attrs, options) {
    parents.set(this, options.parent);
    if (attrs && attrs.namespace) {
      namespaces.set(this, attrs.namespace);
    }
    else {
      namespaces.set(this, this.parent.namespace);
    }
  }

  /**
   * noop provided for compatibility with AmpersandState
   * @private
   * @returns {null}
   */
  clear() {
    // noop
  }

  /**
   * noop provided for compatibility with AmpersandState
   * @private
   * @returns {Object}
   */
  serialize() {
    return {};
  }
}

Object.assign(SparkPlugin2.prototype, Events);
