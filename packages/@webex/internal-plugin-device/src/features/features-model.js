// External dependencies.
import {EventEmitter} from 'events';

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
class FeaturesModel extends EventEmitter {
  /**
   * Constructor for FeaturesModel
   * @param {Object} attrs - Initial attributes
   * @param {Object} options - Model options
   */
  constructor(attrs = {}, options = {}) {
    super();

    // Initialize collections
    this.developer = new FeatureCollection();
    this.entitlement = new FeatureCollection();
    this.user = new FeatureCollection();

    // Store options and attributes (for compatibility)
    this.options = options;
    this.attributes = {};
    this._children = {};
    this._collections = {
      developer: this.developer,
      entitlement: this.entitlement,
      user: this.user,
    };

    // Initialize the model
    this.initialize(attrs, options);
  }

  /**
   * Recursively clear attributes, children, and collections.
   *
   * @returns {this}
   */
  clear() {
    // Clear the ampersand attributes safely if there are any. This class should
    // never have any attributes.
    Object.keys(this.attributes).forEach((key) => {
      delete this.attributes[key];
    });

    // Clear the ampersand children safely if there are any. This class should
    // never have any children.
    Object.keys(this._children).forEach((key) => {
      if (this[key] && typeof this[key].clear === 'function') {
        this[key].clear();
      }
    });

    // Clear the ampersand collections safely.
    Object.keys(this._collections).forEach((key) => {
      if (this[key] && typeof this[key].reset === 'function') {
        this[key].reset();
      }
    });

    return this;
  }

  /**
   * Initializer method for FeatureModel class object.
   *
   * @returns {void}
   */
  initialize() {
    // Declare the collection event names.
    const eventNames = ['change:value', 'add', 'remove'];

    // Initialize collection event listeners.
    eventNames.forEach((eventName) => {
      FEATURE_COLLECTION_NAMES.forEach((collectionName) => {
        if (this[collectionName] && typeof this[collectionName].on === 'function') {
          this[collectionName].on(eventName, (model, eventOptions) => {
            this.emit(`change:${collectionName}`, this, this[collectionName], eventOptions);
          });
        }
      });
    });
  }

  /**
   * Set attributes (for compatibility with ampersand patterns)
   * @param {Object} attrs - Attributes to set
   * @returns {this}
   */
  set(attrs) {
    if (typeof attrs === 'object') {
      Object.assign(this.attributes, attrs);
    }

    return this;
  }

  /**
   * Get an attribute value (for compatibility)
   * @param {string} key - Attribute key
   * @returns {any} - Attribute value
   */
  get(key) {
    return this.attributes[key];
  }

  /**
   * Unset an attribute (for compatibility)
   * @param {string} key - Attribute key
   * @returns {this}
   */
  unset(key) {
    delete this.attributes[key];

    return this;
  }

  /**
   * Trigger method (for compatibility - maps to emit)
   * @param {string} event - Event name
   * @param {...any} args - Event arguments
   * @returns {boolean}
   */
  trigger(event, ...args) {
    return this.emit(event, ...args);
  }
}

export default FeaturesModel;
