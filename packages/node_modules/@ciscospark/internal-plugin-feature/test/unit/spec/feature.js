/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import Device from '@ciscospark/internal-plugin-wdm';
import Feature from '@ciscospark/internal-plugin-feature';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';

describe('plugin-feature', () => {
  describe('Feature', () => {
    let spark;

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          device: Device,
          feature: Feature
        }
      });
    });

    describe('#getFeature()', () => {
      it('requires a valid keyType', () => assert.isRejected(
        spark.internal.feature.getFeature('none', 'featureName', {}),
        /Invalid feature keyType provided. Only `developer`, `user`, and `entitlement` feature toggles are permitted./
      ));

      it('returns the full feature object', () => {
        const key = 'featureName';
        const keyType = 'developer';
        const feature = {
          key,
          mutable: true,
          type: 'boolean',
          val: 'true',
          value: true
        };
        spark.internal.device.features[keyType].add(feature);
        return spark.internal.feature.getFeature(keyType, key, {full: true})
          .then((result) => assert.deepEqual(result, feature));
      });

      it('returns the feature value', () => {
        const key = 'featureName';
        const keyType = 'developer';
        const feature = {
          key,
          mutable: true,
          type: 'boolean',
          val: 'true',
          value: true
        };
        spark.internal.device.features[keyType].add(feature);
        return spark.internal.feature.getFeature(keyType, key)
          .then((result) => assert.deepEqual(result, feature.value));
      });
    });

    describe('#setFeature()', () => {
      beforeEach(() => {
        spark.request = sinon.stub().returns(Promise.resolve({
          body: {},
          statusCode: 200
        }));
      });
      afterEach(() => {
        spark.request.resetHistory();
      });
      it('does not allow entitlement keyType to be set', () => assert.isRejected(
        spark.internal.feature.setFeature('entitlement', 'featureName', true),
        /Only `developer` and `user` feature toggles can be set./
      ));

      [
        'developer',
        'user'
      ].forEach((keyType) => {
        it(`sets a value for a ${keyType} feature toggle`, () => {
          spark.internal.device.features[keyType].add = sinon.stub();
          spark.internal.feature.setFeature(keyType, 'featureName', true)
            .then(() => {
              assert.called(spark.internal.device.features[keyType].add);
              assert.equal(spark.request.getCall(0).args[0].resource, `features/users/${spark.internal.device.userId} /${keyType}`);
            });
        });
      });
    });

    describe('when a feature is changed', () => {
      [
        'developer',
        'entitlement',
        'user'
      ].forEach((keyType) => {
        it(`emits \`change:${keyType}\` on ${keyType} feature change`, () => {
          const mockEventHandler = sinon.spy();
          spark.internal.feature.on(`change:${keyType}`, mockEventHandler);
          const key = 'featureName';
          const feature = {
            key,
            mutable: true,
            type: 'boolean',
            val: 'true',
            value: true
          };
          spark.internal.device.features[keyType].add(feature);
          return assert.called(mockEventHandler);
        });
      });
    });
  });
});
