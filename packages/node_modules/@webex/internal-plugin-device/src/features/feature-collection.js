// External dependencies.
import AmpCollection from 'ampersand-collection';

// Local Dependencies
import FeatureModel from './feature-model';

/**
 * Feature collection model.
 *
 * @description
 * This model contains a collection of features under a specific collection
 * group.
 */
const FeatureCollection = AmpCollection.extend({
  /**
   * The unique identifier for the models in this collection.
   *
   * @type {string}
   */
  mainIndex: 'key',

  /**
   * The type of model this collection can contain.
   *
   * @type {Class}
   */
  model: FeatureModel
});

export default FeatureCollection;
