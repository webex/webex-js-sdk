// External dependencies.
import AmpState from 'ampersand-state';

// Local Dependencies
import {FEATURE_COLLECTION_NAMES} from '../constants';

import FeatureCollection from './feature-collection';

/**
 * Feature collection parent container.
 *
 * @description
 * This class contains all of the feature collection class objects to help
 * organize the data retrieved from the **wdm** service on device registration.
 */
const FeaturesModel = AmpState.extend({

  // Ampersand property members.

  collections: {
    /**
     * This collection contains the developer feature collection.
     *
     * @type {FeatureCollection}
     */
    developer: FeatureCollection,

    /**
     * This collection contains the entitlement feature collection.
     *
     * @type {FeatureCollection}
     */
    entitlement: FeatureCollection,

    /**
     * This collection contains the user feature collection.
     *
     * @type {FeatureCollection}
     */
    user: FeatureCollection
  },

  // Helper method members.

  /**
   * Recursively clear attributes, children, and collections.
   *
   * @param {Object} options - Attribute options to unset.
   * @returns {this}
   */
  clear(options) {
    // Clear the ampersand attributes safely if there are any. This class should
    // never have any attributes.
    Object.keys(this.attributes).forEach((key) => {
      this.unset(key, options);
    });

    // Clear the ampersand children safely if there are any. This class should
    // never have any children.
    /* eslint-disable-next-line no-underscore-dangle */
    Object.keys(this._children).forEach((key) => {
      this[key].clear();
    });

    // Clear the ampersand collections safely.
    /* eslint-disable-next-line no-underscore-dangle */
    Object.keys(this._collections).forEach((key) => {
      this[key].reset();
    });

    return this;
  },

  // Ampersand method members.

  /**
   * Initializer method for FeatureModel class object.
   *
   * @override
   * @returns {void}
   */
  initialize() {
    // Declare the collection event names.
    const eventNames = ['change:value', 'add', 'remove'];

    // Initialize collection event listeners.
    eventNames.forEach((eventName) => {
      FEATURE_COLLECTION_NAMES.forEach((collectionName) => {
        this[collectionName].on(eventName, (model, options) => {
          this.trigger(
            `change:${collectionName}`,
            this,
            this[collectionName],
            options
          );
        });
      });
    });
  }
});

export default FeaturesModel;
