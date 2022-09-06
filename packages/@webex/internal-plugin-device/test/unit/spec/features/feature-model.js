import {assert} from '@webex/test-helper-chai';
import {FeatureModel} from '@webex/internal-plugin-device';

import dto from '../wdm-dto';

describe('plugin-device', () => {
  describe('feature-model', () => {
    let featureLM;
    let featureNLM;
    let featureModel;

    beforeEach('create feature model', () => {
      [featureLM, featureNLM] = dto.features.developer;
    });

    describe('#constructor()', () => {
      describe('when the feature includes a \'lastModified\' property', () => {
        beforeEach('generate the feature model', () => {
          featureModel = new FeatureModel(featureLM);
        });

        it('should assign value attributes to properties', () => {
          assert.equal(featureLM.key, featureModel.key);
          assert.equal(featureLM.mutable, featureModel.mutable);
          assert.equal(featureLM.type, featureModel.type);
          assert.equal(featureLM.val, featureModel.val);
          assert.equal(featureLM.value, featureModel.value);
        });

        it('should assign the \'lastModified\' value as a \'Date\'', () => {
          assert.instanceOf(featureModel.lastModified, Date);

          assert.equal(
            featureModel.lastModified.toISOString(),
            featureLM.lastModified
          );
        });
      });

      describe('when the feature excludes a \'lastModified\' property', () => {
        beforeEach('generate the feature model', () => {
          featureModel = new FeatureModel(featureNLM);
        });

        it('should assign value attributes to properties', () => {
          assert.equal(featureNLM.key, featureModel.key);
          assert.equal(featureNLM.mutable, featureModel.mutable);
          assert.equal(featureNLM.type, featureModel.type);
          assert.equal(featureNLM.val, featureModel.val);
          assert.equal(featureNLM.value, featureModel.value);
        });

        it('should not assign the \'lastModified\' value', () => {
          assert.isUndefined(featureModel.lastModified);
        });
      });
    });

    describe('#parse()', () => {
      let fixture;
      let model;

      beforeEach('initialize the feature model', () => {
        featureModel = new FeatureModel();
      });

      it('should return an empty object when the model is not defined', () => {
        model = featureModel.parse(fixture);
        assert.deepEqual(model, {});
      });

      describe('when the model is defined', () => {
        beforeEach('define the fixture', () => {
          fixture = {};
        });

        describe('when the value is a number', () => {
          beforeEach('set the value to a number', () => {
            fixture.val = '1234';
            model = featureModel.parse(fixture);
          });

          it('should set the value to a instance of number', () =>
            assert.typeOf(model.value, 'number'));

          it('should set the type to \'number\'', () =>
            assert.equal(model.type, 'number'));

          it('should set the model value to the equivalent Number value', () =>
            assert.equal(model.value, Number(fixture.val)));
        });

        describe('when the value is a true boolean', () => {
          beforeEach('set the value to a true string', () => {
            fixture.val = 'true';
            model = featureModel.parse(fixture);
          });

          it('should set the value to a boolean true', () =>
            assert.equal(model.value, true));

          it('should set the type to \'boolean\'', () =>
            assert.equal(model.type, 'boolean'));
        });

        describe('when the value is a True boolean', () => {
          beforeEach('set the value to a True string', () => {
            fixture.val = 'True';
            model = featureModel.parse(fixture);
          });

          it('should set the value to a boolean true', () =>
            assert.equal(model.value, true));

          it('should set the type to \'boolean\'', () =>
            assert.equal(model.type, 'boolean'));
        });

        describe('when the value is a false string', () => {
          beforeEach('set the value to a false boolean', () => {
            fixture.val = 'false';
            model = featureModel.parse(fixture);
          });

          it('should set the value to a boolean false', () =>
            assert.equal(model.value, false));

          it('should set the type to \'boolean\'', () =>
            assert.equal(model.type, 'boolean'));
        });

        describe('when the value is a False string', () => {
          beforeEach('set the value to a false boolean', () => {
            fixture.val = 'False';
            model = featureModel.parse(fixture);
          });

          it('should set the value to a boolean false', () =>
            assert.equal(model.value, false));

          it('should set the type to \'boolean\'', () =>
            assert.equal(model.type, 'boolean'));
        });

        describe('when the value is a string', () => {
          beforeEach('set the value to a string', () => {
            fixture.val = 'hello world';
            model = featureModel.parse(fixture);
          });

          it('should set the value to a instance of string', () =>
            assert.typeOf(model.value, 'string'));

          it('should set the type to \'string\'', () =>
            assert.equal(model.type, 'string'));

          it('should set the model value to the equivalent string value', () =>
            assert.equal(model.value, fixture.val));
        });

        describe('when the val is not a number, boolean or string', () => {
          beforeEach(() => {
            fixture.val = [1, 2, 3, 4];
            model = featureModel.parse(fixture);
          });

          it('should set the value to the provided val property', () =>
            assert.equal(model.value, fixture.val));

          it('should set the type to \'string\'', () =>
            assert.equal(model.type, 'string'));
        });

        describe('when there is no value', () => {
          beforeEach('set the value to undefined', () => {
            fixture.val = undefined;
            model = featureModel.parse(fixture);
          });

          it('should set the value to undefined', () =>
            assert.isUndefined(model.value));

          it('should set the type to \'string\'', () =>
            assert.equal(model.type, 'string'));
        });
      });
    });

    describe('#serialize()', () => {
      let serialized;

      describe('when the feature includes a \'lastModified\' property', () => {
        beforeEach('generate the feature model', () => {
          featureModel = new FeatureModel(featureLM);
          serialized = featureModel.serialize();
        });

        it('should assign value attributes to properties', () => {
          assert.equal(featureLM.key, serialized.key);
          assert.equal(featureLM.mutable, serialized.mutable);
          assert.equal(featureLM.type, serialized.type);
          assert.equal(featureLM.val, serialized.val);
          assert.equal(featureLM.value, serialized.value);
        });

        it('should assign the \'lastModified\' value as a \'string\'', () => {
          assert.typeOf(serialized.lastModified, 'string');
          assert.equal(serialized.lastModified, featureLM.lastModified);
        });
      });

      describe('when the feature excludes a \'lastModified\' property', () => {
        beforeEach('generate the feature model', () => {
          featureModel = new FeatureModel(featureNLM);
          serialized = featureModel.serialize();
        });

        it('should assign value attributes to properties', () => {
          assert.equal(featureNLM.key, serialized.key);
          assert.equal(featureNLM.mutable, serialized.mutable);
          assert.equal(featureNLM.type, serialized.type);
          assert.equal(featureNLM.val, serialized.val);
          assert.equal(featureNLM.value, serialized.value);
        });

        it('should not assign the \'lastModified\' value', () => {
          assert.isUndefined(serialized.lastModified);
        });
      });
    });

    describe('#set()', () => {
      describe('when setting only a single key', () => {
        let key;
        let value;

        beforeEach('configure feature and set \'key\' and \'value\'', () => {
          key = 'val';
          value = 'false';
          featureModel = new FeatureModel(featureLM);
          featureModel.set(key, value);
        });

        it('should assign the value to the appropriate key', () => {
          assert.equal(featureModel[key], value);
        });

        it('should not change other key values', () => {
          assert.equal(featureLM.key, featureModel.key);
          assert.equal(featureLM.mutable, featureModel.mutable);
          assert.equal(featureLM.type, featureModel.type);
        });
      });

      describe('when setting all properties', () => {
        beforeEach('configure feature model', () => {
          featureModel = new FeatureModel(featureLM);
          featureModel.set(featureNLM);
        });

        it('should assign all values', () => {
          assert.equal(featureNLM.key, featureModel.key);
          assert.equal(featureNLM.mutable, featureModel.mutable);
          assert.equal(featureNLM.type, featureModel.type);
          assert.equal(featureNLM.val, featureModel.val);
          assert.equal(featureNLM.value, featureModel.value);
        });
      });
    });
  });
});
