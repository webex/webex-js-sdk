/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 * @private
 */

import '@ciscospark/plugin-wdm';
import {SparkPlugin} from '@ciscospark/spark-core';

const Feature = SparkPlugin.extend({
  namespace: `Feature`,

  /**
   * Returns the value of the requested feature toggle.
   * @param {string} keyType <developer|user|entitlement>
   * @param {string} key
   * @param {Object} options
   * @param {boolean} options.full to get full feature record including metadata.
   * @returns {string|boolean|number|FeatureModel|null}
   */
  getFeature(keyType, key, options) {
    if (keyType !== `developer` && keyType !== `user` && keyType !== `entitlement`) {
      return Promise.reject(new Error(`Invalid feature keyType provided. Only \`developer\`, \`user\`, and \`entitlement\` feature toggles are permitted.`));
    }

    options = options || {};

    const feature = this.spark.device.features[keyType].get(key);

    if (!feature) {
      return Promise.resolve(null);
    }

    if (options.full) {
      return Promise.resolve(feature.serialize());
    }

    return Promise.resolve(feature.value);
  },

  /**
   * Issues request to server to set a value for a feature toggle.
   * @param {string} keyType <developer|user>
   * @param {string} key
   * @param {string} value
   * @returns {Promise} Refreshes the local device and resolves with the features endpoint's response.
   */
  setFeature(keyType, key, value) {
    // Limit only to developer feature toggles for now.
    if (keyType !== `developer` && keyType !== `user`) {
      return Promise.reject(new Error(`Only \`developer\` and \`user\` feature toggles can be set.`));
    }

    return this.request({
      method: `POST`,
      api: `feature`,
      resource: `features/users/${this.spark.device.userId}/developer`,
      body: {
        key,
        mutable: true,
        val: value
      }
    })
      .then((res) => this.spark.device.features[keyType].add(res.body, {merge: true}));
  },

  initialize(...args) {
    Reflect.apply(SparkPlugin.prototype.initialize, this, args);

    this.listenToAndRun(this.spark, `change:device.features.developer`, this.trigger.bind(this, `change:developer`));
    this.listenToAndRun(this.spark, `change:device.features.entitlement`, this.trigger.bind(this, `change:entitlement`));
    this.listenToAndRun(this.spark, `change:device.features.user`, this.trigger.bind(this, `change:user`));
  }
});

export default Feature;
