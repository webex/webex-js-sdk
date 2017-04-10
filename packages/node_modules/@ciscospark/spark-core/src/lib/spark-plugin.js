/**!
 *
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import AmpState from 'ampersand-state';
import util from 'util';
import {cloneDeep} from 'lodash';
import {makeSparkPluginStore} from './storage';

const SparkPlugin = AmpState.extend({
  derived: {
    boundedStorage: {
      deps: [],
      fn() {
        return makeSparkPluginStore(`bounded`, this);
      }
    },
    unboundedStorage: {
      deps: [],
      fn() {
        return makeSparkPluginStore(`unbounded`, this);
      }
    },
    config: {
      // figure out why caching config breaks the refresh integration test
      // but not the refresh automation test.
      cache: false,
      deps: [
        `spark`,
        `spark.config`
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
        `spark`,
        `spark.logger`
      ],
      fn() {
        return this.spark.logger || console;
      }
    },

    spark: {
      deps: [`parent`],
      fn() {
        if (!this.parent && !this.collection) {
          throw new Error(`Cannot determine \`this.spark\` without \`this.parent\` or \`this.collection\`. Please initialize \`this\` via \`children\` or \`collection\` or set \`this.parent\` manually`);
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
      type: `any`
    }
  },

  /**
   * Overrides AmpersandState#clear to make sure we never unset `parent` and
   * recursively visits children/collections.
   * @param {Object} options
   * @returns {SparkPlugin}
   */
  clear(options) {
    Object.keys(this.attributes).forEach((key) => {
      if (key !== `parent`) {
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

  initialize(...args) {
    Reflect.apply(AmpState.prototype.initialize, this, args);

    // This is a bit of a hack to allow makeStateDataType work
    let cloned = false;
    Object.keys(this._dataTypes).forEach((key) => {
      const dataType = this._dataTypes[key];
      if (dataType.set) {
        if (!cloned) {
          this._dataTypes = cloneDeep(this._dataTypes);
          cloned = true;
        }
        dataType.set = dataType.set.bind(this);
      }
    });

    // Propagate change:[attribute] events from children
    this.on(`change`, (model, options) => {
      if (this.parent) {
        this.parent.trigger(`change:${this.getNamespace().toLowerCase()}`, this.parent, this, options);
      }
    });
  },

  /**
   * @param {number} depth
   * @returns {Object}
   */
  inspect(depth) {
    return util.inspect(this.serialize(), {depth});
  },

  request(...args) {
    return this.spark.request(...args);
  },

  upload(...args) {
    return this.spark.upload(...args);
  },

  when(eventName) {
    return new Promise((resolve) => {
      this.once(eventName, (...args) => resolve(args));
    });
  }
});

export default SparkPlugin;
