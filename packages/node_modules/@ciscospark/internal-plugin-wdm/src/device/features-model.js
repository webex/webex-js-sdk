/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import AmpState from 'ampersand-state';
import FeatureCollection from './feature-collection';

const FeaturesModel = AmpState.extend({
  collections: {
    developer: FeatureCollection,
    entitlement: FeatureCollection,
    user: FeatureCollection
  },

  /**
   * Recursively clear children/collections;
   * @param {Object} options
   * @returns {SparkPlugin}
   */
  clear(options) {
    Object.keys(this.attributes).forEach((key) => {
      this.unset(key, options);
    });

    Object.keys(this._children).forEach((key) => {
      this[key].clear();
    });

    Object.keys(this._collections).forEach((key) => {
      this[key].reset();
    });

    return this;
  },

  initialize() {
    /* eslint max-nested-callbacks: [0] */
    // Propagate change(:[attribute]) events from collections
    ['change:value', 'add', 'remove'].forEach((collectionEventName) => {
      ['developer', 'entitlement', 'user'].forEach((collectionName) => {
        this[collectionName].on(collectionEventName, (model, options) => {
          this.trigger(`change:${collectionName}`, this, this[collectionName], options);
        });
      });
    });
  }
});

export default FeaturesModel;
