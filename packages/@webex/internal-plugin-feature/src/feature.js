/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import '@webex/internal-plugin-device';
import {partition} from 'lodash';
import * as WebexCore from '@webex/webex-core';

const Feature = WebexCore.WebexPlugin.extend({
  namespace: 'Feature',

  /**
   * Returns the value of the requested feature toggle.
   * @param {string} keyType <developer|user|entitlement>
   * @param {string} key
   * @param {Object} options
   * @param {boolean} options.full to get full feature record including metadata.
   * @returns {string|boolean|number|FeatureModel|null}
   */
  getFeature(keyType, key, options) {
    if (keyType !== 'developer' && keyType !== 'user' && keyType !== 'entitlement') {
      return Promise.reject(
        new Error(
          'Invalid feature keyType provided. Only `developer`, `user`, and `entitlement` feature toggles are permitted.'
        )
      );
    }

    options = options || {};

    const feature = this.webex.internal.device.features[keyType].get(key);

    if (!feature) {
      return Promise.resolve(null);
    }

    if (options.full) {
      return Promise.resolve(feature.serialize());
    }

    return Promise.resolve(feature.value);
  },

  /**
   * Handles a feature toggle update from the server.
   * @param {Object} envelope
   * @returns {undefined}
   */
  handleFeatureUpdate(envelope) {
    if (envelope && envelope.data) {
      const feature = envelope.data.featureToggle;
      const keyType = feature.type.toLowerCase();

      if (keyType === 'user' || keyType === 'developer') {
        this.webex.internal.device.features[keyType].add([feature], {merge: true});
      }
    }
  },

  /**
   * Register to listen for incoming feature events
   * @instance
   * @returns {undefined}
   */
  listen() {
    this.listenTo(
      this.webex.internal.mercury,
      'event:featureToggle_update',
      this.handleFeatureUpdate
    );
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
    if (keyType !== 'developer' && keyType !== 'user') {
      return Promise.reject(new Error('Only `developer` and `user` feature toggles can be set.'));
    }

    return this.request({
      method: 'POST',
      api: 'feature',
      resource: `features/users/${this.webex.internal.device.userId}/${keyType}`,
      body: {
        key,
        mutable: true,
        val: value,
      },
    }).then((res) => this.webex.internal.device.features[keyType].add(res.body, {merge: true}));
  },

  /**
   * Issues request to server to set a value for a feature toggle.
   * @param {array} featureList - in the form of `Array<{ type: 'USER' | 'DEV', key: string, val: any }>`
   * @returns {Promise} Refreshes the local device and resolves with the features endpoint`s response.
   */
  setBundledFeatures(featureList) {
    featureList.forEach((item) => {
      item.mutable = item.mutable || 'true';
      if (item.type !== 'USER' && item.type !== 'DEV') {
        item.type = 'USER';
      }
    });

    return this.request({
      method: 'POST',
      api: 'feature',
      resource: `features/users/${this.webex.internal.device.userId}/toggles`,
      body: featureList,
    }).then((res) => {
      const partitionedToggles = partition(res.body.featureToggles, {type: 'USER'});

      this.webex.internal.device.features.user.add(partitionedToggles[0], {merge: true});
      this.webex.internal.device.features.developer.add(partitionedToggles[1], {merge: true});
    });
  },

  initialize(...args) {
    Reflect.apply(WebexCore.WebexPlugin.prototype.initialize, this, args);

    this.listenToAndRun(
      this.webex,
      'change:internal.device.features.developer',
      this.trigger.bind(this, 'change:developer')
    );
    this.listenToAndRun(
      this.webex,
      'change:internal.device.features.entitlement',
      this.trigger.bind(this, 'change:entitlement')
    );
    this.listenToAndRun(
      this.webex,
      'change:internal.device.features.user',
      this.trigger.bind(this, 'change:user')
    );
  },
});

export default Feature;
