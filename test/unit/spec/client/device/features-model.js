/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var credentialsFixture = require('../../../fixtures/credentials-valid');
var cloneDeep = require('lodash.clonedeep');
var deviceFixture = cloneDeep(require('../../../fixtures/device'));
var configFixture = require('../../../../integration/fixtures/spark-config');
var Spark = require('../../../../../src');
var sinon = require('sinon');

var assert = chai.assert;
sinon.assert.expose(chai.assert, {prefix: ''});

describe('Client', function() {
  describe('Device', function() {
    describe('Features', function() {
      describe('Features Model', function() {
        var spark;
        var device;
        var featureService;

        var sparkChangeFeatureDeveloperSpy = sinon.spy();
        var sparkChangeDeviceFeaturesSpy = sinon.spy();
        var sparkChangeDeviceFeaturesDeveloperSpy = sinon.spy();
        var deviceChangeFeaturesDeveloperSpy = sinon.spy();
        var deviceFeaturesChangeDeveloperSpy = sinon.spy();
        var featureServiceChangeDeveloperSpy = sinon.spy();

        beforeEach(function() {
          spark = new Spark({
            credentials: credentialsFixture,
            device: deviceFixture,
            config: configFixture
          });
          device = spark.device;
          featureService = spark.feature;

          sparkChangeFeatureDeveloperSpy.reset();
          sparkChangeDeviceFeaturesSpy.reset();
          sparkChangeDeviceFeaturesDeveloperSpy.reset();
          deviceChangeFeaturesDeveloperSpy.reset();
          deviceFeaturesChangeDeveloperSpy.reset();
          featureServiceChangeDeveloperSpy.reset();
        });

        it('emits events from collection when a feature changes', function() {

          spark.on('change:feature.developer', sparkChangeFeatureDeveloperSpy);
          spark.on('change:device.features', sparkChangeDeviceFeaturesSpy);
          spark.on('change:device.features.developer', sparkChangeDeviceFeaturesDeveloperSpy);
          device.on('change:features.developer', deviceChangeFeaturesDeveloperSpy);
          device.features.on('change:developer', deviceFeaturesChangeDeveloperSpy);
          featureService.on('change:developer', featureServiceChangeDeveloperSpy);

          // Set the value to trigger the events.
          deviceFixture.features.developer[1] = {
            key: 'another-feature',
            val: 'false',
            value: false,
            mutable: false
          };
          device._processRegistrationSuccess({body: deviceFixture});

          assert.calledOnce(sparkChangeFeatureDeveloperSpy);
          assert.calledOnce(sparkChangeDeviceFeaturesSpy);
          assert.calledOnce(sparkChangeDeviceFeaturesDeveloperSpy);
          assert.calledOnce(deviceChangeFeaturesDeveloperSpy);
          assert.calledOnce(deviceFeaturesChangeDeveloperSpy);
          assert.calledOnce(featureServiceChangeDeveloperSpy);
        });

        it('emits events from collection when a feature is added', function() {
          spark.on('change:feature.developer', sparkChangeFeatureDeveloperSpy);
          spark.on('change:device.features', sparkChangeDeviceFeaturesSpy);
          spark.on('change:device.features.developer', sparkChangeDeviceFeaturesDeveloperSpy);
          device.on('change:features.developer', deviceChangeFeaturesDeveloperSpy);
          device.features.on('change:developer', deviceFeaturesChangeDeveloperSpy);
          featureService.on('change:developer', featureServiceChangeDeveloperSpy);

          device.features.developer.add({
            key: 'another-developer-feature',
            val: 'true',
            value: true,
            mutable: false
          });

          assert.calledOnce(sparkChangeFeatureDeveloperSpy);
          assert.calledOnce(sparkChangeDeviceFeaturesSpy);
          assert.calledOnce(sparkChangeDeviceFeaturesDeveloperSpy);
          assert.calledOnce(deviceChangeFeaturesDeveloperSpy);
          assert.calledOnce(deviceFeaturesChangeDeveloperSpy);
          assert.calledOnce(featureServiceChangeDeveloperSpy);
        });

        it('emits events from collection when a new registration is received with missing features', function() {
          spark.on('change:feature.developer', sparkChangeFeatureDeveloperSpy);
          spark.on('change:device.features', sparkChangeDeviceFeaturesSpy);
          spark.on('change:device.features.developer', sparkChangeDeviceFeaturesDeveloperSpy);
          device.on('change:features.developer', deviceChangeFeaturesDeveloperSpy);
          device.features.on('change:developer', deviceFeaturesChangeDeveloperSpy);
          featureService.on('change:developer', featureServiceChangeDeveloperSpy);

          deviceFixture.features.developer.pop();
          device._processRegistrationSuccess({body: deviceFixture});

          assert.calledOnce(sparkChangeFeatureDeveloperSpy);
          assert.calledOnce(sparkChangeDeviceFeaturesSpy);
          assert.calledOnce(sparkChangeDeviceFeaturesDeveloperSpy);
          assert.calledOnce(deviceChangeFeaturesDeveloperSpy);
          assert.calledOnce(deviceFeaturesChangeDeveloperSpy);
          assert.calledOnce(featureServiceChangeDeveloperSpy);
        });
      });
    });
  });
});
