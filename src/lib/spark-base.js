/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var State = require('ampersand-state');
var cloneDeep = require('lodash.clonedeep');

var SparkBase = State.extend({
  derived: {
    config: {
      deps: [
        'spark',
        'spark.config'
      ],
      fn: function config() {
        var spark = this.spark;
        if (spark && spark.config) {
          var namespace = this.getNamespace();
          if (namespace) {
            return spark.config[namespace.toLowerCase()];
          }

          return spark.config;
        }
      }
    },

    logger: {
      deps: [
        'spark',
        'spark.logger'
      ],
      fn: function logger() {
        return this.spark.logger || console;
      }
    },

    spark: {
      deps: ['parent'],
      fn: function spark() {
        if (!this.parent && !this.collection) {
          throw new Error('Cannot determine `this.spark` without `this.parent` or `this.collection`. Please initialize `this` via `children` or `collection` or set `this.parent` manually');
        }

        /* jscs:disable */
        var parent = this;
        /* jscs:enable */
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
    }
  },

  initialize: function initialize() {
    // HACK to deal with the fact that AmpersandState#dataTypes#set is a pure
    // function.
    this._dataTypes = cloneDeep(this._dataTypes);
    Object.keys(this._dataTypes).forEach(function bindSetter(key) {
      var dataType = this._dataTypes[key];
      if (dataType.set) {
        dataType.set = dataType.set.bind(this);
      }
    }.bind(this));
  },

  request: function request() {
    return this.spark.request.apply(this.spark, arguments);
  },

  upload: function upload() {
    return this.spark.upload.apply(this.spark, arguments);
  }
});

module.exports = SparkBase;
