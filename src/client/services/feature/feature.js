/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var SparkBase = require('../../../lib/spark-base');

/**
 * @class
 * @extends {SparkBase}
 * @memberof Feature
 */
var FeatureService = SparkBase.extend(
  /** @lends Feature.FeatureService.prototype */
  {
  namespace: 'Feature',

  /**
   * Returns the value of the requested feature toggle.
   * @param {string} keyType <developer|user|entitlement>
   * @param {string} key
   * @param {Object} options
   * @param {boolean} options.full to get full feature record including metadata.
   * @returns {string|boolean|number|FeatureModel|null}
   */
  getFeature: function get(keyType, key, options) {
    if (keyType !== 'developer' && keyType !== 'user' && keyType !== 'entitlement') {
      throw new Error('Invalid feature keyType provided. Only `developer`, `user`, and `entitlement` feature toggles are permitted.');
    }

    options = options || {};

    var feature = this.spark.device.features[keyType].get(key);

    if (!feature) {
      return null;
    }

    if (options.full) {
      return feature.serialize();
    }

    return feature.value;
  },

  /**
   * Issues request to server to set a value for a feature toggle.
   * @param {string} keyType <developer|user>
   * @param {string} key
   * @param {string} value
   * @returns {Promise} Refreshes the local device and resolves with the features endpoint's response.
   */
  setFeature: function set(keyType, key, value) {
    // Limit only to developer feature toggles for now.
    if (keyType !== 'developer' && keyType !== 'user') {
      throw new Error('Only `developer` and `user` feature toggles can be set.');
    }

    return this.request({
      method: 'POST',
      api: 'feature',
      resource: 'features/users/' + this.spark.device.userId + '/' + keyType,
      body: {
        key: key,
        mutable: true,
        val: value
      }
    })
      .then(function processResponse(res) {
        return this.spark.device.features[keyType].add(res.body, {merge: true});
      }.bind(this));
  },

  /**
   * Issues request to server to set a value for a feature toggle.
   * @param {Array} featureList
   * @returns {Promise} Refreshes the local device and resolves with the features endpoint`s response.
   */
  setBundledFeatures: function setBundledFeatures(featureList) {
    featureList.forEach(function assignDefaults(item) {
      item.mutable = item.mutable || 'true';
      item.type = item.type || 'USER';
    });

    return this.request({
      method: 'POST',
      api: 'feature',
      resource: 'features/users/' + this.spark.device.userId + '/toggles',
      body: featureList
    })
      .then(function processResponse(res) {
        res.body.featureToggles.forEach(function mergeFeatures(item) {
          this.spark.device.features.user.add(item, {merge: true});
        }.bind(this));
      }.bind(this));
  },

  initialize: function initialize() {
    SparkBase.prototype.initialize.apply(this, arguments);

    this.listenToAndRun(this.spark, 'change:device.features.developer', this.trigger.bind(this, 'change:developer'));
    this.listenToAndRun(this.spark, 'change:device.features.entitlement', this.trigger.bind(this, 'change:entitlement'));
    this.listenToAndRun(this.spark, 'change:device.features.user', this.trigger.bind(this, 'change:user'));
  }
});

module.exports = FeatureService;
