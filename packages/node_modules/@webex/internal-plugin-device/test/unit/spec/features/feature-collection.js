import {assert} from '@webex/test-helper-chai';
import {FeatureCollection, FeatureModel} from '@webex/internal-plugin-device';

describe('plugin-device', () => {
  describe('feature-collection', () => {
    let featureCollection;

    beforeEach('create a feature collection', () => {
      featureCollection = new FeatureCollection();
    });

    describe('#mainIndex', () => {
      it('should have its index set to \'key\'', () => {
        assert.equal(featureCollection.mainIndex, 'key');
      });
    });

    describe('#model', () => {
      it('should have its model set to the \'FeatureModel\' class', () => {
        assert.equal(featureCollection.model, FeatureModel);
      });
    });
  });
});
