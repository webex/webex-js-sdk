/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import util from 'util';

import AmpState from 'ampersand-state';
import {
  cloneDeep,
  isObject,
  omit
} from 'lodash';

import {makeSparkPluginStore} from './storage';

/**
 * @class
 */
const SparkPlugin = AmpState.extend({
  derived: {
    boundedStorage: {
      deps: [],
      fn() {
        return makeSparkPluginStore('bounded', this);
      }
    },
    unboundedStorage: {
      deps: [],
      fn() {
        return makeSparkPluginStore('unbounded', this);
      }
    },
    config: {
    // figure out why caching config breaks the refresh integration test
    // but not the refresh automation test.
      cache: false,
      deps: [
        'spark',
        'spark.config'
      ],
      fn() {
        if (this.spark && this.spark.config) {
          const namespace = this.getNamespace();
          if (namespace) {
            return this.spark.config[namespace.toLowerCase()];
          }

          return this.spark.config;
        }

        return {};
      }
    },

    logger: {
      deps: [
        'spark',
        'spark.logger'
      ],
      fn() {
        return this.spark.logger || console;
      }
    },

    spark: {
      deps: ['parent'],
      fn() {
        if (!this.parent && !this.collection) {
          throw new Error('Cannot determine `this.spark` without `this.parent` or `this.collection`. Please initialize `this` via `children` or `collection` or set `this.parent` manually');
        }

        /* eslint consistent-this: [0] */
        let parent = this;
        while (parent.parent || parent.collection) {
          parent = parent.parent || parent.collection;
        }

        return parent;
      }
    }
  },

  session: {
    parent: {
      type: 'any'
    },
    /**
     * Indicates this plugin is ready to be used. Defaults to true but can be
     * overridden by plugins as appropriate. Used by {@link SparkCore#read}
     * @instance
     * @memberof SparkPlugin
     * @type {boolean}
     */
    ready: {
      default: true,
      type: 'boolean'
    }
  },

  /**
   * Overrides AmpersandState#clear to make sure we never unset `parent` and
   * recursively visits children/collections.
   * @instance
   * @memberof SparkPlugin
   * @param {Object} options
   * @returns {SparkPlugin}
   */
  clear(options) {
    Object.keys(this.attributes).forEach((key) => {
      if (key !== 'parent') {
        this.unset(key, options);
      }
    });

    Object.keys(this._children).forEach((key) => {
      this[key].clear();
    });

    Object.keys(this._collections).forEach((key) => {
      this[key].reset();
    });

    return this;
  },

  /**
   * Initializer
   * @private
   * @param {Object} attrs
   * @param {Object} options
   * @returns {undefined}
   */
  initialize(...args) {
    Reflect.apply(AmpState.prototype.initialize, this, args);

    // HACK to deal with the fact that AmpersandState#dataTypes#set is a pure
    // function.
    this._dataTypes = cloneDeep(this._dataTypes);
    Object.keys(this._dataTypes).forEach((key) => {
      if (this._dataTypes[key].set) {
        this._dataTypes[key].set = this._dataTypes[key].set.bind(this);
      }
    });
    // END HACK

    // Propagate change:[attribute] events from children
    this.on('change', (model, options) => {
      if (this.parent) {
        this.parent.trigger(`change:${this.getNamespace().toLowerCase()}`, this.parent, this, options);
      }
    });
  },

  /**
   * @instance
   * @memberof SparkPlugin
   * @param {number} depth
   * @private
   * @returns {Object}
   */
  inspect(depth) {
    return util.inspect(omit(this.serialize({
      props: true,
      session: true,
      derived: true
    }), 'boundedStorage', 'unboundedStorage', 'config', 'logger', 'spark', 'parent'), {depth});
  },

  request(...args) {
    return this.spark.request(...args);
  },

  upload(...args) {
    return this.spark.upload(...args);
  },

  when(eventName, ...rest) {
    if (rest && rest.length > 0) {
      throw new Error('#when() does not accept a callback, you must attach to its promise');
    }
    return new Promise((resolve) => {
      this.once(eventName, (...args) => resolve(args));
    });
  },

  /**
   * Helper function for dealing with both forms of {@link AmpersandState#set()}
   * @param {string} key
   * @param {mixed} value
   * @param {Object} options
   * @private
   * @returns {Array<Object, Object>}
   */
  _filterSetParameters(key, value, options) {
    let attrs;
    if (isObject(key) || key === null) {
      attrs = key;
      options = value;
    }
    else {
      attrs = {};
      attrs[key] = value;
    }

    options = options || {};

    return [attrs, options];
  }
});

export default SparkPlugin;
