/**!
 *
 * Copyright (c) 2015-2016 Cisco Systems, Inc. See LICENSE file.
 */

'use strict';

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
var Device = require('../../../../src/client/device');
var deviceFixture = require('../../fixtures/device');
var MockSpark = require('../../lib/mock-spark');
var sinon = require('sinon');
var cloneDeep = require('lodash.clonedeep');
var lolex = require('lolex');

chai.use(chaiAsPromised);
var assert = chai.assert;

describe('Client', function() {
  describe('Device', function() {
    var spark;
    var device;
    var clock;

    beforeEach(function() {
      spark = new MockSpark({
        children: {
          device: Device
        }
      });
      spark.config = {
        device: {
          embargoFailureMessage: 'you are embargoed'
        }
      };
      spark.device.set(deviceFixture);
      device = spark.device;

      clock = lolex.install();
    });

    afterEach(function() {
      clock.uninstall();
    });

    describe('mediaClusters', function() {
      it('sets media clusters in device for valid url', function(done) {
        spark.request.returns(Promise.resolve({
          statusCode: 200
        }));

        deviceFixture.mediaClusters = {
          'squared.EU.*': [
            'https://valid/ping'
          ]
        };
        spark.device.set(deviceFixture);
        assert.lengthOf(spark.device.mediaClusters, 1);
        assert.equal(spark.device.mediaClusters.at(0).urls.at(0).url, 'https://valid/ping');
        spark.device.mediaClusters.at(0).urls.at(0).on('change:reachable', function(url) {
          assert.isTrue(spark.device.mediaClusters.at(0).reachable);
          assert.isTrue(url.reachable);
          done();
        });
        delete deviceFixture.mediaClusters;
      });

      it('sets media clusters in device for invalid url', function(done) {
        spark.request.returns(Promise.reject({statusCode: 500}));
        deviceFixture.mediaClusters = {
          'squared.US.*': [
            'https://invalid/ping'
          ]
        };
        spark.device.set(deviceFixture);
        assert.lengthOf(spark.device.mediaClusters, 1);
        assert.equal(spark.device.mediaClusters.at(0).urls.at(0).url, 'https://invalid/ping');
        spark.device.mediaClusters.at(0).urls.at(0).on('change:reachable', function(url) {
          assert.isFalse(spark.device.mediaClusters.at(0).reachable);
          assert.isFalse(url.reachable);
          done();
        });
        delete deviceFixture.mediaClusters;
      });
    });

    describe('policy', function() {
      it('handles policy variables missing', function() {
        assert.isUndefined(spark.device.intranetInactivityDuration);
        assert.isUndefined(spark.device.intranetInactivityCheckUrl);
        assert.isNull(spark.device.policy);
      });
      it('handles intranetInactivityDuration missing', function() {
        var cloneDevice = cloneDeep(deviceFixture);
        cloneDevice.intranetInactivityCheckUrl = 'http://ping.example.com/ping';
        spark.device.set(cloneDevice);
        assert.isUndefined(spark.device.intranetInactivityDuration);
        assert.isNull(spark.device.policy);
        assert.equal(spark.device.intranetInactivityCheckUrl,
          cloneDevice.intranetInactivityCheckUrl);
      });
      it('handles intranetInactivityCheckUrl missing', function() {
        var cloneDevice = cloneDeep(deviceFixture);
        cloneDevice.intranetInactivityDuration = 2;
        spark.device.set(cloneDevice);
        assert.isUndefined(spark.device.intranetInactivityCheckUrl);
        assert.isNull(spark.device.policy);
        assert.equal(spark.device.intranetInactivityDuration,
          cloneDevice.intranetInactivityDuration);
      });
      it('handles logout after inactivity', function() {
        var convoOnSpy = sinon.spy(spark.conversation, 'on');
        var logoutSpy = sinon.spy(spark, 'logout');
        var logoutNotifySpy = sinon.spy(spark, 'trigger');

        var cloneDevice = cloneDeep(deviceFixture);
        cloneDevice.intranetInactivityDuration = 2;
        cloneDevice.intranetInactivityCheckUrl = 'http://ping.example.com/ping';
        spark.device.set(cloneDevice);

        return spark.device._initPolicy()
          .then(function() {
            assert.called(convoOnSpy, 'monitoring activity in order to reset logout timer');
            clock.tick(1*1000);
            assert.notCalled(logoutSpy, 'timer has not expired');
            clock.tick(3*1000);
            assert.called(logoutSpy, 'logging out since time has run out');
            assert.called(logoutNotifySpy, 'notified upstream that logout occurred');
          });
      });
    });

    describe('#getPreAuthServiceUrl()', function() {
      it('requires a `service` parameter', function() {
        assert.throws(function() {
          device.getPreAuthServiceUrl();
        }, /`service` is a required parameter/);
      });

      it('returns the specified hardcoded service url', function() {
        device.config.preAuthServices = {
          validServiceUrl: 'http://example.com/pre-auth-service'
        };

        assert.isUndefined(device.getPreAuthServiceUrl('invalid'));
        assert.equal(device.getPreAuthServiceUrl('valid'), 'http://example.com/pre-auth-service');
      });
    });

    describe('#getServiceUrl()', function() {
      it('requires a `service` parameter', function() {
        assert.throws(function() {
          device.getServiceUrl();
        }, /`service` is a required parameter/);
      });

      it('returns the specified service url', function() {
        device.services = {
          validServiceUrl: 'http://example.com/valid-service'
        };

        assert.isUndefined(device.getServiceUrl('invalid'));
        assert.equal(device.getServiceUrl('valid'), 'http://example.com/valid-service');
      });
    });

    describe('#isDeviceRegistationUrl()', function() {
      it('requires a `url` parameter', function() {
        assert.throws(function() {
          device.isDeviceRegistrationUrl();
        }, /`url` is a required parameter/);
      });

      it('indicates whether the specified url is the WDM registration url', function() {
        device.config.deviceRegistrationUrl = 'http://example.com/devices';

        assert.isTrue(device.isDeviceRegistrationUrl('http://example.com/devices'));
        assert.isFalse(device.isDeviceRegistrationUrl('http://example.com/other'));
        assert.isFalse(device.isDeviceRegistrationUrl('http://example.com/devices/more'));
      });
    });

    describe('#isPreAuthService()', function() {
      it('requires a `service` parameter', function() {
        assert.throws(function() {
          device.isPreAuthService();
        }, /`service` is a required parameter/);
      });

      it('indicates whether the specified service is one of the hardcoded app services', function() {
        device.config.preAuthServices = {
          validServiceUrl: 'http://example.com/pre-auth-service'
        };

        assert.isFalse(device.isPreAuthService('invalid'));
        assert.isTrue(device.isPreAuthService('valid'));
      });
    });

    describe('#isPreAuthServiceUrl()', function() {
      it('requires a `uri` parameter', function() {
        assert.throws(function() {
          device.isPreAuthServiceUrl();
        }, /`uri` is a required parameter/);
      });

      it('indicates whether the specified url is a hardocded service', function() {
        device.config.preAuthServices = {
          validServiceUrl: 'http://example.com/pre-auth-service'
        };

        assert.isFalse(device.isPreAuthServiceUrl('http://example.com/auth-service/some-endpoint'));
        assert.isTrue(device.isPreAuthServiceUrl('http://example.com/pre-auth-service/some-endpoint'));
      });
    });

    describe('#isValidService()', function() {
      it('requires a `service` parameter', function() {
        assert.throws(function() {
          device.isValidService();
        }, /`service` is a required parameter/);
      });

      it('indicates whether the specified service is known to the device', function() {
        device.services = {
          validServiceUrl: 'http://example.com/valid-service'
        };

        assert.isFalse(device.isValidService('invalid'));
        assert.isTrue(device.isValidService('valid'));
      });
    });

    describe('#isServiceUrl()', function() {
      it('requires a `uri` parameter', function() {
        assert.throws(function() {
          device.isServiceUrl();
        }, /`uri` is a required parameter/);
      });

      it('indicates whether the specified url is a service known to the device', function() {
        device.services = {
          validServiceUrl: 'http://example.com/service'
        };

        assert.isFalse(device.isServiceUrl('http://example.com/not-a-service/some-endpoint'));
        assert.isTrue(device.isServiceUrl('http://example.com/service/some-endpoint'));
      });
    });

    describe('#refresh()', function() {
      describe('in embargoed countries', function() {
        it('renders spark unusable', function() {
          sinon.stub(device, '_locate').returns(Promise.resolve({}));
          spark.request = sinon.stub().returns(Promise.reject({
            statusCode: 451
          }));

          assert.isDefined(device.features);
          assert.isNotNull(device.features);
          assert.isDefined(device.services);
          assert.isNotNull(device.services);
          assert.isDefined(device.url);
          assert.isNotNull(device.url);
          assert.isDefined(device.features);
          assert.isNotNull(device.features);

          return assert.isRejected(device.refresh())
            .then(function() {
              assert.isDefined(device.features);
              assert.lengthOf(device.features.developer, 0);
              assert.lengthOf(device.features.entitlement, 0);
              assert.lengthOf(device.features.user, 0);
              assert.isUndefined(device.services);
              assert.isUndefined(device.url);
              assert.isUndefined(device.webSocketUrl);
            });
        });
      });

      it('allows only one inflight request', function() {
        sinon.stub(device, 'request').returns(Promise.resolve());
        var p1 = device.refresh();
        assert.instanceOf(p1, Promise);
        var p2 = device.refresh();
        assert.instanceOf(p2, Promise);
        assert.equal(p1, p2);
      });
    });

    describe('#register()', function() {
      it('allows only one inflight request', function() {
        sinon.stub(device, 'register').returns(Promise.resolve());
        var p1 = device.register();
        assert.instanceOf(p1, Promise);
        var p2 = device.register();
        assert.instanceOf(p2, Promise);
        assert.equal(p1, p2);
      });
    });

    describe('#serialize()', function() {
      it('serializes feature toggles in a format compatible with WDM', function() {
        deviceFixture.mediaClusters = [];
        assert.deepEqual(device.serialize(), deviceFixture);
      });
    });

    describe('#_clearProps()', function() {
      it('removes properties, but not spark or logger', function() {
        device.set({prop: 1});
        assert.isDefined(device.spark);
        assert.isDefined(device.prop);
        assert.isDefined(device.logger);

        device._clearProps();

        assert.isUndefined(device.prop);

        assert.isDefined(device.spark);
        assert.equal(device.spark, spark);

        assert.isDefined(device.logger);
      });
    });

  });
});
