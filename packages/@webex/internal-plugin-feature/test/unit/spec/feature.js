/*!
 * Copyright (c) 2015-2020 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@webex/test-helper-chai';
import Device from '@webex/internal-plugin-device';
import Feature from '@webex/internal-plugin-feature';
import MockWebex from '@webex/test-helper-mock-webex';
import sinon from 'sinon';

describe('plugin-feature', () => {
  describe('Feature', () => {
    let webex;

    beforeEach(() => {
      webex = new MockWebex({
        children: {
          device: Device,
          feature: Feature
        }
      });
    });

    describe('#getFeature()', () => {
      it('requires a valid keyType', () => assert.isRejected(
        webex.internal.feature.getFeature('none', 'featureName', {}),
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

        webex.internal.device.features[keyType].add(feature);

        return webex.internal.feature.getFeature(keyType, key, {full: true})
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

        webex.internal.device.features[keyType].add(feature);

        return webex.internal.feature.getFeature(keyType, key)
          .then((result) => assert.deepEqual(result, feature.value));
      });
    });

    describe('#setFeature()', () => {
      beforeEach(() => {
        webex.request = sinon.stub().returns(Promise.resolve({
          body: {},
          statusCode: 200
        }));
      });
      afterEach(() => {
        webex.request.resetHistory();
      });
      it('does not allow entitlement keyType to be set', () => assert.isRejected(
        webex.internal.feature.setFeature('entitlement', 'featureName', true),
        /Only `developer` and `user` feature toggles can be set./
      ));

      [
        'developer',
        'user'
      ].forEach((keyType) => {
        it(`sets a value for a ${keyType} feature toggle`, () => {
          sinon.spy(webex.internal.device.features[keyType], 'add');

          return webex.internal.feature.setFeature(keyType, 'featureName', true)
            .then(() => {
              assert.called(webex.internal.device.features[keyType].add);
              assert.equal(webex.request.getCall(0).args[0].resource, `features/users/${webex.internal.device.userId}/${keyType}`);
            });
        });
      });
    });

    describe('#handleFeatureUpdate', () => {
      it('updates the feature toggle', () => {
        const key = 'featureName';
        const keyType = 'user';
        const envelope = {
          data: {
            featureToggle: {
              key,
              mutable: true,
              type: 'USER',
              val: 'true',
              value: true
            }
          }
        };

        sinon.spy(webex.internal.device.features[keyType], 'add');
        webex.internal.feature.handleFeatureUpdate(envelope);
        assert.called(webex.internal.device.features[keyType].add);
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

          webex.internal.feature.on(`change:${keyType}`, mockEventHandler);
          const key = 'featureName';
          const feature = {
            key,
            mutable: true,
            type: 'boolean',
            val: 'true',
            value: true
          };

          webex.internal.device.features[keyType].add(feature);

          return assert.called(mockEventHandler);
        });
      });
    });
  });
});
