import {assert} from '@webex/test-helper-chai';
import {
  constants,
  FeatureModel,
  FeaturesModel
} from '@webex/internal-plugin-device';
import sinon from 'sinon';

import dto from '../wdm-dto';

describe('plugin-device', () => {
  describe('features-model', () => {
    let featuresModel;

    beforeEach('create a features model', () => {
      featuresModel = new FeaturesModel(dto.features);
    });

    describe('collections', () => {
      it('should have \'developer\', \'entitlement\' and \'user\' keys', () => {
        assert.containsAllKeys(featuresModel, [
          'developer',
          'entitlement',
          'user'
        ]);
      });
    });

    describe('events', () => {
      constants.FEATURE_COLLECTION_NAMES.forEach((collectionName) => {
        describe(`when a feature is changed in '${collectionName}'`, () => {
          let feature;
          let spy;
          let value;

          beforeEach('setup sinon', () => {
            feature = featuresModel[collectionName].models[0];
            spy = sinon.spy();
            value = 'testValue';

            featuresModel.on(`change:${collectionName}`, spy);
          });

          it('should call the event-mapped function', () => {
            feature.value = value;
            assert.called(spy);
          });
        });

        describe(`when a feature is added to '${collectionName}'`, () => {
          let collection;
          let key;
          let model;
          let spy;

          beforeEach('setup sinon', () => {
            collection = featuresModel[collectionName];
            key = 'testKey';
            model = new FeatureModel({
              ...dto.features[collectionName][0],
              key
            });
            spy = sinon.spy();

            featuresModel.on(`change:${collectionName}`, spy);
          });

          it('should call the event-mapped function', () => {
            collection.add(model);
            assert.called(spy);
          });
        });

        describe(`when a feature is removed from '${collectionName}'`, () => {
          let collection;
          let model;
          let spy;

          beforeEach('setup sinon', () => {
            collection = featuresModel[collectionName];
            model = new FeatureModel(dto.features[collectionName][0]);
            spy = sinon.spy();

            featuresModel.on(`change:${collectionName}`, spy);
          });

          it('should call the event-mapped function', () => {
            collection.remove(model);
            assert.called(spy);
          });
        });
      });
    });

    describe('#clear()', () => {
      it('should clear all of the features', () => {
        featuresModel.clear();

        assert.equal(featuresModel.developer.models.length, 0);
        assert.equal(featuresModel.entitlement.models.length, 0);
        assert.equal(featuresModel.user.models.length, 0);
      });
    });
  });
});
