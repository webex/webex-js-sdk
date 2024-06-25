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
          feature: Feature,
        },
      });
    });

    describe('#getFeature()', () => {
      it('requires a valid keyType', () =>
        assert.isRejected(
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
          value: true,
        };

        webex.internal.device.features[keyType].add(feature);

        return webex.internal.feature
          .getFeature(keyType, key, {full: true})
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
          value: true,
        };

        webex.internal.device.features[keyType].add(feature);

        return webex.internal.feature
          .getFeature(keyType, key)
          .then((result) => assert.deepEqual(result, feature.value));
      });
    });

    describe('#updateFeature', () => {
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
              value: true,
            },
          },
        };

        sinon.spy(webex.internal.device.features[keyType], 'add');
        webex.internal.feature.updateFeature(envelope);
        assert.called(webex.internal.device.features[keyType].add);
      });
    });

    describe('when a feature is changed', () => {
      ['developer', 'entitlement', 'user'].forEach((keyType) => {
        it(`emits \`change:${keyType}\` on ${keyType} feature change`, () => {
          const mockEventHandler = sinon.spy();

          webex.internal.feature.on(`change:${keyType}`, mockEventHandler);
          const key = 'featureName';
          const feature = {
            key,
            mutable: true,
            type: 'boolean',
            val: 'true',
            value: true,
          };

          webex.internal.device.features[keyType].add(feature);

          return assert.called(mockEventHandler);
        });
      });
    });
  });
});
