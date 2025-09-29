// External dependencies.
import {EventEmitter} from 'events';

// Local Dependencies
import FeatureModel from './feature-model';

/**
 * Feature collection model.
 *
 * @description
 * This model contains a collection of features under a specific collection
 * group.
 */
class FeatureCollection extends EventEmitter {
  /**
   * Constructor for FeatureCollection
   * @param {Array} models - Initial models array
   * @param {Object} options - Collection options
   */
  constructor(models = [], options = {}) {
    super();

    // Store collection properties
    this.mainIndex = 'key';
    this.model = FeatureModel;
    this.models = [];
    this.length = 0;

    // Store options for compatibility
    this.options = options;

    // Initialize with provided models if any
    if (models && Array.isArray(models)) {
      this.reset(models, {silent: true});
    }
  }

  /**
   * Add a model to the collection
   * @param {Object|FeatureModel} model - Model to add
   * @param {Object} options - Add options
   * @returns {FeatureModel} - The added model
   */
  add(model, options = {}) {
    let modelInstance;

    if (model instanceof this.model) {
      modelInstance = model;
    } else {
      const ModelConstructor = this.model;
      modelInstance = new ModelConstructor(model);
    }

    this.models.push(modelInstance);
    this.length = this.models.length;

    if (!options.silent) {
      this.emit('add', modelInstance, this, options);
    }

    return modelInstance;
  }

  /**
   * Remove a model from the collection
   * @param {Object|FeatureModel} model - Model to remove
   * @param {Object} options - Remove options
   * @returns {FeatureModel|undefined} - The removed model
   */
  remove(model, options = {}) {
    const index = this.models.indexOf(model);

    if (index === -1) {
      return undefined;
    }

    const removedModel = this.models.splice(index, 1)[0];
    this.length = this.models.length;

    if (!options.silent) {
      this.emit('remove', removedModel, this, options);
    }

    return removedModel;
  }

  /**
   * Reset the collection with new models
   * @param {Array} models - New models array
   * @param {Object} options - Reset options
   * @returns {this}
   */
  reset(models = [], options = {}) {
    // Clear existing models
    this.models = [];
    this.length = 0;

    // Add new models
    if (Array.isArray(models)) {
      models.forEach((model) => {
        this.add(model, {silent: true});
      });
    }

    if (!options.silent) {
      this.emit('reset', this, options);
    }

    return this;
  }

  /**
   * Get a model by its main index
   * @param {string} key - The key to search for
   * @returns {FeatureModel|undefined} - The found model
   */
  get(key) {
    return this.models.find((model) => model[this.mainIndex] === key);
  }

  /**
   * Find a model using a predicate function
   * @param {Function} predicate - Function to test models
   * @returns {FeatureModel|undefined} - The found model
   */
  find(predicate) {
    return this.models.find(predicate);
  }

  /**
   * Filter models using a predicate function
   * @param {Function} predicate - Function to test models
   * @returns {Array} - Array of matching models
   */
  filter(predicate) {
    return this.models.filter(predicate);
  }

  /**
   * Map over models
   * @param {Function} callback - Function to call for each model
   * @returns {Array} - Array of results
   */
  map(callback) {
    return this.models.map(callback);
  }

  /**
   * ForEach over models
   * @param {Function} callback - Function to call for each model
   * @returns {void}
   */
  forEach(callback) {
    this.models.forEach(callback);
  }

  /**
   * Convert collection to array
   * @returns {Array} - Array of models
   */
  toArray() {
    return [...this.models];
  }

  /**
   * Get the first model
   * @returns {FeatureModel|undefined} - The first model
   */
  first() {
    return this.models[0];
  }

  /**
   * Get the last model
   * @returns {FeatureModel|undefined} - The last model
   */
  last() {
    return this.models[this.models.length - 1];
  }

  /**
   * Check if collection is empty
   * @returns {boolean} - True if empty
   */
  isEmpty() {
    return this.length === 0;
  }

  /**
   * Convert to JSON
   * @returns {Array} - JSON representation
   */
  toJSON() {
    return this.models.map((model) =>
      typeof model.toJSON === 'function' ? model.toJSON() : model
    );
  }

  /**
   * Event listener setup (for compatibility)
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   * @returns {this}
   */
  on(event, callback) {
    super.on(event, callback);

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

export default FeatureCollection;
