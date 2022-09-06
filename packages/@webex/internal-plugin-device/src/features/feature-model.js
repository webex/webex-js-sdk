// External dependencies.
import AmpState from 'ampersand-state';
import {defaults, isObject} from 'lodash';

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
const FeatureModel = AmpState.extend({

  idAttribute: 'key', // needed by Ampersand to determine unique item

  // Ampersand property members.

  props: {
    /**
     * Contains the unique identifier for this feature to be addressed by.
     *
     * @type {string}
     */
    key: 'string',

    /**
     * This property contains the date in which this feature was last modified.
     *
     * @type {date}
     */
    lastModified: 'date',

    /**
     * This property defines whether or not the feature is mutable.
     *
     * @type {boolean}
     */
    mutable: 'boolean',

    /**
     * This property contains the data type the string value should be
     * interpreted as.
     *
     * @type {FEATURE_TYPES}
     */
    type: 'string',

    /**
     * This property contains the string value of this feature.
     *
     * @type {string}
     */
    val: 'string',

    /**
     * This property contains the interpreted value of this feature.
     *
     * @type {any}
     */
    value: 'any'
  },

  /**
   * Class object constructor. This method safely initializes the class object
   * prior to it fully loading to allow data to be accessed and modified
   * immediately after construction instead of initialization.
   *
   * @override
   * @param {Object} attrs - An object to map against the feature's properties.
   * @param {Object} [options={}] - Ampersand options for `parse` and `parent`.
   */
  constructor(attrs, options = {}) {
    defaults(options, {parse: true});

    return Reflect.apply(
      AmpState.prototype.constructor,
      this,
      [attrs, options]
    );
  },

  // Ampsersand method members.

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
      // Return an empty object to satisfy the requirements of `Ampersand`.
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
  },

  /**
   * Serialize the feature using the parent ampersand method with its date as an
   * ISO string. This converts the feature into a request-transportable object.
   *
   * @override
   * @param  {Record<string,boolean>} [args] - List of properties to serialize.
   * @returns {Object} - The request-ready transport object.
   */
  serialize(...args) {
    // Call the overloaded class member.
    const attrs = Reflect.apply(AmpState.prototype.serialize, this, args);

    // Validate that the overloaded class member returned an object with the
    // `lastModified` key-value pair and instance it as an ISO string.
    if (attrs.lastModified) {
      attrs.lastModified = (new Date(attrs.lastModified).toISOString());
    }

    return attrs;
  },

  /**
   * Set a property of this object to a specific value. This method utilizes
   * code that exists within the `ampersand-state` dependency to handle
   * scenarios in which `key = {"key": "value"}` or
   * `key = "key", value = "value"`. Since the snippet is pulled directly from
   * `ampersand-state`, there is no need to test both scenarios.
   *
   * @override
   * @param {object | string} key - The key value, or object to be set.
   * @param {any} value - The key value or object to set the keyed pair to.
   * @param {any} options - The object to set the keyed pair to.
   * @returns {any} - The changed property.
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
    }
    else {
      attrs = {};
      attrs[key] = value;
      optns = options;
    }

    attrs = this.parse(attrs, optns);

    return Reflect.apply(AmpState.prototype.set, this, [attrs, optns]);
  }
});

export default FeatureModel;
