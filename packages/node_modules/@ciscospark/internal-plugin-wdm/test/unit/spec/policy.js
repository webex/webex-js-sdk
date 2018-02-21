/*!
 * Copyright (c) 2015-2017 Cisco Systems, Inc. See LICENSE file.
 */

import {assert} from '@ciscospark/test-helper-chai';
import MockSpark from '@ciscospark/test-helper-mock-spark';
import sinon from '@ciscospark/test-helper-sinon';
import Device from '@ciscospark/internal-plugin-wdm';
import deviceFixture from '../lib/device-fixture';
import lolex from 'lolex';
import {cloneDeep} from 'lodash';

describe('plugin-wdm', () => {
  describe('Device', () => {
    let spark;
    beforeEach(() => {
      spark = new MockSpark({
        children: {
          device: Device
        },
        config: {
          device: {
            enableInactivityEnforcement: true
          }
        }
      });

      spark.internal.device.set(cloneDeep(deviceFixture));
      spark.logout = sinon.spy();
    });

    let clock;

    beforeEach(() => {
      clock = lolex.install({now: Date.now()});
    });

    afterEach(() => {
      clock.uninstall();
    });

    describe('autologout policy', () => {
      describe('when some or all of the policy configuration is unspecified', () => {
        it('stays dormant', () => {
          assert.isUndefined(spark.internal.device.logoutTimer);

          spark.internal.device.intranetInactivityCheckUrl = 'http://ping.example.com/ping';
          assert.isUndefined(spark.internal.device.logoutTimer);

          spark.internal.device.intranetInactivityDuration = 2;
          assert.isDefined(spark.internal.device.logoutTimer);

          spark.internal.device.unset('intranetInactivityCheckUrl');
          assert.isUndefined(spark.internal.device.logoutTimer);
        });
      });

      describe('when the local config indicates the policy should be disabled', () => {
        it('stays dormant', () => {
          spark.config.device.enableInactivityEnforcement = false;
          spark.internal.device.set({
            intranetInactivityDuration: 8 * 60 * 60,
            intranetInactivityCheckUrl: 'http://ping.example.com/ping'
          });
          assert.isUndefined(spark.internal.device.logoutTimer);

          spark.internal.device.intranetInactivityCheckUrl = 'http://ping.example.com/ping';
          assert.isUndefined(spark.internal.device.logoutTimer);

          spark.internal.device.intranetInactivityDuration = 2;
          assert.isUndefined(spark.internal.device.logoutTimer);

          spark.internal.device.unset('intranetInactivityCheckUrl');
          assert.isUndefined(spark.internal.device.logoutTimer);
        });
      });

      describe('when the policy configuration is specified', () => {
        it('logs the user out according to the policy configuration', () => {
          spark.request.returns(Promise.reject());

          spark.internal.device.set({
            intranetInactivityDuration: 8 * 60 * 60,
            intranetInactivityCheckUrl: 'http://ping.example.com/ping'
          });
          assert.isDefined(spark.internal.device.logoutTimer);

          clock.tick(8 * 60 * 60 * 1000);
          assert.calledOnce(spark.request);
          assert.calledWith(spark.request, {
            headers: {
              'cisco-no-http-redirect': null,
              'spark-user-agent': null,
              trackingid: null
            },
            method: 'GET',
            uri: 'http://ping.example.com/ping'
          });
          return Promise.resolve()
            .then(() => assert.calledOnce(spark.logout));
        });

        describe('when the ping url can be reached', () => {
          it('resets the logout timer', () => {
            spark.request.returns(Promise.resolve({
              statusCode: 200
            }));

            spark.internal.device.set({
              intranetInactivityDuration: 8 * 60 * 60,
              intranetInactivityCheckUrl: 'http://ping.example.com/ping'
            });
            assert.isDefined(spark.internal.device.logoutTimer);

            clock.tick(8 * 60 * 60 * 1000);
            assert.calledOnce(spark.request);
            assert.calledWith(spark.request, {
              headers: {
                'cisco-no-http-redirect': null,
                'spark-user-agent': null,
                trackingid: null
              },
              method: 'GET',
              uri: 'http://ping.example.com/ping'
            });
            return Promise.resolve()
              .then(() => assert.notCalled(spark.logout));
          });
        });

        describe('when there is user activity', () => {
          it('resets the logout timer', () => {
            spark.internal.device.set({
              intranetInactivityDuration: 8 * 60 * 60,
              intranetInactivityCheckUrl: 'http://ping.example.com/ping'
            });

            clock.tick(1 * 60 * 60 * 1000);
            spark.emit('user-activity');

            clock.tick(7 * 60 * 60 * 1000);
            assert.neverCalledWith(spark.request, {
              method: 'GET',
              uri: 'http://ping.example.com/ping'
            });

            clock.tick(1 * 60 * 60 * 1000);
            assert.calledWith(spark.request, {
              headers: {
                'cisco-no-http-redirect': null,
                'spark-user-agent': null,
                trackingid: null
              },
              method: 'GET',
              uri: 'http://ping.example.com/ping'
            });
            return Promise.resolve()
              .then(() => assert.notCalled(spark.logout));
          });

          it('does not call _resetLogoutTimer in arithmetic progression with every post', () => {
            spark.internal.device.set({
              intranetInactivityDuration: 8 * 60 * 60,
              intranetInactivityCheckUrl: 'http://ping.example.com/ping'
            });

            const resetLogoutTimerSpy = sinon.spy(spark.internal.device, '_resetLogoutTimer');
            spark.emit('user-activity');
            clock.tick(1 * 60 * 60 * 1000);
            assert.equal(resetLogoutTimerSpy.callCount, 2);
            resetLogoutTimerSpy.reset();

            spark.emit('user-activity');
            clock.tick(1 * 60 * 60 * 1000);
            assert.equal(resetLogoutTimerSpy.callCount, 2);
            resetLogoutTimerSpy.reset();

            spark.emit('user-activity');
            clock.tick(1 * 60 * 60 * 1000);
            assert.equal(resetLogoutTimerSpy.callCount, 2);
            resetLogoutTimerSpy.reset();

            spark.emit('user-activity');
            clock.tick(1 * 60 * 60 * 1000);
            assert.equal(resetLogoutTimerSpy.callCount, 2);
            resetLogoutTimerSpy.reset();
          });
        });
      });
    });
  });
});
