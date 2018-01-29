/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import MockSpark from '@ciscospark/test-helper-mock-spark';
import {assert} from '@ciscospark/test-helper-chai';
import sinon from '@ciscospark/test-helper-sinon';
import {cloneDeep} from 'lodash';
import deviceFixture from '../lib/device-fixture';
import Device from '@ciscospark/internal-plugin-wdm';

describe('plugin-wdm', () => {
  describe('FeaturesModel', () => {
    let spark;
    let deviceFeaturesChangeDeveloperSpy;
    let deviceChangeFeaturesDeveloperSpy;
    let deviceChangeFeaturesSpy;
    let deviceChangeSpy;
    let sparkChangeSpy;
    let sparkChangeDeviceSpy;
    let sparkChangeDeviceFeaturesSpy;
    let sparkChangeDeviceFeaturesDeveloperSpy;

    beforeEach(() => {
      spark = new MockSpark({
        children: {
          device: Device
        }
      });

      spark.internal.device._processRegistrationSuccess({body: cloneDeep(deviceFixture)});

      deviceFeaturesChangeDeveloperSpy = sinon.spy();
      deviceChangeFeaturesDeveloperSpy = sinon.spy();
      deviceChangeFeaturesSpy = sinon.spy();
      deviceChangeSpy = sinon.spy();
      sparkChangeSpy = sinon.spy();
      sparkChangeDeviceSpy = sinon.spy();
      sparkChangeDeviceFeaturesSpy = sinon.spy();
      sparkChangeDeviceFeaturesDeveloperSpy = sinon.spy();

      spark.internal.device.features.on('change:developer', deviceFeaturesChangeDeveloperSpy);
      spark.internal.device.on('change:features.developer', deviceChangeFeaturesDeveloperSpy);
      spark.internal.device.on('change:features', deviceChangeFeaturesSpy);
      spark.internal.device.on('change', deviceChangeSpy);
      spark.on('change', sparkChangeSpy);
      spark.on('change:internal.device', sparkChangeDeviceSpy);
      spark.on('change:internal.device.features', sparkChangeDeviceFeaturesSpy);
      spark.on('change:internal.device.features.developer', sparkChangeDeviceFeaturesDeveloperSpy);
    });

    describe('when a feature is added', () => {
      it('emits a change event', () => {
        spark.internal.device.features.developer.add({
          key: 'another-developer-feature',
          val: 'true',
          value: true,
          mutable: false
        });

        assert.calledOnce(deviceFeaturesChangeDeveloperSpy);
        assert.calledOnce(deviceChangeFeaturesDeveloperSpy);
        assert.calledOnce(deviceChangeFeaturesSpy);
        assert.calledOnce(deviceChangeSpy);
        assert.calledOnce(sparkChangeSpy);
        assert.calledOnce(sparkChangeDeviceSpy);
        assert.calledOnce(sparkChangeDeviceFeaturesSpy);
        assert.calledOnce(sparkChangeDeviceFeaturesDeveloperSpy);
      });
    });

    describe('when a feature changes', () => {
      it('emits a change event', () => {
        const data = cloneDeep(deviceFixture);
        data.features.developer[1] = {
          key: 'another-feature',
          val: 'false',
          value: false,
          mutable: false
        };
        spark.internal.device._processRegistrationSuccess({body: data});

        assert.calledOnce(deviceFeaturesChangeDeveloperSpy);
        assert.calledOnce(deviceChangeFeaturesDeveloperSpy);
        assert.calledOnce(deviceChangeFeaturesSpy);
        assert.calledOnce(deviceChangeSpy);
        assert.calledOnce(sparkChangeSpy);
        assert.calledOnce(sparkChangeDeviceSpy);
        assert.calledOnce(sparkChangeDeviceFeaturesSpy);
        assert.calledOnce(sparkChangeDeviceFeaturesDeveloperSpy);
      });
    });

    describe('when a feature is removed', () => {
      it('emits a change event', () => {
        const data = cloneDeep(deviceFixture);
        data.features.developer.pop();
        spark.internal.device._processRegistrationSuccess({body: data});

        assert.calledOnce(deviceFeaturesChangeDeveloperSpy);
        assert.calledOnce(deviceChangeFeaturesDeveloperSpy);
        assert.calledOnce(deviceChangeFeaturesSpy);
        assert.calledOnce(deviceChangeSpy);
        assert.calledOnce(sparkChangeSpy);
        assert.calledOnce(sparkChangeDeviceSpy);
        assert.calledOnce(sparkChangeDeviceFeaturesSpy);
        assert.calledOnce(sparkChangeDeviceFeaturesDeveloperSpy);
      });
    });
  });
});
