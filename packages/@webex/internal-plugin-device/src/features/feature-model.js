// External dependencies.
import {defaults, isObject} from 'lodash';
import {WebexEventEmitter} from '@webex/common';

import {FEATURE_TYPES} from '../constants';

/**
 * The model returned from the {@link FeatureModel#parse} method.
 *
 * @typedef {Object} ParsedFeatureModel
 * @property {boolean|number|string} ParsedFeatureModel.value - The parsed val.
 * @property {string} ParsedFeatureModel.type - The type of the parsed val.
 */

/**
 * Feature model.
 *
 * @description
 * This model contains details on a single feature and is received from the
 * **WDM** service upon registration.
 */
class FeatureModel extends WebexEventEmitter {
  /**
   * Class object constructor. This method safely initializes the class object
   * prior to it fully loading to allow data to be accessed and modified
   * immediately after construction instead of initialization.
   *
   * @param {Object} attrs - An object to map against the feature's properties.
   * @param {Object} [options={}] - Options for `parse` and other configuration.
   */
  constructor(attrs = {}, options = {}) {
    super();

    defaults(options, {parse: true});

    // Initialize properties
    this.key = '';
    this.lastModified = null;
    this.mutable = false;
    this.type = '';
    this.val = '';
    this.value = null;

    // Parse and set initial attributes
    if (attrs && typeof attrs === 'object') {
      const parsedAttrs = options.parse ? this.parse(attrs) : attrs;
      this.set(parsedAttrs);
    }
  }

  /**
   * Get the ID attribute (key) for this feature model
   * @returns {string} The key that serves as the unique identifier
   */
  get id() {
    return this.key;
  }

  /**
   * Parse {@link FeatureModel} properties recieved as strings from **WDM**
   * and cast them as their appropriate types.
   *
   * @private
   * @memberof FeatureModel
   * @param {Object} model - The model to parse.
   * @property {string} model.val - The value to be parsed.
   * @returns {ParsedFeatureModel} - The parsed model.
   */
  parse(model) {
    // Validate that a model was provided and that it is an object.
    if (!model || typeof model !== 'object') {
      // Return an empty object to satisfy the requirements.
      return {};
    }

    const parsedModel = {...model};
    const {val} = parsedModel;

    // Validate that the value is a number.
    if (!Number.isNaN(Number(val))) {
      parsedModel.type = FEATURE_TYPES.NUMBER;
      parsedModel.value = Number(val);
    }
    // Validate if the value should be a true boolean.
    else if (typeof val === 'string' && val.toLowerCase() === 'true') {
      parsedModel.type = FEATURE_TYPES.BOOLEAN;
      parsedModel.value = true;
    }
    // Validate if the value should be a false boolean.
    else if (typeof val === 'string' && val.toLowerCase() === 'false') {
      parsedModel.type = FEATURE_TYPES.BOOLEAN;
      parsedModel.value = false;
    }
    // In all other cases, the value is string, even if it is undefined.
    else {
      parsedModel.type = FEATURE_TYPES.STRING;
      parsedModel.value = val;
    }

    return parsedModel;
  }

  /**
   * Serialize the feature with its date as an ISO string.
   * This converts the feature into a request-transportable object.
   *
   * @returns {Object} - The request-ready transport object.
   */
  serialize() {
    // Get all properties for serialization
    const attrs = {
      key: this.key,
      lastModified: this.lastModified,
      mutable: this.mutable,
      type: this.type,
      val: this.val,
      value: this.value,
    };

    // Validate that the object has a `lastModified` key-value pair and convert it to ISO string.
    if (attrs.lastModified) {
      attrs.lastModified = new Date(attrs.lastModified).toISOString();
    }

    return attrs;
  }

  /**
   * Set a property of this object to a specific value. This method handles
   * scenarios in which `key = {"key": "value"}` or
   * `key = "key", value = "value"`.
   *
   * @param {object | string} key - The key value, or object to be set.
   * @param {any} value - The key value or object to set the keyed pair to.
   * @param {any} options - Options for setting the property.
   * @returns {FeatureModel} - Returns this instance for chaining.
   */
  set(key, value, options) {
    // Declare formatted output variables for properly setting the targetted
    // property for this method.
    let attrs;
    let optns;

    // Validate if the key is an instance of any object or not.
    if (isObject(key) || key === null) {
      attrs = key;
      optns = value;
    } else {
      attrs = {};
      attrs[key] = value;
      optns = options;
    }

    if (attrs) {
      attrs = this.parse(attrs, optns);

      // Set properties directly
      Object.keys(attrs).forEach((attrKey) => {
        if (
          Object.prototype.hasOwnProperty.call(this, attrKey) ||
          ['key', 'lastModified', 'mutable', 'type', 'val', 'value'].includes(attrKey)
        ) {
          const oldValue = this[attrKey];
          this[attrKey] = attrs[attrKey];

          // Emit change event
          if (oldValue !== attrs[attrKey]) {
            this.emit('change', attrKey, attrs[attrKey], oldValue);
            this.emit(`change:${attrKey}`, attrs[attrKey], oldValue);
          }
        }
      });
    }

    return this;
  }
}

export default FeatureModel;
